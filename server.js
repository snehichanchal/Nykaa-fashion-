const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const path = require('path');
const { execSync } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Explicit Admin Page Route
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Database Connection
const dbPath = path.join(__dirname, 'db', 'database.sqlite');
function getDb() {
  return new Database(dbPath);
}

// -------------------------------------------------------------
// STORE API ENDPOINTS
// -------------------------------------------------------------

// Categories
app.get('/api/categories', (req, res) => {
  try {
    const db = getDb();
    const categories = db.prepare('SELECT * FROM categories ORDER BY id ASC').all();
    db.close();
    res.json({ success: true, data: categories });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Brands
app.get('/api/brands', (req, res) => {
  try {
    const db = getDb();
    const brands = db.prepare('SELECT * FROM brands ORDER BY name ASC').all();
    db.close();
    res.json({ success: true, data: brands });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Products Listing with Filtering, Search & Sorting
app.get('/api/products', (req, res) => {
  try {
    const db = getDb();
    const { category, brand, search, gender, minPrice, maxPrice, minDiscount, size, badge, sort } = req.query;

    let query = 'SELECT * FROM products WHERE 1=1';
    const params = [];

    if (category && category !== 'all') {
      const cats = category.split(',').map(c => c.trim()).filter(Boolean);
      if (cats.length > 0) {
        query += ` AND category_slug IN (${cats.map(() => '?').join(',')})`;
        params.push(...cats);
      }
    }
    if (gender && gender !== 'all') {
      query += ' AND gender = ?';
      params.push(gender);
    }
    if (brand && brand !== 'all') {
      const brands = brand.split(',').map(b => b.trim()).filter(Boolean);
      if (brands.length > 0) {
        query += ` AND brand_name IN (${brands.map(() => '?').join(',')})`;
        params.push(...brands);
      }
    }
    if (badge && badge !== 'all') {
      query += ' AND badge LIKE ?';
      params.push(`%${badge}%`);
    }
    if (search) {
      query += ' AND (title LIKE ? OR brand_name LIKE ? OR description LIKE ? OR category_slug LIKE ? OR gender LIKE ?)';
      const term = `%${search}%`;
      params.push(term, term, term, term, term);
    }
    if (minPrice) {
      query += ' AND price >= ?';
      params.push(Number(minPrice));
    }
    if (maxPrice) {
      query += ' AND price <= ?';
      params.push(Number(maxPrice));
    }
    if (minDiscount) {
      query += ' AND discount_percent >= ?';
      params.push(Number(minDiscount));
    }

    // Sort order
    if (sort === 'price_asc') {
      query += ' ORDER BY price ASC';
    } else if (sort === 'price_desc') {
      query += ' ORDER BY price DESC';
    } else if (sort === 'discount') {
      query += ' ORDER BY discount_percent DESC';
    } else if (sort === 'newest') {
      query += ' ORDER BY id DESC';
    } else {
      query += ' ORDER BY is_bestseller DESC, rating DESC, id DESC';
    }

    const products = db.prepare(query).all(...params);

    // Client-side JSON parsing helpers & size filtering
    let formatted = products.map(p => ({
      ...p,
      colors: JSON.parse(p.colors_json || '[]'),
      sizes: JSON.parse(p.sizes_json || '[]'),
      images: JSON.parse(p.images_json || '[]')
    }));

    if (size) {
      formatted = formatted.filter(p => p.sizes.includes(size));
    }

    db.close();
    res.json({ success: true, count: formatted.length, data: formatted });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Single Product Details
app.get('/api/products/:id', (req, res) => {
  try {
    const db = getDb();
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    db.close();

    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    product.colors = JSON.parse(product.colors_json || '[]');
    product.sizes = JSON.parse(product.sizes_json || '[]');
    product.images = JSON.parse(product.images_json || '[]');

    res.json({ success: true, data: product });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Wishlist
app.get('/api/wishlist', (req, res) => {
  try {
    const db = getDb();
    const items = db.prepare(`
      SELECT w.id as wishlist_id, p.* 
      FROM wishlist_items w
      JOIN products p ON w.product_id = p.id
      WHERE w.session_id = 'default_user'
      ORDER BY w.id DESC
    `).all();

    const formatted = items.map(p => ({
      ...p,
      colors: JSON.parse(p.colors_json || '[]'),
      sizes: JSON.parse(p.sizes_json || '[]'),
      images: JSON.parse(p.images_json || '[]')
    }));

    db.close();
    res.json({ success: true, data: formatted });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/wishlist/toggle', (req, res) => {
  try {
    const { productId } = req.body;
    const db = getDb();
    
    const existing = db.prepare('SELECT * FROM wishlist_items WHERE session_id = ? AND product_id = ?')
      .get('default_user', productId);

    if (existing) {
      db.prepare('DELETE FROM wishlist_items WHERE id = ?').run(existing.id);
      db.close();
      return res.json({ success: true, action: 'removed', isWishlisted: false });
    } else {
      db.prepare('INSERT INTO wishlist_items (session_id, product_id) VALUES (?, ?)')
        .run('default_user', productId);
      db.close();
      return res.json({ success: true, action: 'added', isWishlisted: true });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/wishlist/:productId', (req, res) => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM wishlist_items WHERE session_id = ? AND product_id = ?')
      .run('default_user', req.params.productId);
    db.close();
    res.json({ success: true, message: 'Item removed from wishlist' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Cart Drawer
app.get('/api/cart', (req, res) => {
  try {
    const db = getDb();
    const items = db.prepare(`
      SELECT c.id as cart_id, c.size as selected_size, c.color as selected_color, c.quantity, p.* 
      FROM cart_items c
      JOIN products p ON c.product_id = p.id
      WHERE c.session_id = 'default_user'
      ORDER BY c.id DESC
    `).all();

    let totalAmount = 0;
    let totalMrp = 0;

    const formatted = items.map(item => {
      const price = item.price * item.quantity;
      const mrp = item.mrp * item.quantity;
      totalAmount += price;
      totalMrp += mrp;

      return {
        ...item,
        colors: JSON.parse(item.colors_json || '[]'),
        sizes: JSON.parse(item.sizes_json || '[]'),
        images: JSON.parse(item.images_json || '[]')
      };
    });

    const totalDiscount = totalMrp - totalAmount;

    db.close();
    res.json({
      success: true,
      data: formatted,
      summary: {
        itemCount: formatted.reduce((acc, item) => acc + item.quantity, 0),
        totalMrp,
        totalAmount,
        totalDiscount
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/cart', (req, res) => {
  try {
    const { productId, size, color, quantity } = req.body;
    const db = getDb();

    const prod = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
    if (!prod) {
      db.close();
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    const availableSizes = JSON.parse(prod.sizes_json || '[]');
    const chosenSize = size || (availableSizes.length > 0 ? availableSizes[0] : 'Free Size');

    // Check if already in cart with same size
    const existing = db.prepare('SELECT * FROM cart_items WHERE session_id = ? AND product_id = ? AND size = ?')
      .get('default_user', productId, chosenSize);

    if (existing) {
      const newQty = existing.quantity + (quantity || 1);
      db.prepare('UPDATE cart_items SET quantity = ? WHERE id = ?').run(newQty, existing.id);
    } else {
      db.prepare('INSERT INTO cart_items (session_id, product_id, size, color, quantity) VALUES (?, ?, ?, ?, ?)')
        .run('default_user', productId, chosenSize, color || null, quantity || 1);
    }

    db.close();
    res.json({ success: true, message: 'Added to Bag successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/cart/:cartId', (req, res) => {
  try {
    const { quantity, size } = req.body;
    const db = getDb();

    if (quantity !== undefined) {
      if (quantity <= 0) {
        db.prepare('DELETE FROM cart_items WHERE id = ?').run(req.params.cartId);
      } else {
        db.prepare('UPDATE cart_items SET quantity = ? WHERE id = ?').run(quantity, req.params.cartId);
      }
    }
    if (size) {
      db.prepare('UPDATE cart_items SET size = ? WHERE id = ?').run(size, req.params.cartId);
    }

    db.close();
    res.json({ success: true, message: 'Cart updated' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/cart/:cartId', (req, res) => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM cart_items WHERE id = ?').run(req.params.cartId);
    db.close();
    res.json({ success: true, message: 'Item removed from bag' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Move from Wishlist to Bag
app.post('/api/wishlist/move-to-bag', (req, res) => {
  try {
    const { productId, size } = req.body;
    const db = getDb();

    const prod = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
    if (!prod) {
      db.close();
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    const sizes = JSON.parse(prod.sizes_json || '[]');
    const chosenSize = size || (sizes.length > 0 ? sizes[0] : 'One Size');

    // Add to cart
    db.prepare('INSERT INTO cart_items (session_id, product_id, size, quantity) VALUES (?, ?, ?, 1)')
      .run('default_user', productId, chosenSize);

    // Remove from wishlist
    db.prepare('DELETE FROM wishlist_items WHERE session_id = ? AND product_id = ?')
      .run('default_user', productId);

    db.close();
    res.json({ success: true, message: 'Item moved to Bag!' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Checkout & Place Order
app.post('/api/checkout', (req, res) => {
  try {
    const { customerName, customerEmail, customerPhone, address, pincode, paymentMethod } = req.body;
    const db = getDb();

    // Get current cart items
    const cartItems = db.prepare(`
      SELECT c.quantity, c.size, p.id as product_id, p.title, p.price, p.mrp, p.images_json 
      FROM cart_items c
      JOIN products p ON c.product_id = p.id
      WHERE c.session_id = 'default_user'
    `).all();

    if (cartItems.length === 0) {
      db.close();
      return res.status(400).json({ success: false, error: 'Cart is empty' });
    }

    let totalAmount = 0;
    let totalMrp = 0;
    cartItems.forEach(item => {
      totalAmount += item.price * item.quantity;
      totalMrp += item.mrp * item.quantity;
    });
    const discountAmount = totalMrp - totalAmount;

    const orderNumber = 'NYK-' + Math.floor(100000 + Math.random() * 900000);

    const insertOrder = db.prepare(`
      INSERT INTO orders (order_number, customer_name, customer_email, customer_phone, address, pincode, payment_method, total_amount, discount_amount)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const info = insertOrder.run(
      orderNumber, customerName || 'Guest User', customerEmail || 'user@example.com',
      customerPhone || '9876543210', address || '123 Fashion Street', pincode || '110001',
      paymentMethod || 'UPI', totalAmount, discountAmount
    );

    const orderId = info.lastInsertRowid;

    const insertOrderItem = db.prepare(`
      INSERT INTO order_items (order_id, product_id, product_title, price, quantity, size, image_url)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    cartItems.forEach(item => {
      const imgs = JSON.parse(item.images_json || '[]');
      insertOrderItem.run(orderId, item.product_id, item.title, item.price, item.quantity, item.size, imgs[0] || null);
    });

    // Clear user cart
    db.prepare("DELETE FROM cart_items WHERE session_id = 'default_user'").run();

    db.close();
    res.json({
      success: true,
      message: 'Order placed successfully!',
      order: {
        orderId,
        orderNumber,
        totalAmount,
        discountAmount,
        paymentMethod,
        itemCount: cartItems.length
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
// -------------------------------------------------------------
// USER AUTHENTICATION & ACCOUNT ENDPOINTS
// -------------------------------------------------------------

// Send OTP
app.post('/api/auth/send-otp', (req, res) => {
  try {
    const { identifier } = req.body;
    if (!identifier) return res.status(400).json({ success: false, error: 'Mobile number or email is required' });

    res.json({
      success: true,
      otp: '1234',
      message: `OTP sent successfully to ${identifier}`
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Verify OTP & Create/Get User
app.post('/api/auth/verify-otp', (req, res) => {
  try {
    const { identifier, name, otp } = req.body;
    if (otp !== '1234' && otp !== '0000') {
      return res.status(400).json({ success: false, error: 'Invalid OTP code. Please enter 1234 for demo.' });
    }

    const db = getDb();
    let user = db.prepare('SELECT * FROM users WHERE phone = ? OR email = ?').get(identifier, identifier);

    if (!user) {
      const isEmail = identifier.includes('@');
      const phoneVal = isEmail ? '9643116863' : identifier;
      const emailVal = isEmail ? identifier : `${identifier}@example.com`;
      const userName = name || (isEmail ? identifier.split('@')[0] : `Customer ${identifier.slice(-4)}`);

      const stmt = db.prepare('INSERT INTO users (name, phone, email) VALUES (?, ?, ?)');
      const info = stmt.run(userName, phoneVal, emailVal);
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
    }

    db.close();
    res.json({
      success: true,
      message: 'Login successful!',
      user
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get User Orders
app.get('/api/user/orders', (req, res) => {
  try {
    const { phone } = req.query;
    const db = getDb();

    let query = 'SELECT * FROM orders ORDER BY id DESC';
    const params = [];

    if (phone) {
      query = 'SELECT * FROM orders WHERE customer_phone = ? OR customer_email = ? ORDER BY id DESC';
      params.push(phone, phone);
    }

    const orders = db.prepare(query).all(...params);

    const formatted = orders.map(order => {
      const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
      return { ...order, items };
    });

    db.close();
    res.json({ success: true, data: formatted });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// ADMIN DASHBOARD ENDPOINTS
// -------------------------------------------------------------

// Analytics Overview
app.get('/api/admin/analytics', (req, res) => {
  try {
    const db = getDb();

    const totalSalesRow = db.prepare('SELECT SUM(total_amount) as totalSales, COUNT(*) as totalOrders FROM orders').get();
    const totalProductsRow = db.prepare('SELECT COUNT(*) as totalProducts FROM products').get();
    const wishlistRow = db.prepare('SELECT COUNT(*) as totalWishlist FROM wishlist_items').get();

    const salesByCategory = db.prepare(`
      SELECT p.category_slug, SUM(oi.price * oi.quantity) as revenue, COUNT(oi.id) as units_sold
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      GROUP BY p.category_slug
    `).all();

    const recentOrders = db.prepare('SELECT * FROM orders ORDER BY id DESC LIMIT 5').all();

    db.close();
    res.json({
      success: true,
      analytics: {
        totalSales: totalSalesRow.totalSales || 0,
        totalOrders: totalSalesRow.totalOrders || 0,
        totalProducts: totalProductsRow.totalProducts || 0,
        totalWishlist: wishlistRow.totalWishlist || 0,
        salesByCategory,
        recentOrders
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Product CRUD for Admin
app.post('/api/admin/products', (req, res) => {
  try {
    const { title, brand_name, category_slug, gender, price, mrp, colors, sizes, images, description, badge, stock_qty } = req.body;
    const db = getDb();

    const mrpVal = Number(mrp) || Number(price);
    const priceVal = Number(price);
    const discount = mrpVal > priceVal ? Math.round(((mrpVal - priceVal) / mrpVal) * 100) : 0;

    const stmt = db.prepare(`
      INSERT INTO products (
        title, brand_name, category_slug, gender, price, mrp, discount_percent, rating, review_count,
        colors_json, sizes_json, images_json, description, badge, stock_qty
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 4.5, 1, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      title, brand_name || 'Nykaa Brand', category_slug || 'westernwear', gender || 'Women',
      priceVal, mrpVal, discount,
      JSON.stringify(colors || ['#000000']),
      JSON.stringify(sizes || ['S', 'M', 'L']),
      JSON.stringify(images || ['https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&auto=format&fit=crop&q=80']),
      description || '', badge || null, Number(stock_qty) || 50
    );

    db.close();
    res.json({ success: true, message: 'Product created successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/admin/products/:id', (req, res) => {
  try {
    const { title, price, mrp, stock_qty, badge } = req.body;
    const db = getDb();

    const mrpVal = Number(mrp) || Number(price);
    const priceVal = Number(price);
    const discount = mrpVal > priceVal ? Math.round(((mrpVal - priceVal) / mrpVal) * 100) : 0;

    db.prepare(`
      UPDATE products 
      SET title = ?, price = ?, mrp = ?, discount_percent = ?, stock_qty = ?, badge = ?
      WHERE id = ?
    `).run(title, priceVal, mrpVal, discount, Number(stock_qty), badge || null, req.params.id);

    db.close();
    res.json({ success: true, message: 'Product updated' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/admin/products/:id', (req, res) => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
    db.close();
    res.json({ success: true, message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin 1-Click Database Reseed
app.post('/api/admin/reseed', (req, res) => {
  try {
    execSync('node db/seed.js');
    res.json({ success: true, message: 'Database reseeded successfully with fresh mock data!' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`Nykaa Fashion POC Server running on http://localhost:${PORT}`);
});

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'database.sqlite');
const scrapedJsonPath = path.join(__dirname, 'scraped_products.json');

// Ensure db directory exists
if (!fs.existsSync(__dirname)) {
  fs.mkdirSync(__dirname, { recursive: true });
}

const db = new Database(dbPath);

console.log('Initializing SQLite database schema...');

// Drop & Create Tables
db.exec(`
  DROP TABLE IF EXISTS cart_items;
  DROP TABLE IF EXISTS wishlist_items;
  DROP TABLE IF EXISTS order_items;
  DROP TABLE IF EXISTS orders;
  DROP TABLE IF EXISTS products;
  DROP TABLE IF EXISTS categories;
  DROP TABLE IF EXISTS brands;

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT UNIQUE NOT NULL,
    email TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    image_url TEXT
  );

  CREATE TABLE IF NOT EXISTS brands (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    logo_url TEXT
  );

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    brand_name TEXT NOT NULL,
    category_slug TEXT NOT NULL,
    gender TEXT NOT NULL,
    price REAL NOT NULL,
    mrp REAL NOT NULL,
    discount_percent INTEGER NOT NULL,
    rating REAL DEFAULT 4.5,
    review_count INTEGER DEFAULT 120,
    colors_json TEXT NOT NULL,
    sizes_json TEXT NOT NULL,
    images_json TEXT NOT NULL,
    description TEXT,
    badge TEXT,
    is_bestseller INTEGER DEFAULT 0,
    is_exclusive INTEGER DEFAULT 0,
    is_luxe INTEGER DEFAULT 0,
    stock_qty INTEGER DEFAULT 50,
    product_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS cart_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL DEFAULT 'default_user',
    product_id INTEGER NOT NULL,
    size TEXT NOT NULL,
    color TEXT,
    quantity INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS wishlist_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL DEFAULT 'default_user',
    product_id INTEGER NOT NULL UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_number TEXT NOT NULL UNIQUE,
    user_id INTEGER,
    customer_name TEXT NOT NULL,
    customer_email TEXT,
    customer_phone TEXT,
    address TEXT NOT NULL,
    pincode TEXT NOT NULL,
    payment_method TEXT NOT NULL,
    total_amount REAL NOT NULL,
    discount_amount REAL NOT NULL,
    status TEXT DEFAULT 'Processing',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    product_title TEXT NOT NULL,
    price REAL NOT NULL,
    quantity INTEGER NOT NULL,
    size TEXT NOT NULL,
    image_url TEXT,
    FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE
  );
`);

console.log('Seeding categories, brands, users, and real products...');

// Clear existing data
db.exec(`
  DELETE FROM users;
  DELETE FROM categories;
  DELETE FROM brands;
  DELETE FROM products;
  DELETE FROM cart_items;
  DELETE FROM wishlist_items;
  DELETE FROM orders;
  DELETE FROM order_items;
`);

// Seed Default User
const defaultUser = db.prepare(`
  INSERT INTO users (name, phone, email) VALUES ('Ananya Sharma', '9643116863', 'ananya.sharma@example.com')
`).run();
const defaultUserId = defaultUser.lastInsertRowid;

// Insert Categories
const insertCategory = db.prepare(`INSERT INTO categories (name, slug, image_url) VALUES (?, ?, ?)`);
const categories = [
  { name: 'Westernwear', slug: 'westernwear', image_url: 'https://adn-static1.nykaa.com/nykdesignstudio-images/pub/media/catalog/product/1/4/1403119TC0608CFRU_1.jpg?rnd=20200526195200&tr=w-800' },
  { name: 'Indianwear', slug: 'indianwear', image_url: 'https://adn-static1.nykaa.com/nykdesignstudio-images/pub/media/catalog/product/4/a/4a62267AGWILORIRani_1.jpg?rnd=20200526195200&tr=w-800' },
  { name: 'Men', slug: 'men', image_url: 'https://adn-static1.nykaa.com/nykdesignstudio-images/pub/media/catalog/product/5/a/5a6f3e04MSS262302_1.jpg?rnd=20200526195200&tr=w-800' },
  { name: 'Footwear', slug: 'footwear', image_url: 'https://adn-static1.nykaa.com/nykdesignstudio-images/pub/media/catalog/product/8/f/8f7ca5d102489TAN_1.jpg?rnd=20200526195200&tr=w-800' },
  { name: 'Bags', slug: 'bags', image_url: 'https://adn-static1.nykaa.com/nykdesignstudio-images/pub/media/catalog/product/1/5/15c9315NB_MIRAG00000837_1.jpg?rnd=20200526195200&tr=w-800' },
  { name: 'Jewellery', slug: 'jewellery', image_url: 'https://adn-static1.nykaa.com/nykdesignstudio-images/pub/media/catalog/product/9/3/9364e15PM-EARRINGS-032_1.jpg?rnd=20200526195200&tr=w-800' },
  { name: 'Kids', slug: 'kids', image_url: 'https://adn-static1.nykaa.com/nykdesignstudio-images/pub/media/catalog/product/b/d/bd072b11263629Beige_1.jpg?rnd=20200526195200&tr=w-800' },
  { name: 'Luxe', slug: 'luxe', image_url: 'https://adn-static1.nykaa.com/nykdesignstudio-images/pub/media/catalog/product/a/8/a85d2a030274002Pink_1.jpg?rnd=20200526195200&tr=w-800' }
];

categories.forEach(c => insertCategory.run(c.name, c.slug, c.image_url));

// Read scraped products JSON
let scrapedProducts = [];
if (fs.existsSync(scrapedJsonPath)) {
  scrapedProducts = JSON.parse(fs.readFileSync(scrapedJsonPath, 'utf8'));
}

// Insert Brands dynamically
const insertBrand = db.prepare(`INSERT OR IGNORE INTO brands (name) VALUES (?)`);
scrapedProducts.forEach(p => insertBrand.run(p.brand));

// Insert Real Products
const insertProduct = db.prepare(`
  INSERT INTO products (
    title, brand_name, category_slug, gender, price, mrp, discount_percent, rating, review_count, 
    colors_json, sizes_json, images_json, description, badge, is_bestseller, is_exclusive, is_luxe, stock_qty, product_url
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

scrapedProducts.forEach(p => {
  const isBestseller = (p.badge || '').includes('BESTSELLER') ? 1 : 0;
  const isExclusive = (p.badge || '').includes('EXCLUSIVE') || p.category === 'luxe' ? 1 : 0;
  const isLuxe = p.category === 'luxe' ? 1 : 0;

  let defaultSizes = ['S', 'M', 'L', 'XL'];
  if (p.category === 'bags' || p.category === 'jewellery') defaultSizes = ['One Size'];
  if (p.category === 'footwear') defaultSizes = ['UK 5', 'UK 6', 'UK 7', 'UK 8'];

  insertProduct.run(
    p.title,
    p.brand,
    p.category,
    p.gender || 'Women',
    p.price,
    p.mrp,
    p.discount,
    p.rating || 4.5,
    p.reviewsCount || 100,
    JSON.stringify(['#E80071', '#000000', '#FFFFFF']),
    JSON.stringify(defaultSizes),
    JSON.stringify([p.image]),
    `Official Nykaa Fashion item: ${p.title} by ${p.brand}. Authentic quality product.`,
    p.badge,
    isBestseller,
    isExclusive,
    isLuxe,
    p.stock_qty !== undefined ? p.stock_qty : Math.floor(Math.random() * 40) + 10,
    p.url || null
  );
});

// Seed sample wishlist & cart items
db.prepare(`INSERT INTO wishlist_items (session_id, product_id) VALUES ('default_user', 1)`).run();
db.prepare(`INSERT INTO wishlist_items (session_id, product_id) VALUES ('default_user', 6)`).run();
db.prepare(`INSERT INTO wishlist_items (session_id, product_id) VALUES ('default_user', 11)`).run();

db.prepare(`INSERT INTO cart_items (session_id, product_id, size, quantity) VALUES ('default_user', 16, 'One Size', 1)`).run();
db.prepare(`INSERT INTO cart_items (session_id, product_id, size, quantity) VALUES ('default_user', 21, 'UK 6', 1)`).run();

// Seed Sample Order for Ananya Sharma
const orderStmt = db.prepare(`
  INSERT INTO orders (order_number, user_id, customer_name, customer_email, customer_phone, address, pincode, payment_method, total_amount, discount_amount, status)
  VALUES ('NYK-984321', ?, 'Ananya Sharma', 'ananya.sharma@example.com', '9643116863', 'Flat 402, Lotus Apartments, MG Road', '400001', 'UPI', 3300, 699, 'Delivered')
`).run(defaultUserId);

db.prepare(`
  INSERT INTO order_items (order_id, product_id, product_title, price, quantity, size, image_url)
  VALUES (?, 16, 'Sabrina Wine Top Handle Sling Bag', 3300, 1, 'One Size', 'https://adn-static1.nykaa.com/nykdesignstudio-images/pub/media/catalog/product/1/5/15c9315NB_MIRAG00000837_1.jpg?rnd=20200526195200&tr=w-800')
`).run(orderStmt.lastInsertRowid);

console.log(`Database successfully updated with ${scrapedProducts.length} real Nykaa Fashion products, default user, and sample orders!`);
db.close();

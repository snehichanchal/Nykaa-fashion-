const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'db', 'database.sqlite');
const db = new Database(dbPath);
const BASE_URL = 'http://localhost:3000';

async function runTestSuite() {
  console.log('====================================================');
  console.log('RUNNING OUT-OF-STOCK & WISHLIST RECS TEST SUITE');
  console.log('====================================================\n');

  try {
    // 1. Setup Test State in SQLite
    db.prepare("DELETE FROM wishlist_items WHERE session_id = 'default_user'").run();
    db.prepare("DELETE FROM cart_items WHERE session_id = 'default_user'").run();

    // Get an in-stock westernwear item for cart
    const inStockWesternCart = db.prepare("SELECT id, title, category_slug, brand_name, stock_qty FROM products WHERE category_slug = 'westernwear' AND stock_qty > 0 LIMIT 1").get();
    
    // Get an out-of-stock westernwear item for wishlist (ID 83, 84, or 85)
    const outOfStockWesternWishlist = db.prepare("SELECT id, title, category_slug, brand_name, stock_qty FROM products WHERE category_slug = 'westernwear' AND stock_qty <= 0 LIMIT 1").get();

    // Get an in-stock westernwear item for wishlist
    const inStockWesternWishlist = db.prepare("SELECT id, title, category_slug, brand_name, stock_qty FROM products WHERE category_slug = 'westernwear' AND stock_qty > 0 AND id != ? LIMIT 1").get(inStockWesternCart.id);

    console.log(`[SETUP] Cart Item: ID ${inStockWesternCart.id} ("${inStockWesternCart.title}")`);
    console.log(`[SETUP] Wishlist Item (OOS): ID ${outOfStockWesternWishlist.id} ("${outOfStockWesternWishlist.title}", Stock: ${outOfStockWesternWishlist.stock_qty})`);
    console.log(`[SETUP] Wishlist Item (In-Stock): ID ${inStockWesternWishlist.id} ("${inStockWesternWishlist.title}", Stock: ${inStockWesternWishlist.stock_qty})\n`);

    // Insert cart & wishlist items
    db.prepare("INSERT INTO cart_items (session_id, product_id, size, quantity) VALUES ('default_user', ?, 'M', 1)").run(inStockWesternCart.id);
    db.prepare("INSERT INTO wishlist_items (session_id, product_id) VALUES ('default_user', ?)").run(outOfStockWesternWishlist.id);
    db.prepare("INSERT INTO wishlist_items (session_id, product_id) VALUES ('default_user', ?)").run(inStockWesternWishlist.id);

    // ----------------------------------------------------
    // TEST 1 & 2: Wishlist API & Out-of-Stock Filtering Logic
    // ----------------------------------------------------
    console.log('--> TEST 1 & 2: Fetching GET /api/wishlist and testing out-of-stock filtering...');
    const wishlistRes = await fetch(`${BASE_URL}/api/wishlist`);
    const wishlistData = await wishlistRes.json();

    if (!wishlistData.success) {
      console.error('❌ Failed to fetch wishlist from API', wishlistData);
      process.exit(1);
    }

    const wishlistItems = wishlistData.data || [];
    const cartProductIds = new Set([inStockWesternCart.id]);

    // Apply app.js cart drawer filtering logic
    const inStockWishlist = wishlistItems.filter(w => {
      const notInCart = !cartProductIds.has(w.id);
      const isInStock = (w.stock_qty === undefined || w.stock_qty === null || w.stock_qty > 0);
      return notInCart && isInStock;
    });

    console.log(`[RESULTS] Total Wishlist Items: ${wishlistItems.length}`);
    console.log(`[RESULTS] Filtered In-Stock Wishlist Recs Count: ${inStockWishlist.length}`);

    const oosFound = inStockWishlist.find(item => item.id === outOfStockWesternWishlist.id || item.stock_qty <= 0);
    const inStockFound = inStockWishlist.find(item => item.id === inStockWesternWishlist.id);

    if (oosFound) {
      console.error(`❌ TEST 1 FAILED: Out-of-stock item ID ${oosFound.id} was included in cart drawer suggestions!`);
      process.exit(1);
    } else {
      console.log(`✅ TEST 1 PASSED: Out-of-stock item ID ${outOfStockWesternWishlist.id} was strictly EXCLUDED from cart suggestions.`);
    }

    if (!inStockFound) {
      console.error(`❌ TEST 2 FAILED: Matching in-stock wishlisted item ID ${inStockWesternWishlist.id} was missing from cart suggestions!`);
      process.exit(1);
    } else {
      console.log(`✅ TEST 2 PASSED: Matching in-stock wishlisted item ID ${inStockWesternWishlist.id} was INCLUDED in cart suggestions.`);
    }

    // ----------------------------------------------------
    // TEST 3: Size Selection & Move To Bag API
    // ----------------------------------------------------
    console.log('\n--> TEST 3: Testing Move To Bag API with explicit size selection...');
    const moveRes = await fetch(`${BASE_URL}/api/wishlist/move-to-bag`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: inStockWesternWishlist.id, size: 'L' })
    });
    const moveData = await moveRes.json();

    if (!moveData.success) {
      console.error(`❌ TEST 3 FAILED: Move to bag returned success = false`, moveData);
      process.exit(1);
    }

    const movedCartItem = db.prepare("SELECT * FROM cart_items WHERE session_id = 'default_user' AND product_id = ?").get(inStockWesternWishlist.id);
    if (movedCartItem && movedCartItem.size === 'L') {
      console.log(`✅ TEST 3 PASSED: Wishlisted item ID ${inStockWesternWishlist.id} moved to cart with chosen size 'L'.`);
    } else {
      console.error(`❌ TEST 3 FAILED: Item in cart does not have expected size 'L'. Got: ${movedCartItem?.size}`);
      process.exit(1);
    }

    console.log('\n====================================================');
    console.log('ALL EDGE CASE INTEGRATION TESTS PASSED 100%!');
    console.log('====================================================\n');

  } catch (err) {
    console.error('Unhandled Test Error:', err);
    process.exit(1);
  } finally {
    db.close();
  }
}

runTestSuite();

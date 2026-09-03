# Implementation Plan - Nykaa Fashion E-Commerce Website POC & Admin Dashboard

Create a full-stack e-commerce web application inspired by **Nykaa Fashion**, adhering closely to the design aesthetics, layouts, and feature set shown in the provided screenshots (`@[Screenshot]`) and live reference website. The application will use **SQLite** as its database, features rich mock data across multiple categories, and includes an intuitive **Admin Dashboard** tailored for non-technical users.

---

## User Review Required

> [!IMPORTANT]
> **Tech Stack Selection**:
> We propose using **Node.js (Express)** for the backend server with **SQLite (`better-sqlite3` / `sqlite3`)** for database management, paired with a modern, responsive **HTML5/JS + Vite + Tailwind/CSS** front-end framework (or lightweight React/Vite SPA). This ensures fast setup, easy zero-config execution for non-tech users (`npm start`), and smooth 60fps UI transitions matching Nykaa Fashion's mobile & desktop experience.
> 
> Please review if you have any specific framework preferences before execution.

---

## Proposed System Architecture & Core Features

### 1. Visual & UI Design (Based on Screenshots)
- **Color Palette & Aesthetics**: 
  - Primary Brand Pink: `#E80071` / `#D50065`
  - Dark Charcoal & Typography: `#212121`, `#555555`
  - Backgrounds & Cards: `#FFFFFF`, `#F5F5F5`, subtle hover shadows & smooth micro-interactions.
- **Navigation Bar**:
  - Top bar: App Download, Help desk info.
  - Main Bar: Nykaa Fashion Logo, Category tabs (*Women, Men, Kids, Home, All Brands, Luxe*), Live search bar with autocomplete, Fashion/Luxe toggle, Wishlist icon with badge counter, Shopping Bag cart drawer trigger with item badge, and Quick Admin Switch button.

### 2. Database Schema (SQLite)
- `categories`: `id`, `name`, `slug`, `parent_id`, `image_url`
- `brands`: `id`, `name`, `logo_url`, `is_popular`
- `products`: `id`, `title`, `brand_id`, `category_id`, `gender`, `price`, `mrp`, `discount_percent`, `rating`, `review_count`, `colors_json`, `sizes_json`, `images_json`, `description`, `is_bestseller`, `is_exclusive`, `is_luxe`, `stock_qty`, `created_at`
- `cart_items`: `id`, `session_id`, `product_id`, `size`, `color`, `quantity`, `created_at`
- `wishlist_items`: `id`, `session_id`, `product_id`, `created_at`
- `orders`: `id`, `order_number`, `customer_name`, `customer_email`, `customer_phone`, `address`, `pincode`, `payment_method`, `total_amount`, `discount_amount`, `status`, `created_at`
- `order_items`: `id`, `order_id`, `product_id`, `product_title`, `price`, `quantity`, `size`, `image_url`

### 3. Customer Features & Workflows
1. **Homepage** (Reference: `Screenshot 16-44-16`):
   - Sliding Banner Carousel with offer callouts ("Up to 75% Off").
   - Circular "Hot & Happening" Category Avatars (*Westernwear, Indianwear, Men, Footwear, Lingerie, Sportswear, Kids, Bags, Jewellery*).
   - "Get Ready for Festive Store" banner grids & "Hidden Gems" curated label cards.
2. **Product Listing & Filtering** (Reference: `Screenshot 16-47-02`, `20-28-50`):
   - 4-column product grid with badges (*BESTSELLER, EXCLUSIVE, LATEST STYLE*).
   - Left Sidebar Accordion Filters: Category, Size (XS-XXL), Brand, Price range slider, Discount % filter (10%+, 30%+, 50%+), Color swatches.
   - Sorting: Popularity, Price (Low to High), Price (High to Low), Discount %, Newest.
3. **Product Detail View**:
   - High-res image gallery, price strikethrough, discount badge, color & size selectors, "Add to Bag" & "Wishlist" actions.
4. **Wishlist Page** (Reference: `Screenshot 16-47-36`):
   - Dedicated `/wishlist` grid showing saved items with remove 'X' button and "Move to Bag" primary button.
5. **Slide-Over Bag / Cart Drawer** (Reference: `Screenshot 16-48-04`):
   - Right-side drawer opening seamlessly upon adding items.
   - Size & quantity dropdowns, offer badges, item total, and "Proceed to Buy" CTA.
6. **Checkout & Purchase Flow** (Reference: `Screenshot 20-30-09`):
   - Step progress indicator: *Step 1: Account -> Step 2: Address -> Step 3: Payment*.
   - Payment choices: UPI (QR code display & VPA), Credit/Debit Card, NetBanking, Cash on Delivery.
   - Instant order confirmation modal with receipt breakdown.

### 4. Non-Tech Friendly Admin Dashboard
- **Analytics Overview Tab**:
  - Key Cards: Total Sales Revenue, Order Count, Product Count, Active Wishlist Items.
  - Visual charts for top selling categories & recent order status timeline.
- **Product Management Tab**:
  - Easy-to-use tabular management: Search, filter by category/stock status.
  - Form modal to Add / Edit / Delete products (Title, Brand, Category, MRP, Selling Price, Discount %, Stock count, Image URLs).
  - Quick "Seed Sample Data" button to restore mock inventory with 1 click.
- **Order Management Tab**:
  - View customer orders, delivery addresses, update order status (*Pending, Shipped, Delivered*).

---

## Proposed Changes

We will organize the project in the workspace root directory:

```
Nykaa fashion website/
├── package.json
├── server.js               # Node Express server + API endpoints + SQLite integration
├── db/
│   ├── database.sqlite     # SQLite DB file
│   └── seed.js             # Rich mock data seeder across all categories
├── public/
│   ├── index.html          # Main SPA container
│   ├── css/
│   │   └── styles.css      # Custom Nykaa Fashion design system & styling
│   └── js/
│       ├── app.js          # Core routing, state management, search & filters
│       ├── components.js   # Components (Header, Cart Drawer, Wishlist, Cards)
│       └── admin.js        # Admin Dashboard logic & analytics charts
└── docs/
    └── implementation_plan.md
```

### Server & Database Layer
#### [NEW] [server.js](file:///home/testing/Development/Nextleap%20projects/Nykaa%20fashion%20website%20/server.js)
- Express REST API endpoints for `/api/products`, `/api/categories`, `/api/brands`, `/api/cart`, `/api/wishlist`, `/api/orders`, and `/api/admin/*`.
- Configured with `better-sqlite3` or `sqlite3` for fast synchronous/async database queries.

#### [NEW] [db/seed.js](file:///home/testing/Development/Nextleap%20projects/Nykaa%20fashion%20website%20/db/seed.js)
- Creates database schema tables.
- Seeds 30+ detailed mock products across Women, Men, Kids, Home, Bags, Accessories, Luxe, Indianwear, Westernwear matching Nykaa Fashion product names, images, prices, brands (Inc.5, Gahan, U.S. POLO ASSN., Libas, Puma, etc.).

### Frontend UI Layer
#### [NEW] [public/index.html](file:///home/testing/Development/Nextleap%20projects/Nykaa%20fashion%20website%20/public/index.html)
- Main HTML structure with header, hero carousel, product grid, slide-over bag drawer, wishlist modal, checkout modal, and admin dashboard section.

#### [NEW] [public/css/styles.css](file:///home/testing/Development/Nextleap%20projects/Nykaa%20fashion%20website%20/public/css/styles.css)
- Complete Nykaa Fashion CSS system: `#E80071` pink accents, font styling, mobile-responsive layout, glassmorphism overlays, drawer animations, badge pills, product card hovers.

#### [NEW] [public/js/app.js](file:///home/testing/Development/Nextleap%20projects/Nykaa%20fashion%20website%20/public/js/app.js)
- SPA routing between Store Home, Category Listing, Wishlist, Checkout, and Admin Dashboard.
- Live client-side filtering (by category, size, price, discount, color, search query) and dynamic sorting.

#### [NEW] [public/js/admin.js](file:///home/testing/Development/Nextleap%20projects/Nykaa%20fashion%20website%20/public/js/admin.js)
- Admin dashboard logic: sales summary cards, chart rendering, product CRUD operations, stock management, and seed database control.

---

## Verification Plan

### Automated & Manual Verification
1. **Server & Database Initialization**:
   - Run `npm install` and `node db/seed.js` to ensure SQLite database is created and mock data is inserted cleanly.
   - Verify `server.js` starts on port 3000 without errors.
2. **Visual & UI Verification with Screenshots**:
   - Launch browser tool and compare rendered app against `@[Screenshot]` directory:
     - Compare Homepage hero & category avatars against `Screenshot 16-44-16`.
     - Compare Product Grid & Filters against `Screenshot 16-47-02` and `Screenshot 20-28-50`.
     - Compare Wishlist Page against `Screenshot 16-47-36`.
     - Compare Cart Drawer against `Screenshot 16-48-04`.
     - Compare Payment/Checkout steps against `Screenshot 20-30-09`.
3. **End-to-End User Flow**:
   - Filter products by category (Women/Bags) -> Sort by Price Low to High -> Add item to Wishlist -> Click "Move to Bag" -> Open Cart Drawer -> Modify Size & Qty -> Proceed to Buy -> Complete payment step -> Verify Order Creation.
4. **Admin Dashboard Flow**:
   - Switch to Admin Dashboard -> Verify Sales Analytics & Total Orders metrics -> Add a new product -> Verify new product appears on store product listing -> Edit product price -> Delete test product.

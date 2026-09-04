# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install                # Node deps (better-sqlite3, express, cors)
node db/seed.js            # DROP + recreate all tables and reseed from db/scraped_products.json
npm start                  # Express server on PORT (default 3000)

pip install -r requirements.txt
streamlit run app.py       # Streamlit wrapper (boots server.js as a subprocess, iframes it)
```

- Storefront: `http://localhost:3000/`, Admin portal: `http://localhost:3000/admin`
- There is no test suite and no linter. `npm test` is a stub that exits 1. Verification in this repo is manual/browser-driven; results are recorded in `docs/edgecase.md`.
- `db/seed.js` is destructive — it drops `products`, `categories`, `brands`, `cart_items`, `wishlist_items`, `orders`, `order_items` (but not `users`). Only run it when losing cart/order state is acceptable.

## Architecture

Three layers, no build step anywhere:

1. **`server.js`** — a single-file Express 5 REST API plus static host for `public/`. Every handler opens its own `better-sqlite3` connection via `getDb()`, runs synchronous prepared statements, and calls `db.close()` before responding. All responses use the envelope `{ success: boolean, data?|error? }`; the frontend checks `data.success` everywhere, so keep that shape when adding routes. `POST /api/admin/reseed` shells out to `node db/seed.js` via `execSync`.

2. **`public/js/app.js`** — the whole storefront is one global object literal `app` with a `state` bag (filters, search, sort, products, cart, wishlist, `currentUser`). There is no framework and no router: handlers mutate `app.state`, then call a `render*()` method that rewrites `innerHTML`. `index.html` wires events with inline `onclick="app.…"`, so method names are part of the public contract — renaming one silently breaks the HTML. `app.init()` fetches categories → brands → products → wishlist → cart in sequence on load. `public/js/admin.js` is a separate, smaller instance of the same pattern for `admin.html`.

3. **`db/`** — `database.sqlite` is committed to the repo. Products denormalize their arrays into JSON strings (`colors_json`, `sizes_json`, `images_json`); the client `JSON.parse`s them. Cart and wishlist rows are keyed by `session_id`, which is hardcoded to `'default_user'` throughout — there is no real per-user session, even though `users`/`orders` exist and the frontend stores a user in `localStorage` under `nykaa_user`.

**`app.py`** is a deployment shim for Streamlit Community Cloud only: it spawns `node server.js` as a background subprocess (cached with `@st.cache_resource`), polls `/api/categories` until healthy, hides all Streamlit chrome via injected CSS, and renders the storefront in a full-width iframe. It adds no application logic — never put features there.

## Domain behaviors that are easy to break

- **Wishlist prioritization** is the app's signature feature. On the homepage (`category === 'all'`, no search), `renderHomepageBlocks()` builds three curated blocks (Trending / On Sale / Spotlight) and hoists wishlisted items to first position with a pink `wishlist-featured-card` and a MOVE TO BAG CTA. During a search, `renderProducts()` does the same for wishlist items matching the searched category, and suppresses the block entirely when nothing matches. Filtered views suppress the blocks.
- **Cart removal never deletes directly.** The `✕` on a cart row opens `#removeCartModal` ("Are you sure?") offering *Move to wishlist* vs *Remove*. Moving to wishlist must tolerate the item already being wishlisted.
- **Auth is a demo stub**: `/api/auth/send-otp` returns the OTP in the response body, and `verify-otp` accepts only `1234` or `0000`.

`docs/architecture.md` holds the full schema ER diagram and endpoint table; `docs/edgecase.md` is the manual test matrix — update it when changing search, cart/wishlist sync, or the removal modal.

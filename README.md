# 🛍️ Nykaa Fashion — E-Commerce Platform

A full-stack Nykaa Fashion storefront: a vanilla JS single-page shopfront, an Express REST API, and a SQLite catalog of 85 real scraped products — plus an admin portal for inventory and sales.

> Looking for a walkthrough of the **shopping features** (wishlist, cart, checkout)? See [`docs/readme.md`](docs/readme.md).
> Looking for the **system design**? See [`docs/architecture.md`](docs/architecture.md).

---

## Requirements

- **Node.js 20 or newer** (tested on 24 and 26)
- npm

No database server to install — the app uses a file-backed SQLite database that is committed to the repo, already populated.

---

## Quick start

```bash
npm install     # required on a fresh clone — node_modules is gitignored
npm start
```

Then open:

| | URL |
| :--- | :--- |
| **Storefront** | <http://localhost:3000/> |
| **Admin portal** | <http://localhost:3000/admin> |

That's it. `npm install` is not optional on a fresh clone: `node_modules/` is gitignored, and skipping it fails with `Cannot find module 'better-sqlite3'`.

You do **not** need to seed the database first — `db/database.sqlite` ships populated.

---

## Commands

| Command | What it does |
| :--- | :--- |
| `npm install` | Install dependencies. Run once per clone, and after any dependency change. |
| `npm start` | Start the server on port 3000 (`npm run dev` is identical). |
| `npm run seed` | ⚠️ **Destructive.** Wipe and rebuild the database — see below. |
| `node tests/test_out_of_stock_wishlist.js` | Integration test suite (needs the server running). |

`npm test` is an unimplemented placeholder that exits 1. Use the test command above instead.

### Changing the port

The server reads `PORT` from the environment:

```bash
PORT=8080 npm start
```

### ⚠️ About `npm run seed`

`db/seed.js` begins with `DROP TABLE` on products, categories, brands, cart, wishlist, **and orders**, then reloads 85 products from `db/scraped_products.json`. It destroys all order history and any catalog edits made through the admin portal.

Run it only when you deliberately want a factory reset — never as part of routine startup, and never as a deploy step. The admin portal's **Reseed Sample Inventory** button does the same thing.

To undo an accidental reseed, restore the committed database:

```bash
git checkout -- db/database.sqlite
```

---

## Accessing it from another device

The server listens on all interfaces (`*:3000`, dual-stack IPv4 + IPv6) by default, so no extra configuration is needed. From another machine, substitute this host's address:

```
http://<host-ip-or-hostname>:3000/
```

Two things that commonly go wrong:

- **Type the `http://` prefix explicitly.** The app serves plain HTTP only. A bare hostname such as `myhost:3000` may be auto-upgraded to HTTPS by the browser, which fails against an HTTP port with a TLS error.
- **Check the host firewall** allows inbound TCP on your chosen port. Testing with `curl` from the *same* machine routes over loopback and bypasses the firewall entirely, so it will succeed even when remote access is blocked — verify from the other device.

---

## Running the tests

Start the server in one terminal, then in another:

```bash
node tests/test_out_of_stock_wishlist.js
```

It covers out-of-stock filtering in cart suggestions, wishlist-match inclusion, and move-to-bag with size selection.

Note that it **writes to the real database** — it clears the cart and wishlist for the `default_user` session as setup. Restore afterward with `git checkout -- db/database.sqlite`.

---

## Project layout

```
├── server.js          # Express REST API + static host for public/
├── public/            # Frontend — no build step, no framework
│   ├── index.html     # Storefront SPA          │  js/app.js
│   ├── admin.html     # Admin dashboard         │  js/admin.js
│   └── css/styles.css
├── db/
│   ├── database.sqlite       # Committed, pre-populated
│   ├── scraped_products.json # Source catalog data
│   └── seed.js               # Destructive schema + seed script
├── tests/             # Integration tests (require a running server)
└── docs/              # Feature guide, architecture, deployment, edge cases
```

There is no build step and no bundler. Edit files under `public/` and reload the browser.

---

## Deploying

`app.py`, `requirements.txt`, and `packages.txt` exist only for a Streamlit-hosted deployment, where `app.py` boots `server.js` as a subprocess and embeds the storefront in an iframe. They add no application logic.

⚠️ **Their presence at the repo root causes some hosts (Render included) to autodetect this as a Python project**, run `pip install`, never run `npm install`, and then fail with `Cannot find module 'better-sqlite3'`. On such a host, set the runtime to **Node** explicitly:

- Build command: `npm ci`
- Start command: `npm start` — *not* `npm run seed && npm start`, which erases all orders on every restart

Also note that SQLite writes are lost on hosts with an ephemeral filesystem: orders, cart, and wishlist reset to the committed database on each restart or redeploy. That is fine for a demo; persistence would need a mounted disk or a move to Postgres.

See [`docs/deployment.md`](docs/deployment.md) for the Streamlit path.

# End-to-end test suite

Headless-browser tests that drive the real storefront and admin portal with
Puppeteer, against a running server and the real SQLite database.

## Running

The server must already be up. From the repo root:

```bash
npm start                      # terminal 1
node tests/e2e/run.js          # terminal 2
```

First run only, install the browser and test dependencies:

```bash
cd tests/e2e && npm install && npx puppeteer browsers install chrome
```

### Options

| Command | Effect |
| :--- | :--- |
| `node tests/e2e/run.js` | Run every spec. |
| `node tests/e2e/run.js 04` | Run only specs whose filename contains `04`. |
| `HEADED=1 node tests/e2e/run.js` | Show the browser window instead of running headless. |
| `E2E_BASE_URL=http://host:3000 node tests/e2e/run.js` | Target a different origin. |

Exit code is 0 when everything passes, 1 otherwise. Failures write a screenshot
to `tests/e2e/artifacts/`.

## Safety

The suite writes to the real `db/database.sqlite` — it places orders, edits the
cart, and creates products. `run.js` copies the database before the run and
restores it in a `finally` block, so an interrupted or failing run still leaves
the database as it found it. Cart and wishlist are also cleared before each
individual test so tests cannot leak state into each other.

## Layout

```
tests/e2e/
├── run.js              # runner: server check, DB snapshot/restore, reporting
├── lib/
│   ├── harness.js      # tiny assertion library (no jest/mocha dependency)
│   └── app-driver.js   # selectors + page helpers shared by all specs
├── specs/
│   ├── 01-homepage.spec.js    # catalog render, category filter, sort, images
│   ├── 02-search.spec.js      # keyword, casing, special chars, injection, clearing
│   ├── 03-wishlist.spec.js    # toggle, persistence, dot indicator, remove confirm
│   ├── 04-cart.spec.js        # size gate, quantity, price maths, remove modal
│   ├── 05-checkout.spec.js    # order placement, order history, OTP auth
│   ├── 06-admin.spec.js       # dashboard tiles, inventory table, product create
│   └── 07-responsive.spec.js  # horizontal overflow at mobile/tablet/desktop
└── artifacts/          # failure screenshots (gitignored)
```

`puppeteer` is declared in `tests/e2e/package.json` rather than the root
manifest, deliberately: the root `package.json` is what a host installs to
deploy the app, and a ~200 MB browser download has no business in that build.

## Writing a spec

A spec exports a name and a list of tests. Each test gets a fresh page with a
clean cart and wishlist:

```js
module.exports = {
  name: 'My feature',
  tests: [{
    name: 'does the thing',
    async fn(page, { assert }) {
      await openStore(page);
      assert.equal(await count(page, '.product-card'), 12, 'wrong card count');
    },
  }],
};
```

A test also fails if the page logs any uncaught JS error, even when every
assertion passes — a silent `TypeError` during render is a real defect.

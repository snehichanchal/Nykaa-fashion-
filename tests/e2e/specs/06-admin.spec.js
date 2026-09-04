'use strict';

const { BASE_URL, textOf, count } = require('../lib/app-driver');

async function openAdmin(page) {
  await page.goto(BASE_URL + '/admin', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelectorAll('#adminProductTableBody tr').length > 0, { timeout: 20000 });
}

module.exports = {
  name: 'Admin portal',
  tests: [
    {
      name: 'dashboard loads with the product inventory table',
      async fn(page, { assert }) {
        await openAdmin(page);
        const rows = await count(page, '#adminProductTableBody tr');
        assert.greater(rows, 0, 'no product rows rendered in the admin table');
      },
    },
    {
      name: 'analytics tiles show real numbers, not placeholders',
      async fn(page, { assert }) {
        await openAdmin(page);
        for (const id of ['#adminTotalSales', '#adminTotalOrders', '#adminTotalProducts', '#adminTotalWishlist']) {
          const text = (await textOf(page, id)) || '';
          assert.ok(text.length > 0, `${id} is empty`);
          assert.ok(!/^(-|–|NaN|undefined|null)$/i.test(text.trim()), `${id} shows a placeholder: ${text}`);
          assert.ok(!text.includes('NaN'), `${id} contains NaN: ${text}`);
        }
      },
    },
    {
      name: 'product count tile agrees with the API',
      async fn(page, { assert }) {
        await openAdmin(page);
        const shown = (await textOf(page, '#adminTotalProducts')).replace(/[^\d]/g, '');
        const actual = await page.evaluate(async () => (await (await fetch('/api/products')).json()).data.length);
        assert.equal(Number(shown), actual, 'admin product tile disagrees with /api/products');
      },
    },
    {
      name: 'creating a product adds it to the catalog',
      async fn(page, { assert }) {
        await openAdmin(page);
        const before = await page.evaluate(async () => (await (await fetch('/api/products')).json()).data.length);

        const title = `E2E Probe ${Date.now()}`;
        const ok = await page.evaluate(async (t) => {
          const res = await fetch('/api/admin/products', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: t, brand_name: 'E2E', category_slug: 'westernwear', price: 999, mrp: 1999, stock_qty: 5 }),
          });
          return (await res.json()).success;
        }, title);
        assert.ok(ok, 'admin product creation API rejected the request');

        const after = await page.evaluate(async () => (await (await fetch('/api/products')).json()).data.length);
        assert.equal(after, before + 1, 'catalog size did not grow after creating a product');

        await openAdmin(page);
        const table = await textOf(page, '#adminProductTableBody');
        assert.includes(table, 'E2E Probe', 'newly created product not visible in the admin table');
      },
    },
    {
      name: 'storefront link on the admin page points at the store',
      async fn(page, { assert }) {
        await openAdmin(page);
        const href = await page.$eval('a[href="/"], a[href="index.html"], a[href="/index.html"]', (el) => el.getAttribute('href')).catch(() => null);
        assert.ok(href, 'no link back to the storefront found on the admin page');
      },
    },
  ],
};

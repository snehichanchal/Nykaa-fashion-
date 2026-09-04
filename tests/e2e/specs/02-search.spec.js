'use strict';

const { sel, openStore, state, textOf, count, search } = require('../lib/app-driver');

module.exports = {
  name: 'Search',
  tests: [
    {
      name: 'a real keyword returns only matching products',
      async fn(page, { assert }) {
        await openStore(page);
        await search(page, 'dress');
        const products = await state(page, 'products');
        assert.greater(products.length, 0, 'search for "dress" returned nothing');

        const misses = products.filter((p) => {
          const hay = `${p.title} ${p.brand_name} ${p.description} ${p.category_slug} ${p.gender}`.toLowerCase();
          return !hay.includes('dress');
        });
        assert.equal(misses.length, 0, `${misses.length} results do not match the query`);
      },
    },
    {
      name: 'search is case-insensitive',
      async fn(page, { assert }) {
        await openStore(page);
        await search(page, 'dReSs');
        const upper = (await state(page, 'products')).length;
        await search(page, 'dress');
        const lower = (await state(page, 'products')).length;
        assert.equal(upper, lower, 'mixed-case search returned a different result count');
      },
    },
    {
      name: 'special characters do not crash the page',
      async fn(page, { assert }) {
        await openStore(page);
        await search(page, '!@#$%^&*()');
        const products = await state(page, 'products');
        assert.equal(products.length, 0, 'garbage query unexpectedly matched products');
        const grid = await textOf(page, sel.productGrid);
        assert.includes(grid, 'No products found', 'empty state not shown for a no-result search');
      },
    },
    {
      name: 'a SQL-injection style query is handled as literal text',
      async fn(page, { assert }) {
        await openStore(page);
        await search(page, "'; DROP TABLE products; --");
        // The catalog must still be intact afterwards.
        const total = await page.evaluate(async () => {
          const r = await fetch('/api/products');
          return (await r.json()).data.length;
        });
        assert.greater(total, 50, 'product table looks damaged after an injection-style query');
      },
    },
    {
      name: 'whitespace-only query is treated as empty',
      async fn(page, { assert }) {
        await openStore(page);
        const baseline = (await state(page, 'products')).length;
        await search(page, '   ');
        const after = (await state(page, 'products')).length;
        assert.equal(after, baseline, 'whitespace query should show the full catalog');
      },
    },
    {
      name: 'clearing the search restores the full catalog and heading',
      async fn(page, { assert }) {
        await openStore(page);
        const baseline = (await state(page, 'products')).length;
        await search(page, 'saree');
        await search(page, '');
        const restored = (await state(page, 'products')).length;
        assert.equal(restored, baseline, 'catalog not restored after clearing search');
        const heading = await textOf(page, sel.listingTitle);
        assert.ok(!heading.includes('Search Results'), `heading still shows a search state: ${heading}`);
      },
    },
    {
      name: 'result count label matches the number of cards rendered',
      async fn(page, { assert }) {
        await openStore(page);
        await search(page, 'bag');
        const products = (await state(page, 'products')).length;
        const cards = await count(page, `${sel.productGrid} ${sel.productCard}`);
        assert.equal(cards, products, 'rendered card count does not match state.products');
      },
    },
  ],
};

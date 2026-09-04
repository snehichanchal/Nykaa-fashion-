'use strict';

const { sel, openStore, state, count, textOf, withProductRefetch } = require('../lib/app-driver');

module.exports = {
  name: 'Homepage & catalog',
  tests: [
    {
      name: 'renders the product grid from the API',
      async fn(page, { assert }) {
        await openStore(page);
        const cards = await count(page, sel.productCard);
        assert.greater(cards, 0, 'no product cards rendered');
        const products = await state(page, 'products');
        assert.greater(products.length, 50, 'catalog looks unexpectedly small');
      },
    },
    {
      name: 'shows all three curated showcase blocks',
      async fn(page, { assert }) {
        await openStore(page);
        const blocks = await textOf(page, sel.homepageBlocks);
        for (const title of ['Trending Now', 'On Sale & Offers', 'In The Spotlight']) {
          assert.includes(blocks, title, `showcase block "${title}" missing`);
        }
      },
    },
    {
      name: 'every card shows a title, price and image',
      async fn(page, { assert }) {
        await openStore(page);
        const bad = await page.$$eval(sel.productCard, (cards) =>
          cards.slice(0, 30).map((c, i) => {
            const title = c.querySelector('.product-title')?.innerText.trim();
            const price = c.querySelector('.current-price')?.innerText.trim();
            const img = c.querySelector('.product-img');
            const problems = [];
            if (!title) problems.push('no title');
            if (!price || !price.includes('₹')) problems.push(`bad price ${JSON.stringify(price)}`);
            if (!img || !img.getAttribute('src')) problems.push('no image src');
            return problems.length ? `card ${i}: ${problems.join(', ')}` : null;
          }).filter(Boolean)
        );
        assert.equal(bad.length, 0, `malformed cards:\n      ${bad.join('\n      ')}`);
      },
    },
    {
      name: 'no product image 404s',
      async fn(page, { assert }) {
        const broken = await page.evaluate(async () => {
          const res = await fetch('/api/products');
          const { data } = await res.json();
          const bad = [];
          for (const p of data.slice(0, 25)) {
            const src = (p.images || [])[0];
            if (!src) { bad.push(`${p.id} has no image`); continue; }
            const ok = await new Promise((resolve) => {
              const img = new Image();
              img.onload = () => resolve(true);
              img.onerror = () => resolve(false);
              img.src = src;
              setTimeout(() => resolve(true), 6000); // slow CDN is not a defect
            });
            if (!ok) bad.push(`${p.id} "${p.title}" -> ${src}`);
          }
          return bad;
        });
        assert.equal(broken.length, 0, `broken product images:\n      ${broken.join('\n      ')}`);
      },
    },
    {
      name: 'category filter narrows the grid and updates the heading',
      async fn(page, { assert }) {
        await openStore(page);
        await withProductRefetch(page, () => page.evaluate(() => app.filterByCategory('jewellery')));

        const products = await state(page, 'products');
        const offCategory = products.filter((p) => p.category_slug !== 'jewellery');
        assert.equal(offCategory.length, 0, `category filter leaked ${offCategory.length} non-jewellery products`);

        const heading = await textOf(page, sel.listingTitle);
        assert.includes(heading.toLowerCase(), 'jewellery', 'heading did not follow the category');
      },
    },
    {
      name: 'showcase blocks hide once a category filter is active',
      async fn(page, { assert }) {
        await openStore(page);
        await withProductRefetch(page, () => page.evaluate(() => app.filterByCategory('bags')));
        const blocksText = (await textOf(page, sel.homepageBlocks)) || '';
        assert.equal(blocksText.trim(), '', 'showcase blocks should be suppressed in a filtered view');
      },
    },
    {
      name: 'sorting by price ascending actually orders the grid',
      async fn(page, { assert }) {
        await openStore(page);
        await withProductRefetch(page, () => page.select('#sortSelect', 'price_asc'));
        const prices = (await state(page, 'products')).map((p) => p.price);
        const sorted = [...prices].sort((a, b) => a - b);
        assert.equal(JSON.stringify(prices), JSON.stringify(sorted), 'products are not in ascending price order');
      },
    },
  ],
};

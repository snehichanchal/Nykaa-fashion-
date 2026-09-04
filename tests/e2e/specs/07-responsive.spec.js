'use strict';

const { BASE_URL, sel, openStore, addCardToBag, waitForVisible } = require('../lib/app-driver');
// Geometry probes live in lib/layout.js so this spec and 08-mobile-tablet
// measure containment the same way.
const { horizontalOverflow, offscreenControls } = require('../lib/layout');

const VIEWPORTS = [
  { name: 'mobile',  width: 390,  height: 844 },
  { name: 'tablet',  width: 820,  height: 1180 },
  { name: 'desktop', width: 1440, height: 900 },
];

const SWEEP = [1440, 1300, 1200, 1150, 1100, 1000, 900, 820, 768, 600, 480, 390, 360];

module.exports = {
  name: 'Responsive layout',
  tests: [
    {
      name: 'header controls stay inside the viewport at every width',
      async fn(page, { assert }) {
        const broken = [];
        for (const width of SWEEP) {
          await page.setViewport({ width, height: 900 });
          await openStore(page);
          const off = await offscreenControls(page);
          if (off.length) broken.push(`  ${width}px: ${off.join('; ')}`);
        }
        assert.equal(broken.length, 0, `header controls pushed off-screen:\n${broken.join('\n')}`);
      },
    },
  ].concat(VIEWPORTS.map((vp) => ({
    name: `storefront has no horizontal overflow at ${vp.name} (${vp.width}px)`,
    async fn(page, { assert }) {
      await page.setViewport({ width: vp.width, height: vp.height });
      await openStore(page);
      const overflow = await horizontalOverflow(page);
      assert.equal(overflow, null, overflow || '');
    },
  })).concat([
    {
      name: 'cart drawer stays within the viewport on mobile',
      async fn(page, { assert }) {
        await page.setViewport({ width: 390, height: 844 });
        await openStore(page);
        await addCardToBag(page, 0);
        await waitForVisible(page, sel.cartDrawer);
        // The drawer slides in over 0.3s; measuring mid-transform reads the
        // off-canvas position rather than the final one.
        await page.evaluate((s) => new Promise((resolve) => {
          const el = document.querySelector(s);
          const done = () => resolve();
          el.addEventListener('transitionend', done, { once: true });
          setTimeout(done, 1000);
        }), sel.cartDrawer);

        const box = await page.$eval(sel.cartDrawer, (el) => {
          const r = el.getBoundingClientRect();
          return { left: r.left, right: r.right, width: r.width };
        });
        assert.ok(box.width <= 390, `cart drawer is ${Math.round(box.width)}px wide on a 390px viewport`);
        assert.ok(box.right <= 391, `cart drawer overflows the right edge by ${Math.round(box.right - 390)}px`);
      },
    },
    {
      name: 'admin table is scrollable rather than overflowing on mobile',
      async fn(page, { assert }) {
        await page.setViewport({ width: 390, height: 844 });
        await page.goto(BASE_URL + '/admin', { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => document.querySelectorAll('#adminProductTableBody tr').length > 0, { timeout: 20000 });
        const overflow = await horizontalOverflow(page);
        assert.equal(overflow, null, overflow || '');
      },
    },
  ])),
};

'use strict';

const { BASE_URL, sel, openStore, addCardToBag, waitForVisible } = require('../lib/app-driver');

const VIEWPORTS = [
  { name: 'mobile',  width: 390,  height: 844 },
  { name: 'tablet',  width: 820,  height: 1180 },
  { name: 'desktop', width: 1440, height: 900 },
];

/** Horizontal overflow is the classic responsive break. */
async function horizontalOverflow(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const overflowBy = doc.scrollWidth - doc.clientWidth;
    if (overflowBy <= 1) return null;
    // Identify the widest offender so the failure is actionable.
    const worst = [...document.querySelectorAll('body *')]
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter(({ r }) => r.width > 0 && r.right > doc.clientWidth + 1)
      .sort((a, b) => b.r.right - a.r.right)[0];
    const desc = worst
      ? `${worst.el.tagName.toLowerCase()}.${String(worst.el.className || '').split(' ').filter(Boolean).join('.')} extends to ${Math.round(worst.r.right)}px`
      : 'unknown element';
    return `page overflows by ${overflowBy}px (viewport ${doc.clientWidth}px) — ${desc}`;
  });
}

module.exports = {
  name: 'Responsive layout',
  tests: VIEWPORTS.map((vp) => ({
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
  ]),
};

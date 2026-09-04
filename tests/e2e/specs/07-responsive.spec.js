'use strict';

const { BASE_URL, sel, openStore, addCardToBag, waitForVisible } = require('../lib/app-driver');

const VIEWPORTS = [
  { name: 'mobile',  width: 390,  height: 844 },
  { name: 'tablet',  width: 820,  height: 1180 },
  { name: 'desktop', width: 1440, height: 900 },
];

/**
 * Detect content that spills outside the viewport horizontally.
 *
 * NOT based on documentElement.scrollWidth: the stylesheet sets
 * overflow-x:hidden on html/body (needed so the off-canvas cart drawer doesn't
 * add a scrollbar), which forces scrollWidth === clientWidth. A scrollWidth
 * check therefore reports "no overflow" even when elements are clipped and
 * unreachable — it silently turned this whole spec into a no-op.
 *
 * Instead: walk the layout and flag boxes extending past the viewport, ignoring
 *   - elements clipped by a scrollable ancestor (an intentional scroll region,
 *     e.g. the admin table inside .admin-table-container), and
 *   - off-canvas fixed panels that are currently closed (the cart drawer).
 */
async function horizontalOverflow(page) {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth;

    const containedByScroller = (el) => {
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const ox = getComputedStyle(p).overflowX;
        if (ox === 'auto' || ox === 'scroll' || ox === 'hidden' || ox === 'clip') return true;
      }
      return false;
    };

    // A closed off-canvas panel is parked outside the viewport by design, and so
    // is everything inside it — the children are not themselves position:fixed.
    const insideClosedPanel = (el) => {
      for (let p = el; p && p !== document.body; p = p.parentElement) {
        const cs = getComputedStyle(p);
        if (cs.position === 'fixed' && !p.classList.contains('open')) return true;
      }
      return false;
    };

    const offenders = [...document.querySelectorAll('body *')]
      .filter((el) => {
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') return false;
        if (insideClosedPanel(el)) return false;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.right <= vw + 1) return false;
        return !containedByScroller(el);
      })
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      .sort((a, b) => b.r.right - a.r.right);

    if (!offenders.length) return null;
    const { el, r } = offenders[0];
    const cls = String(el.className || '').split(' ').filter(Boolean).join('.');
    return `content overflows viewport ${vw}px — ${el.tagName.toLowerCase()}${cls ? '.' + cls : ''} extends to ${Math.round(r.right)}px (${offenders.length} offending elements)`;
  });
}

/**
 * Widths swept for the containment check. The header's intrinsic width was
 * ~1554px, so everything from a laptop down was affected — a check at only a
 * few round breakpoints missed it entirely.
 */
const SWEEP = [1440, 1300, 1200, 1150, 1100, 1000, 900, 820, 768, 600, 480, 390, 360];

/**
 * Report any header control that sits outside the viewport.
 *
 * This deliberately measures element geometry rather than
 * documentElement.scrollWidth: the page sets overflow-x:hidden, which clips
 * overflow and makes scrollWidth equal clientWidth even while controls are
 * pushed off-screen and unreachable. A scrollWidth-only assertion passes on a
 * visibly broken header.
 */
async function offscreenControls(page) {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const out = [];
    for (const el of document.querySelectorAll('.header-right .icon-action-btn, .brand-logo, .mode-toggle-pill')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;   // legitimately hidden
      if (getComputedStyle(el).display === 'none') continue;
      if (r.right > vw + 1 || r.left < -1) {
        const label = (el.getAttribute('title') || el.innerText || el.className).trim().split('\n')[0];
        out.push(`"${label}" spans ${Math.round(r.left)}..${Math.round(r.right)}px in a ${vw}px viewport`);
      }
    }
    return out;
  });
}

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

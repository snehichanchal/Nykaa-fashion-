'use strict';

/**
 * Mobile & tablet layout suite.
 *
 * 07-responsive.spec.js sweeps widths for containment. This spec instead drives
 * the real user journeys *at* phone and tablet sizes, because the bugs that
 * matter on a small screen are not "does something poke out sideways" but
 * "can I still finish checkout" — a modal taller than the viewport with no
 * scroll container passes every overflow check and is still unusable.
 */

const {
  BASE_URL, sel, openStore, addCardToBag, waitForVisible, waitForText,
  clickHeartFor, state, search,
} = require('../lib/app-driver');
const {
  horizontalOverflow, offscreenControls, unreachableActions, gridColumns, smallTapTargets,
} = require('../lib/layout');

const PHONES = [
  { name: 'iPhone SE',      width: 375, height: 667 },
  { name: 'iPhone 12/13',   width: 390, height: 844 },
  { name: 'Android compact', width: 360, height: 740 },
];

const TABLETS = [
  { name: 'iPad portrait',   width: 768,  height: 1024 },
  { name: 'iPad Air',        width: 820,  height: 1180 },
  { name: 'iPad landscape',  width: 1024, height: 768 },
];

const DEVICES = PHONES.concat(TABLETS);

/** Emulate a touch device, not just a narrow window. */
async function useDevice(page, device) {
  await page.setViewport({
    width: device.width,
    height: device.height,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
}

const tests = [];

// ---------------------------------------------------------------------------
// Containment: the storefront and the key modals fit each device.
// ---------------------------------------------------------------------------

for (const device of DEVICES) {
  tests.push({
    name: `storefront fits ${device.name} (${device.width}x${device.height})`,
    async fn(page, { assert }) {
      await useDevice(page, device);
      await openStore(page);

      const overflow = await horizontalOverflow(page);
      assert.equal(overflow, null, overflow || '');

      const off = await offscreenControls(page);
      assert.equal(off.length, 0, `header controls off-screen on ${device.name}: ${off.join('; ')}`);
    },
  });
}

tests.push({
  name: 'category strip scrolls horizontally instead of clipping categories',
  async fn(page, { assert }) {
    await useDevice(page, PHONES[1]);
    await openStore(page);

    const strip = await page.$eval('.nav-categories', (el) => ({
      overflowX: getComputedStyle(el).overflowX,
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      items: el.querySelectorAll('.nav-item').length,
    }));

    assert.ok(strip.items > 0, 'no category items rendered');
    assert.ok(
      ['auto', 'scroll'].includes(strip.overflowX),
      `category strip has overflow-x:${strip.overflowX} on mobile — categories past the edge are unreachable`
    );

    // Prove it genuinely scrolls rather than merely being allowed to.
    if (strip.scrollWidth > strip.clientWidth + 1) {
      const moved = await page.$eval('.nav-categories', (el) => {
        el.scrollLeft = el.scrollWidth;
        return el.scrollLeft;
      });
      assert.ok(moved > 0, 'category strip overflows but will not scroll');
    }
  },
});

// ---------------------------------------------------------------------------
// Journeys: every step of a purchase has to be completable by thumb.
// ---------------------------------------------------------------------------

tests.push({
  name: 'header controls meet the 44px minimum touch target on a phone',
  async fn(page, { assert }) {
    await useDevice(page, PHONES[1]);
    await openStore(page);
    const small = await smallTapTargets(page, '.header-right .icon-action-btn, .nav-categories .nav-item');
    assert.equal(small.length, 0, `touch targets below 44x44px on a phone:\n  ${small.join('\n  ')}`);
  },
});

tests.push({
  name: 'product grid reflows to a phone-appropriate column count',
  async fn(page, { assert }) {
    await useDevice(page, PHONES[1]);
    await openStore(page);
    await page.evaluate(() => app.filterByCategory('all'));
    await page.waitForFunction(() => document.querySelectorAll('.product-card').length > 0, { timeout: 15000 });

    const cols = await gridColumns(page, sel.productGrid);
    assert.ok(cols > 0, 'no product cards measured');
    assert.ok(cols <= 2, `product grid renders ${cols} columns on a 390px phone; expected at most 2`);

    const cardWidth = await page.$eval(sel.productCard, (el) => el.getBoundingClientRect().width);
    assert.ok(cardWidth >= 140, `product cards are only ${Math.round(cardWidth)}px wide on mobile — unreadably narrow`);
  },
});

tests.push({
  name: 'size selection modal is fully usable on a phone',
  async fn(page, { assert }) {
    await useDevice(page, PHONES[0]);   // shortest phone: 667px tall
    await openStore(page);

    // Find a card whose product actually requires a size.
    const idx = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('.product-card')];
      return cards.findIndex((c) => {
        const id = Number((c.getAttribute('onclick') || '').match(/\d+/)?.[0]);
        const p = app.state.products.find((x) => x.id === id);
        return p && String(p.sizes || '').split(',').filter((s) => s.trim() && s.trim() !== 'One Size').length > 1;
      });
    });
    assert.ok(idx >= 0, 'no multi-size product on the first page to exercise the size modal');

    const buttons = await page.$$(sel.cardAddBtn);
    await buttons[idx].click();
    await waitForVisible(page, sel.sizeModal);

    const overflow = await horizontalOverflow(page);
    assert.equal(overflow, null, overflow || '');

    const stuck = await unreachableActions(page, sel.sizeModal);
    assert.equal(stuck.length, 0, `size modal controls unreachable on a ${667}px-tall phone:\n  ${stuck.join('\n  ')}`);
  },
});

tests.push({
  name: 'cart drawer fills the phone screen without overflowing it',
  async fn(page, { assert }) {
    await useDevice(page, PHONES[2]);   // narrowest phone: 360px
    await openStore(page);
    await addCardToBag(page, 0);
    await waitForVisible(page, sel.cartDrawer);
    await page.evaluate((s) => new Promise((resolve) => {
      const el = document.querySelector(s);
      el.addEventListener('transitionend', () => resolve(), { once: true });
      setTimeout(resolve, 1000);
    }), sel.cartDrawer);

    const box = await page.$eval(sel.cartDrawer, (el) => {
      const r = el.getBoundingClientRect();
      return { left: r.left, right: r.right, width: r.width };
    });
    assert.ok(box.width <= 360, `cart drawer is ${Math.round(box.width)}px wide on a 360px viewport`);
    assert.ok(box.right <= 361, `cart drawer overflows the right edge by ${Math.round(box.right - 360)}px`);

    const stuck = await unreachableActions(page, sel.cartDrawer);
    assert.equal(stuck.length, 0, `cart drawer controls unreachable on a phone:\n  ${stuck.join('\n  ')}`);
  },
});

tests.push({
  name: 'checkout can be completed on a phone',
  async fn(page, { assert }) {
    const dialogs = [];
    page.on('dialog', async (d) => { dialogs.push(d.message()); await d.dismiss().catch(() => {}); });

    await useDevice(page, PHONES[0]);   // 375x667, the tightest realistic phone
    await openStore(page);
    await addCardToBag(page, 0);

    await page.evaluate(() => app.openCheckoutModal());
    await waitForVisible(page, sel.checkoutModal);
    await waitForText(page, '#chkTotalPayable');

    const overflow = await horizontalOverflow(page);
    assert.equal(overflow, null, overflow || '');

    const stuck = await unreachableActions(page, sel.checkoutModal);
    assert.equal(stuck.length, 0, `checkout controls unreachable on a 375x667 phone:\n  ${stuck.join('\n  ')}`);

    // And it must actually go through from this viewport.
    await page.type('#chkName', 'Mobile Tester');
    await page.type('#chkPhone', '9876543210');
    await page.type('#chkAddress', '1 Test Street');
    await page.type('#chkPincode', '110001');
    await page.evaluate(() => { app.placeOrder(); });
    await page.waitForFunction(() => app.state.cart.length === 0, { timeout: 15000 });
    assert.ok(dialogs.some((d) => /NYK-\d+/.test(d)), `no order confirmation on mobile, saw ${JSON.stringify(dialogs)}`);
  },
});

tests.push({
  name: 'wishlist modal fits and stays usable on a tablet',
  async fn(page, { assert }) {
    await useDevice(page, TABLETS[0]);
    await openStore(page);

    const id = await page.evaluate(() => app.state.products[0].id);
    await clickHeartFor(page, id);
    await page.waitForFunction(() => app.state.wishlist.length > 0, { timeout: 15000 });

    await page.evaluate(() => app.showWishlistModal());
    await waitForVisible(page, sel.wishlistModal);
    await waitForText(page, sel.wishlistGrid);

    const overflow = await horizontalOverflow(page);
    assert.equal(overflow, null, overflow || '');

    const stuck = await unreachableActions(page, sel.wishlistModal);
    assert.equal(stuck.length, 0, `wishlist controls unreachable on a tablet:\n  ${stuck.join('\n  ')}`);
  },
});

tests.push({
  name: 'product detail modal fits on a phone',
  async fn(page, { assert }) {
    await useDevice(page, PHONES[1]);
    await openStore(page);

    const id = await page.evaluate(() => app.state.products[0].id);
    await page.evaluate((pid) => app.openProductDetailModal(pid), id);
    await waitForVisible(page, sel.pdpModal);
    await waitForText(page, sel.pdpModal);

    const overflow = await horizontalOverflow(page);
    assert.equal(overflow, null, overflow || '');

    const stuck = await unreachableActions(page, sel.pdpModal);
    assert.equal(stuck.length, 0, `product detail controls unreachable on a phone:\n  ${stuck.join('\n  ')}`);
  },
});

tests.push({
  name: 'search works and results stay contained on a phone',
  async fn(page, { assert }) {
    await useDevice(page, PHONES[1]);
    await openStore(page);
    await search(page, 'dress');

    const results = await state(page, 'products');
    assert.ok(results.length > 0, 'search for "dress" returned nothing');

    const overflow = await horizontalOverflow(page);
    assert.equal(overflow, null, overflow || '');
  },
});

tests.push({
  name: 'admin dashboard is usable on a tablet',
  async fn(page, { assert }) {
    await useDevice(page, TABLETS[1]);
    await page.goto(BASE_URL + '/admin', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.querySelectorAll('#adminProductTableBody tr').length > 0, { timeout: 20000 });

    const overflow = await horizontalOverflow(page);
    assert.equal(overflow, null, overflow || '');
  },
});

tests.push({
  name: 'admin dashboard is usable on a phone',
  async fn(page, { assert }) {
    await useDevice(page, PHONES[1]);
    await page.goto(BASE_URL + '/admin', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.querySelectorAll('#adminProductTableBody tr').length > 0, { timeout: 20000 });

    const overflow = await horizontalOverflow(page);
    assert.equal(overflow, null, overflow || '');

    const cols = await gridColumns(page, '.admin-stats-grid');
    assert.ok(cols <= 2, `admin stat cards render ${cols} across on a 390px phone`);
  },
});

module.exports = { name: 'Mobile & tablet layout', tests };

'use strict';

// Page-object helpers for the storefront. Keeping selectors in one place means a
// markup change breaks one file rather than every spec.

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000';

const sel = {
  productCard: '.product-card',
  cardTitle: '.product-title',
  cardAddBtn: '.card-action-btn',
  heartBtn: '.wishlist-heart-btn',
  searchInput: '#searchInput',
  productGrid: '#productGrid',
  homepageBlocks: '#homepageBlocksContainer',
  listingTitle: '#listingCategoryTitle',
  listingCount: '#listingCountLabel',
  cartDrawer: '#cartDrawer',
  cartBody: '#cartBody',
  cartCount: '#cartCount',
  cartItem: '.cart-item-card',
  removeCartBtn: '.remove-cart-item',
  removeCartModal: '#removeCartModal',
  sizeModal: '#sizeSelectionModal',
  sizeModalPill: '.size-modal-pill',
  sizeModalSubmit: '#sizeModalSubmitBtn',
  wishlistDot: '#wishlistDot',
  wishlistModal: '#wishlistModal',
  wishlistGrid: '#wishlistGrid',
  checkoutModal: '#checkoutModal',
  pdpModal: '#productDetailModal',
  authModal: '#authModal',
  suggestCard: '.wishlist-suggest-card',
};

/**
 * Load the storefront and wait for app.init() to finish.
 *
 * init() awaits categories -> brands -> products -> wishlist -> cart in sequence,
 * so products appearing does NOT mean the app is ready: the cart drawer is still
 * unrendered at that point. Wait for the drawer body too, which renderCartDrawer
 * fills (with the empty state, if the bag is empty) at the end of that chain.
 */
async function openStore(page) {
  await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    () => typeof app !== 'undefined' && Array.isArray(app.state.products) && app.state.products.length > 0,
    { timeout: 20000 }
  );
  await page.waitForSelector(sel.productCard, { timeout: 20000 });
  await page.waitForFunction(
    () => (document.getElementById('cartBody')?.innerHTML || '').trim().length > 0,
    { timeout: 20000 }
  );
}

/** Read a slice of app.state out of the live page. */
function state(page, path) {
  return page.evaluate((p) => {
    const parts = p.split('.');
    let cur = app.state;
    for (const part of parts) cur = cur?.[part];
    return cur;
  }, path);
}

/** True when an element exists and carries the `open` class the app uses for modals. */
function isOpen(page, selector) {
  return page.evaluate((s) => {
    const el = document.querySelector(s);
    return !!el && el.classList.contains('open');
  }, selector);
}

async function count(page, selector) {
  return page.$$eval(selector, (els) => els.length);
}

async function textOf(page, selector) {
  return page.$eval(selector, (el) => el.innerText.trim()).catch(() => null);
}

/** Wait until the app's cart state has the expected number of rows. */
function waitForCartSize(page, n) {
  return page.waitForFunction((expected) => app.state.cart.length === expected, { timeout: 15000 }, n);
}

/** A cheap fingerprint of the current result set, used to detect a completed refetch. */
function productSignature(page) {
  return page.evaluate(() => app.state.products.map((p) => p.id).join(','));
}

/**
 * Run an action that triggers an async product refetch, and wait until the grid
 * actually changes. State fields like `state.category` are set synchronously, so
 * asserting straight after the call reads the *previous* result set.
 */
async function withProductRefetch(page, action) {
  const before = await productSignature(page);
  await action();
  await page.waitForFunction(
    (prev) => app.state.products.map((p) => p.id).join(',') !== prev,
    { timeout: 15000 },
    before
  );
  await page.waitForFunction(() => !app.__fetching, { timeout: 5000 }).catch(() => {});
}

/**
 * Wait for a modal/drawer to be open *and* finished transitioning in.
 *
 * The panels animate `visibility: hidden -> visible` over ~300ms, and innerText
 * reports '' for anything inside a `visibility: hidden` subtree. Checking only
 * the bounding rect passes immediately and reads empty text.
 */
async function waitForVisible(page, selector) {
  await page.waitForFunction(
    (s) => {
      const el = document.querySelector(s);
      if (!el || !el.classList.contains('open')) return false;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) < 0.9) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    },
    { timeout: 15000 },
    selector
  );
}

/** Type into the search box so every keystroke fires the app's keyup handler. */
async function search(page, term) {
  await page.$eval(sel.searchInput, (el) => { el.value = ''; });
  if (term.length) {
    await page.focus(sel.searchInput);
    await page.type(sel.searchInput, term);
  } else {
    // An empty term types no keys, so fire the handler explicitly.
    await page.$eval(sel.searchInput, (el) => {
      el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
    });
  }
  await page.waitForFunction((t) => app.state.search === t.trim(), { timeout: 15000 }, term);
  // Two searches can yield an identical result set (e.g. "dReSs" vs "dress"), so a
  // change-detector cannot be used here. Wait for the list to stop changing instead;
  // a fixed sleep is not enough when the whole suite is loading the machine.
  await waitForStable(page, () => app.state.products.map((p) => p.id).join(','), 700);
}

/**
 * Poll `read` until its value stays identical for `quietMs`, so an in-flight
 * refetch cannot land between the wait and the assertion.
 */
async function waitForStable(page, read, quietMs = 600, timeout = 20000) {
  const deadline = Date.now() + timeout;
  let last = Symbol('none');
  let stableSince = 0;
  while (Date.now() < deadline) {
    const now = await page.evaluate(read);
    if (now === last) {
      if (Date.now() - stableSince >= quietMs) return now;
    } else {
      last = now;
      stableSince = Date.now();
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`value never settled within ${timeout}ms`);
}

/** Wait for an element to actually have rendered text before asserting on it. */
async function waitForText(page, selector) {
  await page.waitForFunction(
    (s) => (document.querySelector(s)?.innerText || '').trim().length > 0,
    { timeout: 15000 },
    selector
  );
  return textOf(page, selector);
}

/** Click the heart for a specific product id, surviving re-renders that reorder cards. */
async function clickHeartFor(page, productId) {
  const clicked = await page.evaluate((id) => {
    const btn = [...document.querySelectorAll('.wishlist-heart-btn')]
      .find((b) => (b.getAttribute('onclick') || '').includes(`toggleWishlist(${id})`));
    if (!btn) return false;
    btn.click();
    return true;
  }, productId);
  if (!clicked) throw new Error(`no wishlist heart found for product ${productId}`);
}

function waitForWishlistSize(page, n) {
  return page.waitForFunction((expected) => app.state.wishlist.length === expected, { timeout: 15000 }, n);
}

/**
 * Add the product rendered in card `index` to the bag, handling the mandatory
 * size modal when the product requires a size. Returns the chosen size.
 */
async function addCardToBag(page, index = 0) {
  const before = (await state(page, 'cart')).length;
  const buttons = await page.$$(sel.cardAddBtn);
  if (!buttons[index]) throw new Error(`no ADD TO BAG button at card index ${index}`);
  await buttons[index].click();

  // Either the size modal opens, or the item goes straight into the bag.
  await page.waitForFunction(
    (s, prev) => {
      const m = document.querySelector(s);
      return (m && m.classList.contains('open')) || app.state.cart.length > prev;
    },
    { timeout: 15000 },
    sel.sizeModal,
    before
  );

  let chosenSize = null;
  if (await isOpen(page, sel.sizeModal)) {
    const pills = await page.$$(sel.sizeModalPill);
    if (pills.length === 0) throw new Error('size modal opened with no size pills');
    chosenSize = await pills[0].evaluate((el) => el.innerText.trim());
    await pills[0].click();
    await page.click(sel.sizeModalSubmit);
    await waitForCartSize(page, before + 1);
  }
  return chosenSize;
}

/** Clear server-side cart + wishlist for the demo session, then reload. */
async function resetSession(page) {
  await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded' });
  // localStorage is shared across pages of the same browser, so a login in one
  // test would otherwise persist into the next.
  await page.evaluate(() => { try { localStorage.clear(); } catch {} });
  await page.evaluate(async () => {
    const cart = await (await fetch('/api/cart')).json();
    for (const item of cart.data || []) {
      await fetch(`/api/cart/${item.cart_id}`, { method: 'DELETE' });
    }
    const wl = await (await fetch('/api/wishlist')).json();
    for (const item of wl.data || []) {
      await fetch(`/api/wishlist/${item.id}`, { method: 'DELETE' });
    }
  });
}

module.exports = {
  BASE_URL, sel, openStore, state, isOpen, count, textOf,
  waitForCartSize, waitForWishlistSize, addCardToBag, resetSession,
  productSignature, withProductRefetch, waitForVisible, search, clickHeartFor,
  waitForStable, waitForText,
};

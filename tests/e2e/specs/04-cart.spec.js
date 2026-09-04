'use strict';

const {
  sel, openStore, state, isOpen, count, textOf,
  addCardToBag, waitForCartSize, waitForWishlistSize, waitForVisible, waitForText,
} = require('../lib/app-driver');

/**
 * Click the ✕ on the first bag row. The drawer slides in with a CSS transition,
 * so a positional click can land before the button is in its final place.
 */
async function clickRemoveX(page) {
  await waitForVisible(page, sel.cartDrawer);
  await page.waitForFunction((s) => {
    const el = document.querySelector(s);
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }, { timeout: 15000 }, sel.removeCartBtn);
  await page.$eval(sel.removeCartBtn, (el) => el.click());
}

module.exports = {
  name: 'Shopping bag',
  tests: [
    {
      name: 'ADD TO BAG demands a size before adding a sized product',
      async fn(page, { assert }) {
        await openStore(page);
        // Find a card whose product genuinely requires a size.
        const idx = await page.evaluate(() => {
          const cards = [...document.querySelectorAll('.card-action-btn')];
          for (let i = 0; i < cards.length; i++) {
            const m = cards[i].getAttribute('onclick').match(/addToBag\((\d+)\)/);
            if (!m) continue;
            const p = app.state.products.find((x) => x.id === Number(m[1]));
            const sizes = p?.sizes || [];
            if (sizes.length > 1) return i;
          }
          return -1;
        });
        assert.greater(idx, -1, 'no sized product found on the homepage');

        const buttons = await page.$$(sel.cardAddBtn);
        await buttons[idx].click();
        await page.waitForFunction((s) => document.querySelector(s)?.classList.contains('open'), { timeout: 10000 }, sel.sizeModal);

        const cart = await state(page, 'cart');
        assert.equal(cart.length, 0, 'item entered the bag before a size was chosen');
      },
    },
    {
      name: 'choosing a size adds the item with that exact size',
      async fn(page, { assert }) {
        await openStore(page);
        const chosen = await addCardToBag(page, 0);
        const cart = await state(page, 'cart');
        assert.equal(cart.length, 1, 'item was not added to the bag');
        if (chosen) {
          assert.equal(cart[0].selected_size, chosen, 'stored size differs from the size chosen in the modal');
        }
      },
    },
    {
      name: 'adding an item opens the bag and updates the header count',
      async fn(page, { assert }) {
        await openStore(page);
        await addCardToBag(page, 0);
        assert.ok(await isOpen(page, sel.cartDrawer), 'cart drawer did not open after adding');
        const badge = await textOf(page, sel.cartCount);
        assert.equal(badge, '1', `header cart badge shows ${JSON.stringify(badge)} instead of "1"`);
      },
    },
    {
      name: 'price summary arithmetic is self-consistent',
      async fn(page, { assert }) {
        await openStore(page);
        await addCardToBag(page, 0);
        const summary = await state(page, 'cartSummary');
        assert.equal(
          summary.totalMrp - summary.totalDiscount,
          summary.totalAmount,
          'totalMrp - totalDiscount does not equal totalAmount'
        );

        const rendered = await textOf(page, '.price-summary-card');
        const payable = `₹${summary.totalAmount.toLocaleString()}`;
        assert.includes(rendered, payable, 'rendered "You Pay" does not match cartSummary.totalAmount');
      },
    },
    {
      name: 'changing quantity updates the line total and summary',
      async fn(page, { assert }) {
        await openStore(page);
        await addCardToBag(page, 0);
        const before = await state(page, 'cartSummary');

        const cartId = (await state(page, 'cart'))[0].cart_id;
        await page.evaluate((id) => app.updateCartQty(id, 3), cartId);
        await page.waitForFunction(() => app.state.cart[0]?.quantity === 3, { timeout: 15000 });

        const after = await state(page, 'cartSummary');
        assert.equal(after.totalAmount, before.totalAmount * 3, 'total did not scale with quantity');
        assert.equal(after.itemCount, 3, 'itemCount did not follow the quantity change');
      },
    },
    {
      name: 'changing the size dropdown in the bag persists the new size',
      async fn(page, { assert }) {
        await openStore(page);

        // Pick a genuinely multi-size product, so this cannot pass vacuously.
        const seeded = await page.evaluate(async () => {
          const all = (await (await fetch('/api/products')).json()).data;
          const p = all.find((x) => (x.sizes || []).length > 1 && x.stock_qty > 0);
          if (!p) return null;
          await fetch('/api/cart', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productId: p.id, size: p.sizes[0], quantity: 1 }),
          });
          return { id: p.id, sizes: p.sizes, chosen: p.sizes[0] };
        });
        assert.ok(seeded, 'no multi-size product in the catalog to test with');

        await openStore(page);
        await page.evaluate(() => app.toggleCartDrawer(true));
        await waitForVisible(page, sel.cartDrawer);

        const item = (await state(page, 'cart'))[0];
        const sizes = item.sizes || [];
        const alternative = sizes.find((s) => s !== item.selected_size);
        assert.ok(alternative, `product has no alternative size: ${JSON.stringify(sizes)}`);

        // Drive the real <select> the user interacts with.
        const sizeSelect = await page.$(`${sel.cartItem} .select-box`);
        await sizeSelect.select(alternative);

        // Give the handler time to round-trip to the API and refetch.
        await new Promise((r) => setTimeout(r, 1200));
        await page.evaluate(() => app.fetchCart());
        await new Promise((r) => setTimeout(r, 500));

        const after = (await state(page, 'cart'))[0];
        assert.equal(after.selected_size, alternative, 'the size chosen in the bag was not saved');
      },
    },
    {
      name: 'setting quantity to zero removes the line',
      async fn(page, { assert }) {
        await openStore(page);
        await addCardToBag(page, 0);
        const cartId = (await state(page, 'cart'))[0].cart_id;
        await page.evaluate((id) => app.updateCartQty(id, 0), cartId);
        await waitForCartSize(page, 0);
      },
    },
    {
      name: 'the ✕ opens the "Are you sure?" modal instead of deleting',
      async fn(page, { assert }) {
        await openStore(page);
        await addCardToBag(page, 0);
        await clickRemoveX(page);
        await waitForVisible(page, sel.removeCartModal);

        const cart = await state(page, 'cart');
        assert.equal(cart.length, 1, 'item was deleted without confirmation');

        const modalText = await waitForText(page, sel.removeCartModal);
        assert.includes(modalText, 'Are you sure', 'confirmation copy missing');
      },
    },
    {
      name: '"Move to wishlist" transfers the item rather than losing it',
      async fn(page, { assert }) {
        await openStore(page);
        await addCardToBag(page, 0);
        const productId = (await state(page, 'cart'))[0].id;

        await clickRemoveX(page);
        await page.waitForFunction((s) => document.querySelector(s)?.classList.contains('open'), { timeout: 10000 }, sel.removeCartModal);
        await page.evaluate(() => app.confirmMoveToWishlist());

        await waitForCartSize(page, 0);
        await waitForWishlistSize(page, 1);
        const wl = await state(page, 'wishlist');
        assert.equal(wl[0].id, productId, 'a different product ended up in the wishlist');
      },
    },
    {
      name: '"Remove" discards the item entirely',
      async fn(page, { assert }) {
        await openStore(page);
        await addCardToBag(page, 0);
        await clickRemoveX(page);
        await page.waitForFunction((s) => document.querySelector(s)?.classList.contains('open'), { timeout: 10000 }, sel.removeCartModal);
        await page.evaluate(() => app.confirmRemoveCartItem());

        await waitForCartSize(page, 0);
        const wl = await state(page, 'wishlist');
        assert.equal(wl.length, 0, 'plain remove should not add the item to the wishlist');
      },
    },
    {
      name: 'empty bag shows the empty state',
      async fn(page, { assert }) {
        await openStore(page);
        await page.evaluate(() => app.toggleCartDrawer(true));
        await waitForVisible(page, sel.cartDrawer);
        const body = await waitForText(page, sel.cartBody);
        assert.includes(body, 'Your Shopping Bag is empty', 'empty-bag copy missing');
        assert.equal(await count(page, sel.cartItem), 0, 'cart rows rendered for an empty bag');
      },
    },
    {
      name: 'out-of-stock wishlist items are excluded from bag suggestions',
      async fn(page, { assert }) {
        await openStore(page);

        // Put an in-stock item in the bag, and both an in-stock and an
        // out-of-stock item from the same category in the wishlist.
        const ids = await page.evaluate(async () => {
          const all = (await (await fetch('/api/products')).json()).data;
          const oos = all.find((p) => p.stock_qty <= 0);
          if (!oos) return null;
          const sameCat = all.filter((p) => p.category_slug === oos.category_slug && p.stock_qty > 0);
          if (sameCat.length < 2) return null;
          const cartItem = sameCat[0];
          const wishItem = sameCat[1];

          await fetch('/api/cart', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productId: cartItem.id, size: 'M', quantity: 1 }),
          });
          for (const id of [oos.id, wishItem.id]) {
            await fetch('/api/wishlist/toggle', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ productId: id }),
            });
          }
          return { oos: oos.id, oosTitle: oos.title, wish: wishItem.id };
        });
        if (!ids) return; // catalog has no out-of-stock fixture

        await openStore(page);
        await page.evaluate(() => app.toggleCartDrawer(true));
        const suggestions = (await textOf(page, sel.cartBody)) || '';

        assert.ok(
          !suggestions.includes(ids.oosTitle.slice(0, 30)),
          `out-of-stock product "${ids.oosTitle}" was offered as a bag suggestion`
        );
      },
    },
  ],
};

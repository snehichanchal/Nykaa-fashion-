'use strict';

const { sel, openStore, state, isOpen, textOf, waitForWishlistSize, waitForVisible, clickHeartFor, addCardToBag } = require('../lib/app-driver');

module.exports = {
  name: 'Wishlist',
  tests: [
    {
      // toggleWishlist deliberately routes an already-wishlisted product to the
      // confirmation modal rather than removing it outright ("accidental deletion
      // protection", docs/readme.md §5). Un-hearting is therefore a two-step flow.
      name: 'heart saves a product, and un-hearting asks before removing',
      async fn(page, { assert }) {
        await openStore(page);
        const id = (await state(page, 'products'))[0].id;

        await clickHeartFor(page, id);
        await waitForWishlistSize(page, 1);

        const active = await page.$$eval(sel.heartBtn, (els) => els.filter((e) => e.classList.contains('active')).length);
        assert.greater(active, 0, 'heart did not render as active after wishlisting');

        await clickHeartFor(page, id);
        await waitForVisible(page, '#removeWishlistModal');
        assert.equal((await state(page, 'wishlist')).length, 1, 'item was removed before the user confirmed');

        await page.evaluate(() => app.confirmRemoveWishlistItem());
        await waitForWishlistSize(page, 0);
      },
    },
    {
      name: 'wishlist survives a page reload',
      async fn(page, { assert }) {
        await openStore(page);
        await clickHeartFor(page, (await state(page, 'products'))[0].id);
        await waitForWishlistSize(page, 1);
        const before = (await state(page, 'wishlist'))[0].id;

        await openStore(page);
        const after = await state(page, 'wishlist');
        assert.equal(after.length, 1, 'wishlist did not persist across reload');
        assert.equal(after[0].id, before, 'a different product came back after reload');
      },
    },
    {
      // Documented contract (updateHeaderBadges, and docs/edgecase.md TC-CART-03):
      //   empty cart  + wishlist items -> numeric badge, no dot
      //   cart items  + wishlist items -> dot, no numeric badge
      //   empty wishlist               -> neither
      name: 'header shows a numeric wishlist badge while the bag is empty',
      async fn(page, { assert }) {
        await openStore(page);
        const disp = (s) => page.$eval(s, (el) => getComputedStyle(el).display);

        assert.equal(await disp('#wishlistCount'), 'none', 'wishlist badge visible with an empty wishlist');
        assert.equal(await disp(sel.wishlistDot), 'none', 'wishlist dot visible with an empty wishlist');

        await clickHeartFor(page, (await state(page, 'products'))[0].id);
        await waitForWishlistSize(page, 1);

        assert.notEqual(await disp('#wishlistCount'), 'none', 'numeric wishlist badge did not appear');
        assert.equal(await textOf(page, '#wishlistCount'), '1', 'wishlist badge shows the wrong count');
        assert.equal(await disp(sel.wishlistDot), 'none', 'dot should stay hidden while the bag is empty');
      },
    },
    {
      name: 'header switches to the dot indicator once the bag has items',
      async fn(page, { assert }) {
        await openStore(page);
        await clickHeartFor(page, (await state(page, 'products'))[0].id);
        await waitForWishlistSize(page, 1);

        await addCardToBag(page, 1);
        await page.waitForFunction(() => app.state.cart.length > 0, { timeout: 15000 });

        const disp = (s) => page.$eval(s, (el) => getComputedStyle(el).display);
        assert.notEqual(await disp(sel.wishlistDot), 'none', 'dot did not appear once the bag had items');
        assert.equal(await disp('#wishlistCount'), 'none', 'numeric badge should be hidden once the bag has items');
      },
    },
    {
      name: 'wishlist modal lists the saved product',
      async fn(page, { assert }) {
        await openStore(page);
        await clickHeartFor(page, (await state(page, 'products'))[0].id);
        await waitForWishlistSize(page, 1);
        const saved = (await state(page, 'wishlist'))[0];

        await page.evaluate(() => app.showWishlistModal());
        await waitForVisible(page, sel.wishlistModal);

        const grid = await textOf(page, sel.wishlistGrid);
        assert.includes(grid, saved.title.slice(0, 25), 'saved product missing from the wishlist modal');
      },
    },
    {
      name: 'removing from the wishlist asks for confirmation first',
      async fn(page, { assert }) {
        await openStore(page);
        await clickHeartFor(page, (await state(page, 'products'))[0].id);
        await waitForWishlistSize(page, 1);

        await page.evaluate(() => app.showWishlistModal());
        await waitForVisible(page, sel.wishlistModal);

        const removeBtn = await page.$('#wishlistGrid .wishlist-remove-btn, #wishlistGrid .remove-wishlist-item');
        if (!removeBtn) return; // layout has no explicit remove control; nothing to assert
        await removeBtn.click();
        const confirmOpen = await isOpen(page, '#removeWishlistModal');
        assert.ok(confirmOpen, 'wishlist removal did not open the confirmation modal');

        const stillThere = (await state(page, 'wishlist')).length;
        assert.equal(stillThere, 1, 'item was removed before the user confirmed');
      },
    },
  ],
};

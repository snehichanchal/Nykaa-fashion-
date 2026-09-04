'use strict';

const { sel, openStore, state, isOpen, textOf, addCardToBag, waitForCartSize, waitForVisible } = require('../lib/app-driver');

/** Capture alert()/confirm() text instead of hanging the headless run. */
function captureDialogs(page) {
  const seen = [];
  page.on('dialog', async (d) => { seen.push(d.message()); await d.dismiss().catch(() => {}); });
  return seen;
}

module.exports = {
  name: 'Checkout & orders',
  tests: [
    {
      name: 'checkout modal shows the payable total from the bag',
      async fn(page, { assert }) {
        await openStore(page);
        await addCardToBag(page, 0);
        const summary = await state(page, 'cartSummary');

        await page.evaluate(() => app.openCheckoutModal());
        await waitForVisible(page, sel.checkoutModal);
        await page.waitForFunction(() => document.getElementById('chkTotalPayable').innerText.trim().length > 0, { timeout: 10000 });

        const payable = await textOf(page, '#chkTotalPayable');
        assert.equal(payable, `₹${summary.totalAmount.toLocaleString()}`, 'checkout total does not match the bag');
      },
    },
    {
      name: 'checkout on an empty bag is refused',
      async fn(page, { assert }) {
        await openStore(page);
        const dialogs = captureDialogs(page);
        await page.evaluate(() => app.openCheckoutModal());
        await new Promise((r) => setTimeout(r, 500));

        assert.ok(!(await isOpen(page, sel.checkoutModal)), 'checkout opened with an empty bag');
        assert.ok(dialogs.some((d) => /empty/i.test(d)), `expected an "empty cart" warning, saw ${JSON.stringify(dialogs)}`);
      },
    },
    {
      name: 'placing an order clears the bag and returns an order number',
      async fn(page, { assert }) {
        await openStore(page);
        await addCardToBag(page, 0);
        const dialogs = captureDialogs(page);

        await page.evaluate(() => app.openCheckoutModal());
        await waitForVisible(page, sel.checkoutModal);

        await page.type('#chkName', 'E2E Tester');
        await page.type('#chkPhone', '9876543210');
        await page.type('#chkAddress', '1 Test Street');
        await page.type('#chkPincode', '110001');
        await page.evaluate(() => { app.placeOrder(); });

        await waitForCartSize(page, 0);
        assert.ok(
          dialogs.some((d) => /NYK-\d+/.test(d)),
          `expected an order confirmation with an order number, saw ${JSON.stringify(dialogs)}`
        );
      },
    },
    {
      name: 'the placed order is recorded in order history',
      async fn(page, { assert }) {
        await openStore(page);
        await addCardToBag(page, 0);
        captureDialogs(page);

        const before = await page.evaluate(async () => (await (await fetch('/api/user/orders')).json()).data.length);

        await page.evaluate(() => app.openCheckoutModal());
        await waitForVisible(page, sel.checkoutModal);
        await page.type('#chkName', 'E2E Tester');
        await page.type('#chkPhone', '9876543210');
        await page.evaluate(() => { app.placeOrder(); });
        await waitForCartSize(page, 0);

        const after = await page.evaluate(async () => (await (await fetch('/api/user/orders')).json()).data.length);
        assert.equal(after, before + 1, 'order count did not increase after checkout');
      },
    },
    {
      name: 'OTP login accepts the demo code and stores the user',
      async fn(page, { assert }) {
        await openStore(page);
        captureDialogs(page);

        await page.evaluate(() => app.openAuthModal());
        await page.waitForFunction((s) => document.querySelector(s)?.classList.contains('open'), { timeout: 10000 }, sel.authModal);

        await page.$eval('#authIdentifier', (el) => { el.value = '9990001111'; });
        await page.evaluate(() => app.submitAuthStep1());
        await page.waitForSelector('#authOtp', { visible: true, timeout: 10000 });

        // The demo flow prefills these; overwrite rather than append.
        await page.evaluate(() => {
          document.getElementById('authOtp').value = '1234';
          const n = document.getElementById('authName');
          if (n) n.value = 'E2E User';
        });
        await page.evaluate(() => { app.verifyAuthOtp(); });

        await page.waitForFunction(() => app.state.currentUser !== null, { timeout: 15000 });
        const user = await state(page, 'currentUser');
        assert.ok(user, 'no user stored after OTP verification');
      },
    },
    {
      name: 'a wrong OTP is rejected',
      // Rejecting the OTP is a 400 by design; that console entry is the pass signal.
      allowConsole: ['status of 400'],
      async fn(page, { assert }) {
        await openStore(page);
        const dialogs = captureDialogs(page);

        await page.evaluate(() => app.openAuthModal());
        await page.waitForFunction((s) => document.querySelector(s)?.classList.contains('open'), { timeout: 10000 }, sel.authModal);
        await page.$eval('#authIdentifier', (el) => { el.value = '9990002222'; });
        await page.evaluate(() => app.submitAuthStep1());
        await page.waitForSelector('#authOtp', { visible: true, timeout: 10000 });

        // The demo flow prefills #authOtp with the valid code 1234, so typing
        // would append and still verify. Replace the value outright.
        await page.evaluate(() => { document.getElementById('authOtp').value = '9999'; });
        await page.evaluate(() => { app.verifyAuthOtp(); });
        await new Promise((r) => setTimeout(r, 1200));

        const user = await state(page, 'currentUser');
        assert.equal(user, null, 'a wrong OTP logged the user in');
        assert.ok(dialogs.length > 0, 'no feedback shown for an invalid OTP');
      },
    },
  ],
};

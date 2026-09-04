'use strict';

/**
 * E2E runner.
 *
 * Requires the app server to already be running (`npm start` from the repo root).
 *
 *   node tests/e2e/run.js                # run everything, headless
 *   node tests/e2e/run.js 04             # only specs whose filename contains "04"
 *   HEADED=1 node tests/e2e/run.js       # watch it drive a real window
 *
 * The suite writes to the real SQLite database, so db/database.sqlite is
 * snapshotted before the run and restored afterwards, even on failure.
 */

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const { assert } = require('./lib/harness');
const driver = require('./lib/app-driver');

const ROOT = path.join(__dirname, '..', '..');
const DB = path.join(ROOT, 'db', 'database.sqlite');
const SNAPSHOT = path.join(__dirname, '.db-snapshot');
const ARTIFACTS = path.join(__dirname, 'artifacts');

const filter = process.argv[2] || '';

const SPEC_DIR = path.join(__dirname, 'specs');
const specFiles = fs.readdirSync(SPEC_DIR)
  .filter((f) => f.endsWith('.spec.js'))
  .filter((f) => !filter || f.includes(filter))
  .sort();

// Console noise the app produces that is not a defect signal.
const IGNORED_CONSOLE = [
  'favicon',
  'Failed to load resource: the server responded with a status of 404',
];

async function waitForServer() {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(driver.BASE_URL + '/api/categories');
      if (res.ok) return;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`server not reachable at ${driver.BASE_URL} — start it with "npm start" from the repo root`);
}

async function main() {
  await waitForServer();

  fs.copyFileSync(DB, SNAPSHOT);
  fs.mkdirSync(ARTIFACTS, { recursive: true });

  const browser = await puppeteer.launch({
    headless: !process.env.HEADED,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
    defaultViewport: { width: 1440, height: 1000 },
  });

  const passed = [];
  const failed = [];

  try {
    for (const file of specFiles) {
      const spec = require(path.join(SPEC_DIR, file));
      console.log(`\n\x1b[1m${spec.name}\x1b[0m  (${file})`);

      for (const test of spec.tests) {
        const page = await browser.newPage();
        const consoleErrors = [];
        // A test may declare errors it deliberately provokes (e.g. asserting that
        // a bad request is rejected, which logs a 4xx in the console).
        const allowed = IGNORED_CONSOLE.concat(test.allowConsole || []);
        page.on('console', (m) => {
          if (m.type() !== 'error') return;
          const text = m.text();
          if (allowed.some((p) => text.includes(p))) return;
          consoleErrors.push(text);
        });
        page.on('pageerror', (e) => consoleErrors.push(`Uncaught ${e.message}`));

        const label = `${spec.name} › ${test.name}`;
        try {
          await driver.resetSession(page);
          await test.fn(page, { assert, driver });

          // An uncaught JS error means the UI is broken even if assertions passed.
          if (consoleErrors.length) {
            throw new Error(`console errors during test:\n      - ${consoleErrors.join('\n      - ')}`);
          }
          console.log(`  \x1b[32m✔\x1b[0m ${test.name}`);
          passed.push(label);
        } catch (err) {
          console.log(`  \x1b[31m✘\x1b[0m ${test.name}`);
          console.log(`      \x1b[31m${err.message}\x1b[0m`);
          const shot = path.join(ARTIFACTS, `${file}-${test.name}`.replace(/[^a-z0-9.-]+/gi, '_') + '.png');
          await page.screenshot({ path: shot, fullPage: false }).catch(() => {});
          failed.push({ label, message: err.message, shot });
        } finally {
          await page.close();
        }
      }
    }
  } finally {
    await browser.close();
    fs.copyFileSync(SNAPSHOT, DB);
    fs.unlinkSync(SNAPSHOT);
  }

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`\x1b[32m${passed.length} passed\x1b[0m, ${failed.length ? `\x1b[31m${failed.length} failed\x1b[0m` : '0 failed'}`);
  if (failed.length) {
    console.log('\nFailures:');
    for (const f of failed) {
      console.log(`  \x1b[31m✘\x1b[0m ${f.label}`);
      console.log(`      ${f.message.split('\n')[0]}`);
      console.log(`      screenshot: ${path.relative(ROOT, f.shot)}`);
    }
  }
  console.log('database restored from snapshot');
  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error('\x1b[31mrunner error:\x1b[0m', err);
  if (fs.existsSync(SNAPSHOT)) {
    fs.copyFileSync(SNAPSHOT, DB);
    fs.unlinkSync(SNAPSHOT);
    console.error('database restored from snapshot');
  }
  process.exit(1);
});

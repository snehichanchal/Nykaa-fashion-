'use strict';

// Minimal test harness. Deliberately dependency-free (no jest/mocha) so the
// suite stays fast to install and the whole control flow is readable here.

const results = [];
let currentSuite = null;

function suite(name, fn) {
  currentSuite = { name, tests: [] };
  fn(currentSuite);
  const s = currentSuite;
  currentSuite = null;
  return s;
}

class AssertionError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AssertionError';
    this.isAssertion = true;
  }
}

const assert = {
  ok(value, msg) {
    if (!value) throw new AssertionError(msg || `expected truthy, got ${JSON.stringify(value)}`);
  },
  equal(actual, expected, msg) {
    if (actual !== expected) {
      throw new AssertionError(`${msg || 'values differ'}\n      expected: ${JSON.stringify(expected)}\n      actual:   ${JSON.stringify(actual)}`);
    }
  },
  notEqual(actual, forbidden, msg) {
    if (actual === forbidden) {
      throw new AssertionError(`${msg || 'value should have changed'}\n      got the forbidden value: ${JSON.stringify(forbidden)}`);
    }
  },
  greater(actual, floor, msg) {
    if (!(actual > floor)) {
      throw new AssertionError(`${msg || 'value too small'}\n      expected: > ${floor}\n      actual:   ${actual}`);
    }
  },
  includes(haystack, needle, msg) {
    if (haystack == null || !String(haystack).includes(needle)) {
      const shown = String(haystack ?? '').slice(0, 200);
      throw new AssertionError(`${msg || 'substring missing'}\n      expected to contain: ${JSON.stringify(needle)}\n      actual: ${JSON.stringify(shown)}`);
    }
  },
};

module.exports = { suite, assert, AssertionError, results };

'use strict';

/**
 * Layout/geometry probes shared by the responsive specs.
 *
 * Everything here measures real element rects rather than
 * documentElement.scrollWidth. The stylesheet sets overflow-x:hidden on
 * html/body (so the off-canvas cart drawer doesn't add a scrollbar), which
 * forces scrollWidth === clientWidth. A scrollWidth-based check therefore
 * reports "no overflow" on a page whose controls are clipped and unreachable —
 * it silently turned an entire spec into a no-op once already.
 */

/** Serialized into the page by several probes below. */
const HELPERS = `
  const vw = () => document.documentElement.clientWidth;
  const vh = () => document.documentElement.clientHeight;

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

  const visible = (el) => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    if (Number(cs.opacity) === 0) return false;
    return true;
  };

  const describe = (el) => {
    const cls = String(el.className || '').split(' ').filter(Boolean).slice(0, 3).join('.');
    const id = el.id ? '#' + el.id : '';
    return el.tagName.toLowerCase() + id + (cls ? '.' + cls : '');
  };
`;

/** Build a page.evaluate body with the helpers above in scope. */
function probe(body) {
  return new Function(`${HELPERS}\n${body}`);
}

/**
 * Elements whose box extends past the right edge of the viewport, ignoring
 *   - elements clipped by a scrollable ancestor (an intentional scroll region,
 *     e.g. the category strip or the admin table), and
 *   - off-canvas fixed panels that are currently closed (the cart drawer).
 * Returns a human-readable string, or null when the layout is contained.
 */
async function horizontalOverflow(page) {
  return page.evaluate(probe(`
    const offenders = [...document.querySelectorAll('body *')]
      .filter((el) => {
        if (!visible(el)) return false;
        if (insideClosedPanel(el)) return false;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.right <= vw() + 1) return false;
        return !containedByScroller(el);
      })
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      .sort((a, b) => b.r.right - a.r.right);

    if (!offenders.length) return null;
    const { el, r } = offenders[0];
    return 'content overflows viewport ' + vw() + 'px — ' + describe(el) +
      ' extends to ' + Math.round(r.right) + 'px (' + offenders.length + ' offending elements)';
  `));
}

/** Header controls sitting outside the viewport horizontally. */
async function offscreenControls(page) {
  return page.evaluate(probe(`
    const out = [];
    for (const el of document.querySelectorAll('.header-right .icon-action-btn, .brand-logo, .mode-toggle-pill')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;   // legitimately hidden
      if (!visible(el)) continue;
      if (r.right > vw() + 1 || r.left < -1) {
        const label = (el.getAttribute('title') || el.innerText || el.className).trim().split('\\n')[0];
        out.push('"' + label + '" spans ' + Math.round(r.left) + '..' + Math.round(r.right) + 'px in a ' + vw() + 'px viewport');
      }
    }
    return out;
  `));
}

/**
 * Interactive controls inside `selector` that cannot be brought on-screen.
 *
 * A control below the fold is only a defect when nothing can scroll it into
 * view. Page scrolling rescues normal flow content, but NOT content inside a
 * position:fixed subtree (every modal here) — that needs a scrollable ancestor
 * within the fixed subtree. This is the failure that makes a mobile checkout
 * impossible to complete while every "does it overflow sideways" check passes.
 */
async function unreachableActions(page, selector) {
  return page.evaluate(probe(`
    const root = document.querySelector(arguments[0]);
    if (!root) return ['container ' + arguments[0] + ' not found'];

    const scrollableWithin = (el, stopAt) => {
      for (let p = el; p && p !== stopAt.parentElement; p = p.parentElement) {
        const cs = getComputedStyle(p);
        const oy = cs.overflowY;
        if ((oy === 'auto' || oy === 'scroll') && p.scrollHeight > p.clientHeight + 1) return true;
      }
      return false;
    };

    const fixedRoot = (el) => {
      for (let p = el; p && p !== document.body; p = p.parentElement) {
        if (getComputedStyle(p).position === 'fixed') return p;
      }
      return null;
    };

    const out = [];
    const controls = root.querySelectorAll('button, a[href], input, select, textarea, [onclick]');
    for (const el of controls) {
      if (!visible(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const below = r.bottom > vh() + 1;
      const above = r.top < -1;
      if (!below && !above) continue;

      const fx = fixedRoot(el);
      const rescued = fx ? scrollableWithin(el, fx) : (document.documentElement.scrollHeight > vh() + 1);
      if (rescued) continue;

      const label = (el.innerText || el.value || el.getAttribute('placeholder') || el.id || describe(el)).trim().split('\\n')[0];
      out.push('"' + label.slice(0, 40) + '" (' + describe(el) + ') sits at y=' +
        Math.round(r.top) + '..' + Math.round(r.bottom) + ' in a ' + vh() + 'px viewport with nothing to scroll it into view');
    }
    return out;
  `), selector);
}

/** Visible controls smaller than the 44x44 CSS-px minimum touch target. */
async function smallTapTargets(page, selector, min = 44) {
  return page.evaluate(probe(`
    const min = arguments[1];
    const out = [];
    for (const el of document.querySelectorAll(arguments[0])) {
      if (!visible(el) || insideClosedPanel(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.width < min || r.height < min) {
        const label = (el.getAttribute('title') || el.innerText || describe(el)).trim().split('\\n')[0];
        out.push('"' + label.slice(0, 30) + '" is ' + Math.round(r.width) + 'x' + Math.round(r.height) + 'px');
      }
    }
    return out;
  `), selector, min);
}

/** Number of columns a CSS grid is actually rendering (by distinct child x-offsets). */
async function gridColumns(page, selector) {
  return page.evaluate((s) => {
    const grid = document.querySelector(s);
    if (!grid) return 0;
    const kids = [...grid.children].filter((c) => c.getBoundingClientRect().width > 0);
    if (!kids.length) return 0;
    const top = Math.round(kids[0].getBoundingClientRect().top);
    return kids.filter((c) => Math.abs(Math.round(c.getBoundingClientRect().top) - top) < 4).length;
  }, selector);
}

module.exports = {
  horizontalOverflow, offscreenControls, unreachableActions, smallTapTargets, gridColumns,
};

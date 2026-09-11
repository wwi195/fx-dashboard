(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.FX = root.FX || {};
    Object.assign(root.FX, factory());
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  function parseAmount(raw) {
    if (raw === null || raw === undefined) return { ok: false, raw: raw };
    var s = String(raw).replace(/\\/g, '').trim();
    if (s === '') return { ok: false, raw: raw };
    if (!/^-?\d/.test(s)) return { ok: false, raw: raw };
    var matches = s.match(/-?\d+(\.\d+)?/g) || [];
    if (matches.length === 0 || matches.length > 2) return { ok: false, raw: raw };
    var pnl = parseFloat(matches[0]);
    var swap = matches.length === 2 ? parseFloat(matches[1]) : 0;
    return { ok: true, pnl: pnl, swap: swap };
  }

  return {
    parseAmount: parseAmount
  };
});

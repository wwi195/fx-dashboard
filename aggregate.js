(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.FX = root.FX || {};
    Object.assign(root.FX, factory());
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  function periodRange(key, now) {
    if (key === 'all') return null;
    if (key === 'month') {
      return { start: new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0), end: now };
    }
    if (key === 'week') {
      var day = now.getDay();
      var diffToMonday = day === 0 ? 6 : day - 1;
      var start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMonday, 0, 0, 0);
      return { start: start, end: now };
    }
    if (key === '7d') {
      var start7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return { start: start7, end: now };
    }
    return null;
  }

  return {
    periodRange: periodRange
  };
});

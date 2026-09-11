(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.FX = root.FX || {};
    Object.assign(root.FX, factory());
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  var MAX_DIFF_MS = 7 * 24 * 60 * 60 * 1000;

  function linkTrades(entries, exits) {
    var candidates = [];

    exits.forEach(function (exit, exitIdx) {
      if (!exit.entryDateTime || !exit.entryDateTime.ok) return;
      entries.forEach(function (entry, entryIdx) {
        if (!entry.timestamp || !entry.timestamp.ok) return;
        if (entry.pair !== exit.pair) return;
        if (entry.direction !== exit.direction) return;
        if (entry.lot === null || exit.lot === null || entry.lot !== exit.lot) return;
        var diff = Math.abs(exit.entryDateTime.date.getTime() - entry.timestamp.date.getTime());
        if (diff > MAX_DIFF_MS) return;
        candidates.push({ exitIdx: exitIdx, entryIdx: entryIdx, diff: diff });
      });
    });

    candidates.sort(function (a, b) { return a.diff - b.diff; });

    var usedExit = {};
    var usedEntry = {};
    var matchedEntryForExit = {};

    candidates.forEach(function (c) {
      if (usedExit[c.exitIdx] || usedEntry[c.entryIdx]) return;
      usedExit[c.exitIdx] = true;
      usedEntry[c.entryIdx] = true;
      matchedEntryForExit[c.exitIdx] = c.entryIdx;
    });

    var trades = exits.map(function (exit, exitIdx) {
      var entryIdx = matchedEntryForExit[exitIdx];
      var entry = entryIdx !== undefined ? entries[entryIdx] : null;
      var trade = {};
      Object.keys(exit).forEach(function (k) { trade[k] = exit[k]; });
      trade.entry = entry;
      return trade;
    });

    var unmatchedEntries = entries.filter(function (entry, idx) { return !usedEntry[idx]; });

    return { trades: trades, unmatchedEntries: unmatchedEntries };
  }

  return {
    linkTrades: linkTrades
  };
});

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

  function filterValidTrades(trades) {
    return trades.filter(function (t) {
      return t.amount && t.amount.ok && t.exitDateTime && t.exitDateTime.ok;
    });
  }

  function filterByPeriod(trades, period) {
    if (!period) return trades;
    return trades.filter(function (t) {
      var time = t.exitDateTime.date.getTime();
      return time >= period.start.getTime() && time <= period.end.getTime();
    });
  }

  function formatDateKey(date) {
    var y = date.getFullYear();
    var m = String(date.getMonth() + 1);
    var d = String(date.getDate());
    if (m.length < 2) m = '0' + m;
    if (d.length < 2) d = '0' + d;
    return y + '-' + m + '-' + d;
  }

  function sum(arr) {
    return arr.reduce(function (a, b) { return a + b; }, 0);
  }

  function summarize(trades, period) {
    var valid = filterValidTrades(trades);
    var excludedCount = trades.length - valid.length;
    var inRange = filterByPeriod(valid, period);

    var pnlSum = 0;
    var swapSum = 0;
    var wins = [];
    var losses = [];
    var dailyMap = {};
    var pairDirMap = {};

    inRange.forEach(function (t) {
      var pnl = t.amount.pnl;
      var swap = t.amount.swap;
      pnlSum += pnl;
      swapSum += swap;
      if (pnl > 0) wins.push(pnl);
      if (pnl < 0) losses.push(pnl);

      var dateKey = formatDateKey(t.exitDateTime.date);
      dailyMap[dateKey] = (dailyMap[dateKey] || 0) + pnl;

      var pdKey = t.pair + '|' + t.direction;
      if (!pairDirMap[pdKey]) {
        pairDirMap[pdKey] = { pair: t.pair, direction: t.direction, pnlSum: 0, count: 0, wins: 0 };
      }
      pairDirMap[pdKey].pnlSum += pnl;
      pairDirMap[pdKey].count += 1;
      if (pnl > 0) pairDirMap[pdKey].wins += 1;
    });

    var count = inRange.length;
    var winRate = count > 0 ? wins.length / count : null;
    var avgWin = wins.length > 0 ? sum(wins) / wins.length : null;
    var avgLoss = losses.length > 0 ? Math.abs(sum(losses)) / losses.length : null;
    var rr = avgWin !== null && avgLoss !== null && avgLoss > 0 ? avgWin / avgLoss : null;
    var maxWin = wins.length > 0 ? Math.max.apply(null, wins) : null;
    var maxLoss = losses.length > 0 ? Math.min.apply(null, losses) : null;

    var dailyPnl = Object.keys(dailyMap).sort().map(function (k) {
      return { date: k, pnl: dailyMap[k] };
    });
    var byPairDirection = Object.keys(pairDirMap).map(function (k) {
      var e = pairDirMap[k];
      return {
        pair: e.pair,
        direction: e.direction,
        pnlSum: e.pnlSum,
        count: e.count,
        winRate: e.count > 0 ? e.wins / e.count : null
      };
    });

    return {
      pnlSum: pnlSum,
      swapSum: swapSum,
      total: pnlSum + swapSum,
      count: count,
      winRate: winRate,
      avgWin: avgWin,
      avgLoss: avgLoss,
      rr: rr,
      maxWin: maxWin,
      maxLoss: maxLoss,
      dailyPnl: dailyPnl,
      byPairDirection: byPairDirection,
      excludedCount: excludedCount
    };
  }

  return {
    periodRange: periodRange,
    filterValidTrades: filterValidTrades,
    filterByPeriod: filterByPeriod,
    summarize: summarize
  };
});

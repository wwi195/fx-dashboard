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

  // 1ロット・1pipsあたりの円額。ユーザーの取引ルールに基づく固定値。
  var YEN_PER_PIP_PER_LOT = 100;

  // 期間開始時を0円として、決済日時順に累積と最大ドローダウンを計算する。
  // 最大ドローダウンはスワップ込みの累積で、日中の下落も含めるためトレード単位で求める。
  function cumulativeStats(trades) {
    var sorted = trades.slice().sort(function (a, b) {
      return a.exitDateTime.date.getTime() - b.exitDateTime.date.getTime();
    });
    var points = [];
    var pnl = 0;
    var total = 0;
    var peak = 0;
    var maxDrawdown = 0;

    sorted.forEach(function (t) {
      pnl += t.amount.pnl;
      total += t.amount.pnl + t.amount.swap;
      peak = Math.max(peak, total);
      maxDrawdown = Math.max(maxDrawdown, peak - total);

      var date = formatDateKey(t.exitDateTime.date);
      var last = points[points.length - 1];
      if (last && last.date === date) {
        last.pnl = pnl;
        last.total = total;
      } else {
        points.push({ date: date, pnl: pnl, total: total });
      }
    });

    return { points: points, maxDrawdown: sorted.length > 0 ? maxDrawdown : null };
  }

  function summarize(trades, period) {
    var valid = filterValidTrades(trades);
    var excludedCount = trades.length - valid.length;
    var inRange = filterByPeriod(valid, period);

    var pnlSum = 0;
    var swapSum = 0;
    var wins = [];
    var losses = [];
    var winsPips = [];
    var lossesPips = [];
    var dailyMap = {};
    var pairDirMap = {};

    inRange.forEach(function (t) {
      var pnl = t.amount.pnl;
      var swap = t.amount.swap;
      pnlSum += pnl;
      swapSum += swap;
      if (pnl > 0) wins.push(pnl);
      if (pnl < 0) losses.push(pnl);

      if (t.lot) {
        var pips = pnl / (YEN_PER_PIP_PER_LOT * t.lot);
        if (pnl > 0) winsPips.push(pips);
        if (pnl < 0) lossesPips.push(pips);
      }

      var dateKey = formatDateKey(t.exitDateTime.date);
      if (!dailyMap[dateKey]) dailyMap[dateKey] = { pnl: 0, count: 0 };
      dailyMap[dateKey].pnl += pnl;
      dailyMap[dateKey].count += 1;

      var pdKey = t.pair + '|' + t.direction;
      if (!pairDirMap[pdKey]) {
        pairDirMap[pdKey] = { pair: t.pair, direction: t.direction, pnlSum: 0, swapSum: 0, count: 0, wins: 0 };
      }
      pairDirMap[pdKey].pnlSum += pnl;
      pairDirMap[pdKey].swapSum += swap;
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
    var avgWinPips = winsPips.length > 0 ? sum(winsPips) / winsPips.length : null;
    var avgLossPips = lossesPips.length > 0 ? Math.abs(sum(lossesPips)) / lossesPips.length : null;

    var dailyPnl = Object.keys(dailyMap).sort().map(function (k) {
      return { date: k, pnl: dailyMap[k].pnl, count: dailyMap[k].count };
    });
    var byPairDirection = Object.keys(pairDirMap).map(function (k) {
      var e = pairDirMap[k];
      return {
        pair: e.pair,
        direction: e.direction,
        pnlSum: e.pnlSum,
        swapSum: e.swapSum,
        totalSum: e.pnlSum + e.swapSum,
        count: e.count,
        winRate: e.count > 0 ? e.wins / e.count : null
      };
    });

    var cumulative = cumulativeStats(inRange);

    return {
      cumulative: cumulative.points,
      maxDrawdown: cumulative.maxDrawdown,
      pnlSum: pnlSum,
      swapSum: swapSum,
      total: pnlSum + swapSum,
      count: count,
      winRate: winRate,
      avgWin: avgWin,
      avgLoss: avgLoss,
      avgWinPips: avgWinPips,
      avgLossPips: avgLossPips,
      rr: rr,
      maxWin: maxWin,
      maxLoss: maxLoss,
      dailyPnl: dailyPnl,
      byPairDirection: byPairDirection,
      excludedCount: excludedCount
    };
  }

  // 直近limit件のトレードを古い順に並べ、最新から数えた相対ラベルを付ける。
  // 呼び出し側で有効なトレード(amount.ok && exitDateTime.ok)に絞ってから渡すこと。
  function recentTradesSeries(trades, limit) {
    var sorted = trades.slice().sort(function (a, b) {
      return a.exitDateTime.date.getTime() - b.exitDateTime.date.getTime();
    });
    var recent = limit ? sorted.slice(-limit) : sorted;
    var n = recent.length;
    return recent.map(function (t, i) {
      var distanceFromLatest = n - 1 - i;
      var label = distanceFromLatest === 0 ? '最新' : (distanceFromLatest + 1) + '件前';
      var pips = t.lot ? t.amount.pnl / (YEN_PER_PIP_PER_LOT * t.lot) : null;
      return { label: label, pnl: t.amount.pnl, lot: t.lot, pips: pips };
    });
  }

  // スワップ明細を新しい順に返す。paidは負の値。
  // 呼び出し側で有効なトレード(amount.ok && exitDateTime.ok)を期間で絞ってから渡すこと。
  function swapBreakdown(trades) {
    var items = trades.filter(function (t) {
      return t.amount.swap !== 0;
    }).sort(function (a, b) {
      return b.exitDateTime.date.getTime() - a.exitDateTime.date.getTime();
    }).map(function (t) {
      return {
        date: t.exitDateTime.date,
        pair: t.pair,
        direction: t.direction,
        lot: t.lot,
        swap: t.amount.swap
      };
    });

    var received = 0;
    var paid = 0;
    items.forEach(function (item) {
      if (item.swap > 0) received += item.swap;
      else paid += item.swap;
    });

    return { items: items, received: received, paid: paid, total: received + paid };
  }

  return {
    swapBreakdown: swapBreakdown,
    periodRange: periodRange,
    filterValidTrades: filterValidTrades,
    filterByPeriod: filterByPeriod,
    summarize: summarize,
    recentTradesSeries: recentTradesSeries
  };
});

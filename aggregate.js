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

  // 「根拠通りだったか」などの回答を書き出しで判定する。過去の記録は自由記述が多いため。
  // 判定できなければnullを返す。
  function classifyAnswer(raw) {
    var s = String(raw === undefined || raw === null ? '' : raw).normalize('NFKC').trim();
    if (/^yes/i.test(s) || /^根拠通り/.test(s)) return 'YES';
    if (/^no(?![a-z])/i.test(s)) return 'NO';
    if (/^不明/.test(s)) return '不明';
    return null;
  }

  var RULE_GROUPS = [
    { key: 'YES', label: 'YES' },
    { key: 'NO', label: 'NO' },
    { key: '不明', label: '不明' },
    { key: 'other', label: '未分類' }
  ];

  function compareBy(trades, keyOf) {
    var map = {};
    trades.forEach(function (t) {
      var key = keyOf(t);
      if (!map[key]) map[key] = { count: 0, wins: 0, pnlSum: 0 };
      map[key].count += 1;
      map[key].pnlSum += t.amount.pnl;
      if (t.amount.pnl > 0) map[key].wins += 1;
    });
    var rows = RULE_GROUPS.filter(function (g) { return map[g.key]; }).map(function (g) {
      var e = map[g.key];
      return { key: g.key, label: g.label, count: e.count, winRate: e.wins / e.count, avgPnl: e.pnlSum / e.count, pnlSum: e.pnlSum };
    });
    var yes = map.YES;
    var no = map.NO;
    return { rows: rows, gap: yes && no ? yes.pnlSum / yes.count - no.pnlSum / no.count : null };
  }

  // ルールを守ったかどうか別の成績。金額は損益のみ（スワップは保有日数で決まるため含めない）。
  // gapはYESの平均損益からNOの平均損益を引いた値。
  // 呼び出し側で有効なトレード(amount.ok && exitDateTime.ok)を期間で絞ってから渡すこと。
  function ruleComparison(trades) {
    return {
      oco: compareBy(trades, function (t) {
        return t.ocoFollowed === true ? 'YES' : (t.ocoFollowed === false ? 'NO' : '不明');
      }),
      scenario: compareBy(trades, function (t) {
        return classifyAnswer(t.matchedScenario) || 'other';
      })
    };
  }

  // 2026-11に追加した「行動」の選択式項目。選択肢の並び順で表示する。
  var BEHAVIOR_OPTIONS = {
    setupType: ['押し目買い・戻り売り', '逆張り（RSIなど）', 'トレンドに乗る', '高値・安値ブレイク', '指標・介入・ニュース', '直感'],
    mindset: ['冷静', '取り返したい', '焦り・退屈', '勝って勢いづいている'],
    exitMethod: ['OCO（利確・損切）に到達', '事前に決めた条件で手動決済', '気持ちで手動決済'],
    manualReason: ['利益を守りたくなった', '損失が怖くなった', '時間切れ', '根拠が崩れた', '生活の都合', 'その他']
  };
  var UNRECORDED = '未記入';

  function behaviorValue(trade, field) {
    var source = (field === 'setupType' || field === 'mindset') ? trade.entry : trade;
    var v = source && source[field] ? String(source[field]).trim() : '';
    return v === '' ? UNRECORDED : v;
  }

  // 項目ごとの成績。金額は損益のみ。手動決済の理由は、理由が記入されたトレードだけを数える。
  // 呼び出し側で有効なトレードを期間で絞ってから渡すこと。
  function behaviorComparison(trades, field) {
    var options = BEHAVIOR_OPTIONS[field] || [];
    var map = {};
    var order = [];
    trades.forEach(function (t) {
      var key = behaviorValue(t, field);
      if (field === 'manualReason' && key === UNRECORDED) return;
      if (!map[key]) { map[key] = { count: 0, wins: 0, pnlSum: 0 }; order.push(key); }
      map[key].count += 1;
      map[key].pnlSum += t.amount.pnl;
      if (t.amount.pnl > 0) map[key].wins += 1;
    });
    function rank(key) {
      if (key === UNRECORDED) return 1e6;
      var i = options.indexOf(key);
      return i === -1 ? 1000 + order.indexOf(key) : i;
    }
    var keys = order.slice().sort(function (a, b) { return rank(a) - rank(b); });
    var rows = keys.map(function (key) {
      var e = map[key];
      return { key: key, label: key, count: e.count, winRate: e.wins / e.count, avgPnl: e.pnlSum / e.count, pnlSum: e.pnlSum };
    });
    var recorded = rows.filter(function (r) { return r.key !== UNRECORDED; });
    return { rows: rows, recordedCount: recorded.reduce(function (n, r) { return n + r.count; }, 0) };
  }

  var PIPS_PER_YEN_PRICE = 100;   // 1pips = 0.01円
  var MAX_PLAN_PIPS = 300;        // これを超える計画幅は打ち間違いとみなす
  var EARLY_TP_RATIO = 0.9;       // 利確目標の9割未満で勝ったら「目標前に利確」
  var OVER_SL_R = -1.1;           // 損切り幅の1.1倍を超えて負けたら「損切り超え」

  // 「157.2」「156.571円」「161.7(IFO設定…)」のように先頭が数字なら、その数字を返す。
  function leadingNumber(raw) {
    var s = String(raw === undefined || raw === null ? '' : raw).normalize('NFKC').trim();
    var m = s.match(/^(\d+(?:\.\d+)?)\s*円?\s*(?:[(（].*)?$/);
    return m ? parseFloat(m[1]) : null;
  }

  function roundTenth(x) {
    return Math.round(x * 10) / 10;
  }

  // エントリー前の計画（利確と損切りの幅, pips）。新しい記録はpips欄、過去の記録は価格の差から求める。
  // 読めない、方向と逆、幅が大きすぎる場合はnull。
  function tradePlan(trade) {
    var e = trade.entry;
    if (!e) return null;
    if (trade.direction !== '買い' && trade.direction !== '売り') return null;
    var sign = trade.direction === '買い' ? 1 : -1;
    var price = leadingNumber(e.entryPrice);

    function distance(pipsRaw, priceRaw, towardProfit) {
      var pips = leadingNumber(pipsRaw);
      if (pips !== null) return pips;
      var target = leadingNumber(priceRaw);
      if (price === null || target === null) return null;
      var diff = (target - price) * sign * (towardProfit ? 1 : -1);
      return roundTenth(diff * PIPS_PER_YEN_PRICE);
    }

    var tp = distance(e.tpPips, e.tpPrice, true);
    var sl = distance(e.slPips, e.slPrice, false);
    if (tp === null || sl === null) return null;
    if (tp <= 0 || sl <= 0 || tp > MAX_PLAN_PIPS || sl > MAX_PLAN_PIPS) return null;
    return { tpPips: tp, slPips: sl };
  }

  // 計画に対する結果。resultPipsは損益から逆算したpips、rは損切り幅を1とした倍率。
  function tradeOutcome(trade) {
    var plan = tradePlan(trade);
    if (!plan || !trade.lot || !trade.amount || !trade.amount.ok) return null;
    var resultPips = trade.amount.pnl / (YEN_PER_PIP_PER_LOT * trade.lot);
    return { plan: plan, resultPips: resultPips, r: resultPips / plan.slPips };
  }

  function average(arr) {
    return arr.length > 0 ? sum(arr) / arr.length : null;
  }

  // 計画と結果のズレの集計。
  // 呼び出し側で有効なトレード(amount.ok && exitDateTime.ok)を期間で絞ってから渡すこと。
  function planVsResult(trades) {
    var outcomes = trades.map(tradeOutcome).filter(function (o) { return o !== null; });
    var wins = outcomes.filter(function (o) { return o.resultPips > 0; });
    var losses = outcomes.filter(function (o) { return o.resultPips < 0; });
    return {
      count: outcomes.length,
      excluded: trades.length - outcomes.length,
      plannedRR: average(outcomes.map(function (o) { return o.plan.tpPips / o.plan.slPips; })),
      avgR: average(outcomes.map(function (o) { return o.r; })),
      winCount: wins.length,
      avgTpReach: average(wins.map(function (o) { return o.resultPips / o.plan.tpPips; })),
      earlyTpCount: wins.filter(function (o) { return o.resultPips < o.plan.tpPips * EARLY_TP_RATIO; }).length,
      lossCount: losses.length,
      avgLossR: average(losses.map(function (o) { return o.r; })),
      overSlCount: losses.filter(function (o) { return o.r < OVER_SL_R; }).length
    };
  }

  return {
    tradePlan: tradePlan,
    tradeOutcome: tradeOutcome,
    planVsResult: planVsResult,
    classifyAnswer: classifyAnswer,
    ruleComparison: ruleComparison,
    behaviorComparison: behaviorComparison,
    BEHAVIOR_OPTIONS: BEHAVIOR_OPTIONS,
    swapBreakdown: swapBreakdown,
    periodRange: periodRange,
    filterValidTrades: filterValidTrades,
    filterByPeriod: filterByPeriod,
    summarize: summarize,
    recentTradesSeries: recentTradesSeries
  };
});

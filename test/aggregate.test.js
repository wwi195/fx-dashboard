var FX = typeof module === 'object' ? require('../aggregate.js') : window.FX;
var T = typeof module === 'object' ? require('./harness.js') : window.FXTest;

T.test('periodRange: allはnull', function () {
  T.assertEqual(FX.periodRange('all', new Date(2026, 8, 15, 10, 0, 0)), null);
});

T.test('periodRange: monthは当月1日0時からnowまで', function () {
  var now = new Date(2026, 8, 15, 10, 30, 0);
  var r = FX.periodRange('month', now);
  T.assertDateEqual(r.start, new Date(2026, 8, 1, 0, 0, 0));
  T.assertDateEqual(r.end, now);
});

T.test('periodRange: weekは直近月曜0時からnowまで', function () {
  var now = new Date(2026, 8, 15, 10, 30, 0);
  var r = FX.periodRange('week', now);
  T.assertEqual(r.start.getDay(), 1);
  T.assertEqual(r.start.getHours(), 0);
  T.assertEqual(r.start.getMinutes(), 0);
  T.assertTrue(r.start.getTime() <= now.getTime());
  T.assertTrue(now.getTime() - r.start.getTime() < 7 * 24 * 60 * 60 * 1000);
  T.assertDateEqual(r.end, now);
});

T.test('periodRange: 7dはnowの7日前ちょうどからnowまで', function () {
  var now = new Date(2026, 8, 15, 10, 30, 0);
  var r = FX.periodRange('7d', now);
  T.assertEqual(r.end.getTime() - r.start.getTime(), 7 * 24 * 60 * 60 * 1000);
  T.assertDateEqual(r.end, now);
});

function trade(pair, direction, pnl, swap, exitDateOk, exitDate, lot) {
  return {
    pair: pair,
    direction: direction,
    lot: lot === undefined ? null : lot,
    amount: { ok: true, pnl: pnl, swap: swap },
    exitDateTime: { ok: exitDateOk, date: exitDate }
  };
}

function buildFixture() {
  return [
    trade('ドル円', '買い', 1000, 0, true, new Date(2026, 8, 1, 10, 0, 0), 5),
    trade('ドル円', '買い', -500, 0, true, new Date(2026, 8, 1, 12, 0, 0), 3),
    trade('ドル円', '売り', 2000, 0, true, new Date(2026, 8, 2, 9, 0, 0), 10),
    { pair: 'メキシコペソ円', direction: '買い', lot: 10, amount: { ok: true, pnl: -1000, swap: 300 }, exitDateTime: { ok: true, date: new Date(2026, 8, 3, 8, 0, 0) } },
    { pair: 'ドル円', direction: '買い', lot: 5, amount: { ok: false, raw: '???' }, exitDateTime: { ok: true, date: new Date(2026, 8, 1, 9, 0, 0) } }
  ];
}

T.test('filterValidTrades: 金額または日時が失敗した記録を除外する', function () {
  var trades = buildFixture();
  var valid = FX.filterValidTrades(trades);
  T.assertEqual(valid.length, 4);
});

T.test('filterByPeriod: nullなら全件通す', function () {
  var trades = buildFixture();
  T.assertEqual(FX.filterByPeriod(trades, null).length, 5);
});

T.test('filterByPeriod: 範囲内のみ残す', function () {
  var trades = buildFixture();
  var period = { start: new Date(2026, 8, 2, 0, 0, 0), end: new Date(2026, 8, 3, 23, 59, 59) };
  var result = FX.filterByPeriod(trades, period);
  T.assertEqual(result.length, 2);
});

T.test('summarize: 5件フィクスチャで全指標を検証', function () {
  var s = FX.summarize(buildFixture(), null);

  T.assertEqual(s.excludedCount, 1);
  T.assertEqual(s.count, 4);
  T.assertEqual(s.pnlSum, 1500);
  T.assertEqual(s.swapSum, 300);
  T.assertEqual(s.total, 1800);
  T.assertEqual(s.winRate, 0.5);
  T.assertEqual(s.avgWin, 1500);
  T.assertEqual(s.avgLoss, 750);
  T.assertEqual(s.rr, 2);
  T.assertEqual(s.maxWin, 2000);
  T.assertEqual(s.maxLoss, -1000);

  // pips換算: 1ロット・1pips = 100円。
  // 勝ち: T1(1000円,5ロット)=2pips, T3(2000円,10ロット)=2pips → 平均2pips
  // 負け: T2(-500円,3ロット)=-1.666...pips, T4(-1000円,10ロット)=-1pips → 平均絶対値1.333...pips
  T.assertTrue(Math.abs(s.avgWinPips - 2) < 1e-9, 'avgWinPips: ' + s.avgWinPips);
  T.assertTrue(Math.abs(s.avgLossPips - 4 / 3) < 1e-9, 'avgLossPips: ' + s.avgLossPips);

  T.assertEqual(s.dailyPnl, [
    { date: '2026-09-01', pnl: 500, count: 2 },
    { date: '2026-09-02', pnl: 2000, count: 1 },
    { date: '2026-09-03', pnl: -1000, count: 1 }
  ]);

  var byPd = {};
  s.byPairDirection.forEach(function (d) { byPd[d.pair + '|' + d.direction] = d; });
  T.assertEqual(byPd['ドル円|買い'], { pair: 'ドル円', direction: '買い', pnlSum: 500, count: 2, winRate: 0.5 });
  T.assertEqual(byPd['ドル円|売り'], { pair: 'ドル円', direction: '売り', pnlSum: 2000, count: 1, winRate: 1 });
  T.assertEqual(byPd['メキシコペソ円|買い'], { pair: 'メキシコペソ円', direction: '買い', pnlSum: -1000, count: 1, winRate: 0 });
});

T.test('summarize: トレード0件ならwinRate/avgWin/avgLoss/rr/maxWin/maxLossはnull', function () {
  var s = FX.summarize([], null);
  T.assertEqual(s.count, 0);
  T.assertEqual(s.winRate, null);
  T.assertEqual(s.avgWin, null);
  T.assertEqual(s.avgLoss, null);
  T.assertEqual(s.rr, null);
  T.assertEqual(s.maxWin, null);
  T.assertEqual(s.maxLoss, null);
  T.assertEqual(s.avgWinPips, null);
  T.assertEqual(s.avgLossPips, null);
});

T.test('summarize: ロットがnullのトレードは円平均には含むがpips平均からは除く', function () {
  var trades = [
    trade('ドル円', '買い', 1000, 0, true, new Date(2026, 8, 1, 10, 0, 0), null),
    trade('ドル円', '買い', 500, 0, true, new Date(2026, 8, 1, 11, 0, 0), 5)
  ];
  var s = FX.summarize(trades, null);
  T.assertEqual(s.avgWin, 750);
  T.assertTrue(Math.abs(s.avgWinPips - 1) < 1e-9, 'avgWinPips: ' + s.avgWinPips);
});

T.test('summarize: 負けトレードが0件ならrrはnull', function () {
  var trades = [trade('ドル円', '買い', 1000, 0, true, new Date(2026, 8, 1, 10, 0, 0))];
  var s = FX.summarize(trades, null);
  T.assertEqual(s.avgLoss, null);
  T.assertEqual(s.rr, null);
});

T.test('recentTradesSeries: 古い順に並べ、最新から数えたラベルを付ける', function () {
  var trades = [
    trade('ドル円', '買い', 100, 0, true, new Date(2026, 8, 1, 10, 0, 0)),
    trade('ドル円', '買い', -50, 0, true, new Date(2026, 8, 2, 10, 0, 0)),
    trade('ドル円', '買い', 200, 0, true, new Date(2026, 8, 3, 10, 0, 0)),
    trade('ドル円', '買い', -30, 0, true, new Date(2026, 8, 4, 10, 0, 0))
  ];
  var series = FX.recentTradesSeries(trades, 3);
  T.assertEqual(series, [
    { label: '3件前', pnl: -50 },
    { label: '2件前', pnl: 200 },
    { label: '最新', pnl: -30 }
  ]);
});

T.test('recentTradesSeries: limitが件数より多ければ全件を返す', function () {
  var trades = [
    trade('ドル円', '買い', 100, 0, true, new Date(2026, 8, 1, 10, 0, 0)),
    trade('ドル円', '買い', -50, 0, true, new Date(2026, 8, 2, 10, 0, 0))
  ];
  var series = FX.recentTradesSeries(trades, 10);
  T.assertEqual(series, [
    { label: '2件前', pnl: 100 },
    { label: '最新', pnl: -50 }
  ]);
});

T.test('recentTradesSeries: 並び順が古い順でなくても内部でソートする', function () {
  var trades = [
    trade('ドル円', '買い', -30, 0, true, new Date(2026, 8, 4, 10, 0, 0)),
    trade('ドル円', '買い', 100, 0, true, new Date(2026, 8, 1, 10, 0, 0)),
    trade('ドル円', '買い', 200, 0, true, new Date(2026, 8, 3, 10, 0, 0)),
    trade('ドル円', '買い', -50, 0, true, new Date(2026, 8, 2, 10, 0, 0))
  ];
  var series = FX.recentTradesSeries(trades, 2);
  T.assertEqual(series, [
    { label: '2件前', pnl: 200 },
    { label: '最新', pnl: -30 }
  ]);
});

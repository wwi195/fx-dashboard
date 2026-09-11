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

function trade(pair, direction, pnl, swap, exitDateOk, exitDate) {
  return {
    pair: pair,
    direction: direction,
    amount: { ok: true, pnl: pnl, swap: swap },
    exitDateTime: { ok: exitDateOk, date: exitDate }
  };
}

function buildFixture() {
  return [
    trade('ドル円', '買い', 1000, 0, true, new Date(2026, 8, 1, 10, 0, 0)),
    trade('ドル円', '買い', -500, 0, true, new Date(2026, 8, 1, 12, 0, 0)),
    trade('ドル円', '売り', 2000, 0, true, new Date(2026, 8, 2, 9, 0, 0)),
    { pair: 'メキシコペソ円', direction: '買い', amount: { ok: true, pnl: -1000, swap: 300 }, exitDateTime: { ok: true, date: new Date(2026, 8, 3, 8, 0, 0) } },
    { pair: 'ドル円', direction: '買い', amount: { ok: false, raw: '???' }, exitDateTime: { ok: true, date: new Date(2026, 8, 1, 9, 0, 0) } }
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

  T.assertEqual(s.dailyPnl, [
    { date: '2026-09-01', pnl: 500 },
    { date: '2026-09-02', pnl: 2000 },
    { date: '2026-09-03', pnl: -1000 }
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
});

T.test('summarize: 負けトレードが0件ならrrはnull', function () {
  var trades = [trade('ドル円', '買い', 1000, 0, true, new Date(2026, 8, 1, 10, 0, 0))];
  var s = FX.summarize(trades, null);
  T.assertEqual(s.avgLoss, null);
  T.assertEqual(s.rr, null);
});

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

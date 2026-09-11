var FX = typeof module === 'object' ? require('../chart-data.js') : window.FX;
var T = typeof module === 'object' ? require('./harness.js') : window.FXTest;

T.test('buildDailyChartConfig: labels/data/色を組み立てる', function () {
  var dailyPnl = [
    { date: '2026-09-01', pnl: 500 },
    { date: '2026-09-02', pnl: -200 }
  ];
  var config = FX.buildDailyChartConfig(dailyPnl);
  T.assertEqual(config.data.labels, ['2026-09-01', '2026-09-02']);
  T.assertEqual(config.data.datasets[0].data, [500, -200]);
  T.assertEqual(config.data.datasets[0].backgroundColor, ['#2f9e59', '#c0392b']);
  T.assertEqual(config.type, 'bar');
});

T.test('buildPairDirectionChartConfig: labels/data/色を組み立てる', function () {
  var byPairDirection = [
    { pair: 'ドル円', direction: '買い', pnlSum: 500, count: 2, winRate: 0.5 },
    { pair: 'メキシコペソ円', direction: '買い', pnlSum: -1000, count: 1, winRate: 0 }
  ];
  var config = FX.buildPairDirectionChartConfig(byPairDirection);
  T.assertEqual(config.data.labels, ['ドル円 買い', 'メキシコペソ円 買い']);
  T.assertEqual(config.data.datasets[0].data, [500, -1000]);
  T.assertEqual(config.data.datasets[0].backgroundColor, ['#2f9e59', '#c0392b']);
  T.assertEqual(config.options.indexAxis, 'y');
});

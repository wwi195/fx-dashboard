var FX = typeof module === 'object' ? require('../chart-data.js') : window.FX;
var T = typeof module === 'object' ? require('./harness.js') : window.FXTest;

T.test('buildDailyPnlChartConfig: labels/data/色を組み立てる', function () {
  var dailyPnl = [
    { date: '2026-09-01', pnl: 500, count: 2 },
    { date: '2026-09-02', pnl: -200, count: 1 }
  ];
  var config = FX.buildDailyPnlChartConfig(dailyPnl);
  T.assertEqual(config.data.labels, ['2026-09-01', '2026-09-02']);
  T.assertEqual(config.data.datasets[0].data, [500, -200]);
  T.assertEqual(config.data.datasets[0].backgroundColor, ['#2f9e59', '#c0392b']);
  T.assertEqual(config.type, 'bar');
});

T.test('buildRecentTradesChartConfig: labels/data/色を組み立てる', function () {
  var series = [
    { label: '2件前', pnl: 100 },
    { label: '最新', pnl: -50 }
  ];
  var config = FX.buildRecentTradesChartConfig(series);
  T.assertEqual(config.data.labels, ['2件前', '最新']);
  T.assertEqual(config.data.datasets[0].data, [100, -50]);
  T.assertEqual(config.data.datasets[0].backgroundColor, ['#2f9e59', '#c0392b']);
  T.assertEqual(config.type, 'bar');
});

T.test('buildRecentTradesChartConfig: ツールチップに損益/ロット/pipsを表示する', function () {
  var series = [
    { label: '2件前', pnl: 100, lot: 0.1, pips: 1000 },
    { label: '最新', pnl: -50, lot: null, pips: null }
  ];
  var config = FX.buildRecentTradesChartConfig(series);
  var labelFn = config.options.plugins.tooltip.callbacks.label;
  T.assertEqual(labelFn({ dataIndex: 0 }), ['損益: ¥+100', 'ロット: 0.1', 'pips: +1000.0']);
  T.assertEqual(labelFn({ dataIndex: 1 }), ['損益: ¥-50', 'ロット: -', 'pips: -']);
});

T.test('buildRecentTradesChartConfig: 横軸ラベルは5件おき+最新のみ表示する', function () {
  var n = 20;
  var series = [];
  for (var i = 0; i < n; i++) {
    var distanceFromLatest = n - 1 - i;
    var label = distanceFromLatest === 0 ? '最新' : (distanceFromLatest + 1) + '件前';
    series.push({ label: label, pnl: 0, lot: null, pips: null });
  }
  var config = FX.buildRecentTradesChartConfig(series);
  var tickFn = config.options.scales.x.ticks.callback;

  T.assertEqual(tickFn(null, 0), '20件前');
  T.assertEqual(tickFn(null, 5), '15件前');
  T.assertEqual(tickFn(null, 10), '10件前');
  T.assertEqual(tickFn(null, 15), '5件前');
  T.assertEqual(tickFn(null, 19), '最新');
  T.assertEqual(tickFn(null, 1), '');
  T.assertEqual(tickFn(null, 18), '');
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

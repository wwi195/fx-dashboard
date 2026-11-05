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

T.test('buildDailyPnlChartConfig: 横軸ラベルは先頭だけ年表記、他はM/D表記', function () {
  var dailyPnl = [
    { date: '2026-06-23', pnl: 500, count: 1 },
    { date: '2026-06-30', pnl: -200, count: 1 },
    { date: '2026-09-08', pnl: 100, count: 1 }
  ];
  var config = FX.buildDailyPnlChartConfig(dailyPnl);
  var tickFn = config.options.scales.x.ticks.callback;
  T.assertEqual(tickFn(null, 0), '2026/6/23');
  T.assertEqual(tickFn(null, 1), '6/30');
  T.assertEqual(tickFn(null, 2), '9/8');
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

T.test('buildPairDirectionChartConfig: totalならスワップ込みの値と色を使う', function () {
  var byPairDirection = [
    { pair: 'メキシコペソ円', direction: '買い', pnlSum: -1000, swapSum: 1500, totalSum: 500, count: 1, winRate: 0 }
  ];
  var config = FX.buildPairDirectionChartConfig(byPairDirection, 'total');
  T.assertEqual(config.data.datasets[0].data, [500]);
  T.assertEqual(config.data.datasets[0].backgroundColor, ['#2f9e59']);
  var pnlConfig = FX.buildPairDirectionChartConfig(byPairDirection, 'pnl');
  T.assertEqual(pnlConfig.data.datasets[0].data, [-1000]);
});

T.test('buildCumulativeChartConfig: スワップ込みと損益のみの2本の線を組み立てる', function () {
  var points = [
    { date: '2026-09-01', pnl: 500, total: 500 },
    { date: '2026-09-02', pnl: 300, total: 800 }
  ];
  var config = FX.buildCumulativeChartConfig(points);
  T.assertEqual(config.type, 'line');
  T.assertEqual(config.data.labels, ['2026-09-01', '2026-09-02']);
  T.assertEqual(config.data.datasets[0].label, 'スワップ込み');
  T.assertEqual(config.data.datasets[0].data, [500, 800]);
  T.assertEqual(config.data.datasets[1].label, 'トレード損益のみ');
  T.assertEqual(config.data.datasets[1].data, [500, 300]);
  T.assertEqual(config.options.plugins.legend.display, true);
  var tickFn = config.options.scales.x.ticks.callback;
  T.assertEqual(tickFn(null, 0), '2026/9/1');
  T.assertEqual(tickFn(null, 1), '9/2');
  var labelFn = config.options.plugins.tooltip.callbacks.label;
  T.assertEqual(labelFn({ dataset: { label: 'スワップ込み' }, parsed: { y: 800 } }), 'スワップ込み: ¥+800');
});

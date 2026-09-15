(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.FX = root.FX || {};
    Object.assign(root.FX, factory());
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  var COLOR_PLUS = '#2f9e59';
  var COLOR_MINUS = '#c0392b';

  function formatYen(n) {
    var sign = n >= 0 ? '+' : '';
    return '¥' + sign + Math.round(n).toLocaleString('ja-JP');
  }

  function formatPipsValue(n) {
    var sign = n >= 0 ? '+' : '';
    return sign + n.toFixed(1);
  }

  function buildDailyPnlChartConfig(dailyPnl) {
    return {
      type: 'bar',
      data: {
        labels: dailyPnl.map(function (d) { return d.date; }),
        datasets: [{
          data: dailyPnl.map(function (d) { return d.pnl; }),
          backgroundColor: dailyPnl.map(function (d) { return d.pnl >= 0 ? COLOR_PLUS : COLOR_MINUS; })
        }]
      },
      options: {
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true } }
      }
    };
  }

  function buildRecentTradesChartConfig(series) {
    return {
      type: 'bar',
      data: {
        labels: series.map(function (d) { return d.label; }),
        datasets: [{
          data: series.map(function (d) { return d.pnl; }),
          backgroundColor: series.map(function (d) { return d.pnl >= 0 ? COLOR_PLUS : COLOR_MINUS; })
        }]
      },
      options: {
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function (ctx) {
                var d = series[ctx.dataIndex];
                return [
                  '損益: ' + formatYen(d.pnl),
                  'ロット: ' + (d.lot !== null && d.lot !== undefined ? d.lot : '-'),
                  'pips: ' + (d.pips !== null && d.pips !== undefined ? formatPipsValue(d.pips) : '-')
                ];
              }
            }
          }
        },
        scales: {
          y: { beginAtZero: true },
          x: {
            ticks: {
              callback: function (value, index) {
                var total = series.length;
                var distanceFromLatest = total - 1 - index;
                if (distanceFromLatest === 0 || (distanceFromLatest + 1) % 5 === 0) {
                  return series[index].label;
                }
                return '';
              }
            }
          }
        }
      }
    };
  }

  function buildPairDirectionChartConfig(byPairDirection) {
    return {
      type: 'bar',
      data: {
        labels: byPairDirection.map(function (d) { return d.pair + ' ' + d.direction; }),
        datasets: [{
          data: byPairDirection.map(function (d) { return d.pnlSum; }),
          backgroundColor: byPairDirection.map(function (d) { return d.pnlSum >= 0 ? COLOR_PLUS : COLOR_MINUS; })
        }]
      },
      options: {
        indexAxis: 'y',
        plugins: { legend: { display: false } }
      }
    };
  }

  return {
    buildDailyPnlChartConfig: buildDailyPnlChartConfig,
    buildRecentTradesChartConfig: buildRecentTradesChartConfig,
    buildPairDirectionChartConfig: buildPairDirectionChartConfig
  };
});

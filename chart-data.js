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
  var COLOR_TOTAL = '#2563eb';
  var COLOR_PNL_ONLY = '#9ca3af';

  function formatYen(n) {
    var sign = n >= 0 ? '+' : '';
    return '¥' + sign + Math.round(n).toLocaleString('ja-JP');
  }

  function formatPipsValue(n) {
    var sign = n >= 0 ? '+' : '';
    return sign + n.toFixed(1);
  }

  function formatDailyAxisLabel(dateStr, isFirst) {
    var parts = dateStr.split('-');
    var y = parts[0];
    var m = String(Number(parts[1]));
    var d = String(Number(parts[2]));
    return isFirst ? (y + '/' + m + '/' + d) : (m + '/' + d);
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
        scales: {
          y: { beginAtZero: true },
          x: {
            ticks: {
              callback: function (value, index) {
                return formatDailyAxisLabel(dailyPnl[index].date, index === 0);
              }
            }
          }
        }
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

  function buildCumulativeChartConfig(points) {
    function line(label, key, color) {
      return {
        label: label,
        data: points.map(function (p) { return p[key]; }),
        borderColor: color,
        backgroundColor: color,
        borderWidth: 2,
        pointRadius: 0,
        pointHitRadius: 12,
        tension: 0
      };
    }

    return {
      type: 'line',
      data: {
        labels: points.map(function (p) { return p.date; }),
        datasets: [
          line('スワップ込み', 'total', COLOR_TOTAL),
          line('トレード損益のみ', 'pnl', COLOR_PNL_ONLY)
        ]
      },
      options: {
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: true, position: 'bottom', labels: { boxWidth: 14, boxHeight: 2 } },
          tooltip: {
            callbacks: {
              label: function (ctx) {
                return ctx.dataset.label + ': ' + formatYen(ctx.parsed.y);
              }
            }
          }
        },
        scales: {
          x: {
            ticks: {
              callback: function (value, index) {
                return formatDailyAxisLabel(points[index].date, index === 0);
              }
            }
          }
        }
      }
    };
  }

  function buildPairDirectionChartConfig(byPairDirection, metric) {
    function valueOf(d) {
      return metric === 'total' ? d.totalSum : d.pnlSum;
    }

    return {
      type: 'bar',
      data: {
        labels: byPairDirection.map(function (d) { return d.pair + ' ' + d.direction; }),
        datasets: [{
          data: byPairDirection.map(valueOf),
          backgroundColor: byPairDirection.map(function (d) { return valueOf(d) >= 0 ? COLOR_PLUS : COLOR_MINUS; })
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
    buildCumulativeChartConfig: buildCumulativeChartConfig,
    buildPairDirectionChartConfig: buildPairDirectionChartConfig
  };
});

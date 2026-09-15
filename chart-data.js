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
  var COLOR_ACCENT = '#2563eb';

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

  function buildDailyCountChartConfig(dailyPnl) {
    return {
      type: 'bar',
      data: {
        labels: dailyPnl.map(function (d) { return d.date; }),
        datasets: [{
          data: dailyPnl.map(function (d) { return d.count; }),
          backgroundColor: dailyPnl.map(function () { return COLOR_ACCENT; })
        }]
      },
      options: {
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
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
    buildDailyCountChartConfig: buildDailyCountChartConfig,
    buildPairDirectionChartConfig: buildPairDirectionChartConfig
  };
});

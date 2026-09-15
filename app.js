(function () {
  'use strict';

  function main() {
    var els = {
      errorBanner: document.getElementById('error-banner'),
      emptyState: document.getElementById('empty-state'),
      main: document.getElementById('app-main'),
      periodFilter: document.getElementById('period-filter'),
      summary: document.getElementById('summary-tiles'),
      dailyChartTabs: document.getElementById('daily-chart-tabs'),
      avgUnitSelect: document.getElementById('avg-unit-select'),
      dailyCanvas: document.getElementById('daily-chart'),
      pairDirectionCanvas: document.getElementById('pair-direction-chart'),
      pairDirectionList: document.getElementById('pair-direction-list'),
      tradeList: document.getElementById('trade-list')
    };

    var state = {
      trades: [],
      periodKey: 'all',
      dailyMetric: 'pnl',
      avgUnit: 'yen',
      dailyChart: null,
      pairDirectionChart: null
    };

    function showError(message) {
      FX.renderError(els.errorBanner, message);
      els.main.hidden = true;
    }

    function tradesForPeriod(allTrades, periodKey) {
      var period = FX.periodRange(periodKey, new Date());
      return allTrades.filter(function (t) {
        if (!t.exitDateTime || !t.exitDateTime.ok) {
          return periodKey === 'all';
        }
        return FX.filterByPeriod([t], period).length > 0;
      });
    }

    function rerender() {
      if (state.trades.length === 0) {
        els.emptyState.hidden = false;
        els.main.hidden = true;
        return;
      }

      els.emptyState.hidden = true;
      els.main.hidden = false;

      var period = FX.periodRange(state.periodKey, new Date());
      var summary = FX.summarize(state.trades, period);
      var visibleTrades = tradesForPeriod(state.trades, state.periodKey);

      FX.renderSummary(els.summary, summary, state.avgUnit);
      state.dailyChart = FX.renderDailyChart(els.dailyCanvas, summary.dailyPnl, state.dailyChart, state.dailyMetric);
      state.pairDirectionChart = FX.renderPairDirection(
        els.pairDirectionCanvas, els.pairDirectionList, summary.byPairDirection, state.pairDirectionChart
      );
      FX.renderTradeList(els.tradeList, visibleTrades);
    }

    function onPeriodClick(event) {
      var btn = event.target.closest('[data-period]');
      if (!btn) return;
      state.periodKey = btn.getAttribute('data-period');
      Array.prototype.forEach.call(els.periodFilter.querySelectorAll('[data-period]'), function (b) {
        b.classList.toggle('active', b === btn);
      });
      rerender();
    }

    function onDailyMetricClick(event) {
      var btn = event.target.closest('[data-daily-metric]');
      if (!btn) return;
      state.dailyMetric = btn.getAttribute('data-daily-metric');
      Array.prototype.forEach.call(els.dailyChartTabs.querySelectorAll('[data-daily-metric]'), function (b) {
        b.classList.toggle('active', b === btn);
      });
      rerender();
    }

    function onAvgUnitChange() {
      state.avgUnit = els.avgUnitSelect.value;
      rerender();
    }

    function fetchCsv(url) {
      return fetch(url).then(function (res) {
        if (!res.ok) throw new Error('HTTPエラー: ' + res.status);
        return res.text();
      });
    }

    els.periodFilter.addEventListener('click', onPeriodClick);
    els.dailyChartTabs.addEventListener('click', onDailyMetricClick);
    els.avgUnitSelect.addEventListener('change', onAvgUnitChange);

    if (!window.FX_CONFIG || !FX_CONFIG.CSV_ENTRY || !FX_CONFIG.CSV_EXIT) {
      showError(
        'CSVの公開URLが未設定です。config.js に、Googleスプレッドシートを「ウェブに公開（CSV形式）」して発行されたURLを2つとも貼ってください。'
      );
      return;
    }

    Promise.all([fetchCsv(FX_CONFIG.CSV_ENTRY), fetchCsv(FX_CONFIG.CSV_EXIT)])
      .then(function (texts) {
        var entryRows = FX.parseCsv(texts[0]).slice(1);
        var exitRows = FX.parseCsv(texts[1]).slice(1);
        var entries = FX.normalizeEntry(entryRows);
        var exits = FX.normalizeExit(exitRows);
        var linked = FX.linkTrades(entries, exits);
        state.trades = linked.trades;
        rerender();
      })
      .catch(function (err) {
        showError(
          'データの取得に失敗しました（' + err.message + '）。' +
          'スプレッドシートが「ウェブに公開」されているか、config.js のURLが正しいか確認してください。'
        );
      });
  }

  document.addEventListener('DOMContentLoaded', main);
})();

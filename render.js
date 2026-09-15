(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.FX = root.FX || {};
    Object.assign(root.FX, factory());
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  function formatMoney(n) {
    var sign = n >= 0 ? '+' : '';
    return '¥' + sign + Math.round(n).toLocaleString('ja-JP');
  }

  function formatPercent(x) {
    return x === null || x === undefined ? '-' : Math.round(x * 100) + '%';
  }

  function formatRR(x) {
    return x === null || x === undefined ? '-' : x.toFixed(2);
  }

  function formatDateTime(date) {
    var m = date.getMonth() + 1;
    var d = date.getDate();
    var hh = String(date.getHours());
    var mm = String(date.getMinutes());
    if (hh.length < 2) hh = '0' + hh;
    if (mm.length < 2) mm = '0' + mm;
    return m + '/' + d + ' ' + hh + ':' + mm;
  }

  function firstLine(text) {
    if (!text) return '';
    var line = String(text).split(/\r?\n/)[0];
    return line.length > 40 ? line.slice(0, 40) + '…' : line;
  }

  function renderError(container, message) {
    container.hidden = false;
    container.textContent = message;
  }

  function buildTile(label, value, positive) {
    var tile = document.createElement('div');
    tile.className = 'summary-tile ' + (positive ? 'pnl-plus' : 'pnl-minus');
    var labelEl = document.createElement('div');
    labelEl.className = 'summary-tile-label';
    labelEl.textContent = label;
    var valueEl = document.createElement('div');
    valueEl.className = 'summary-tile-value';
    valueEl.textContent = value;
    tile.appendChild(labelEl);
    tile.appendChild(valueEl);
    return tile;
  }

  function buildSubStat(label, value) {
    var el = document.createElement('div');
    el.className = 'summary-sub-stat';
    var labelEl = document.createElement('span');
    labelEl.className = 'summary-sub-label';
    labelEl.textContent = label;
    var valueEl = document.createElement('span');
    valueEl.className = 'summary-sub-value';
    valueEl.textContent = value;
    el.appendChild(labelEl);
    el.appendChild(valueEl);
    return el;
  }

  function renderSummary(container, summary) {
    container.innerHTML = '';

    var mainRow = document.createElement('div');
    mainRow.className = 'summary-main-row';
    mainRow.appendChild(buildTile('トレード損益', formatMoney(summary.pnlSum), summary.pnlSum >= 0));
    mainRow.appendChild(buildTile('スワップ', formatMoney(summary.swapSum), summary.swapSum >= 0));
    mainRow.appendChild(buildTile('合計', formatMoney(summary.total), summary.total >= 0));
    container.appendChild(mainRow);

    var subRow = document.createElement('div');
    subRow.className = 'summary-sub-row';
    subRow.appendChild(buildSubStat('勝率', formatPercent(summary.winRate)));
    subRow.appendChild(buildSubStat('トレード数', String(summary.count) + '件'));
    subRow.appendChild(buildSubStat('平均利益', summary.avgWin === null ? '-' : formatMoney(summary.avgWin)));
    subRow.appendChild(buildSubStat('平均損失', summary.avgLoss === null ? '-' : formatMoney(-summary.avgLoss)));
    subRow.appendChild(buildSubStat('RR比', formatRR(summary.rr)));
    subRow.appendChild(buildSubStat('最大勝ち', summary.maxWin === null ? '-' : formatMoney(summary.maxWin)));
    subRow.appendChild(buildSubStat('最大負け', summary.maxLoss === null ? '-' : formatMoney(summary.maxLoss)));
    container.appendChild(subRow);

    if (summary.excludedCount > 0) {
      var warn = document.createElement('p');
      warn.className = 'excluded-warn';
      warn.textContent = '要確認: ' + summary.excludedCount + '件（金額または日時が読み取れませんでした）';
      container.appendChild(warn);
    }
  }

  function renderDailyChart(canvas, dailyPnl, prevChart, metric) {
    if (prevChart) prevChart.destroy();
    var config = metric === 'count'
      ? FX.buildDailyCountChartConfig(dailyPnl)
      : FX.buildDailyPnlChartConfig(dailyPnl);
    return new Chart(canvas.getContext('2d'), config);
  }

  function renderPairDirection(canvas, listEl, byPairDirection, prevChart) {
    if (prevChart) prevChart.destroy();
    var config = FX.buildPairDirectionChartConfig(byPairDirection);
    var chart = new Chart(canvas.getContext('2d'), config);

    listEl.innerHTML = '';
    byPairDirection.forEach(function (d) {
      var li = document.createElement('li');
      var label = document.createElement('span');
      label.textContent = d.pair + ' ' + d.direction;
      var stats = document.createElement('span');
      stats.textContent = formatMoney(d.pnlSum) + '（' + d.count + '件 / 勝率' + formatPercent(d.winRate) + '）';
      li.appendChild(label);
      li.appendChild(stats);
      listEl.appendChild(li);
    });

    return chart;
  }

  function appendDetailRow(container, label, value) {
    var row = document.createElement('div');
    row.className = 'detail-row';
    var labelEl = document.createElement('span');
    labelEl.className = 'detail-label';
    labelEl.textContent = label;
    var valueEl = document.createElement('span');
    valueEl.className = 'detail-value';
    valueEl.textContent = value || '';
    row.appendChild(labelEl);
    row.appendChild(valueEl);
    container.appendChild(row);
  }

  function buildTradeCard(trade) {
    var card = document.createElement('div');
    card.className = 'trade-card';

    var needsReview = !trade.amount.ok || !trade.exitDateTime.ok;
    if (needsReview) {
      var badge = document.createElement('span');
      badge.className = 'badge badge-warn';
      badge.textContent = '要確認';
      card.appendChild(badge);
    }

    var header = document.createElement('div');
    header.className = 'trade-card-header';

    var dateText;
    if (trade.entryDateTime.ok && trade.exitDateTime.ok) {
      dateText = formatDateTime(trade.entryDateTime.date) + ' → ' + formatDateTime(trade.exitDateTime.date);
    } else if (trade.exitDateTime.ok) {
      dateText = '→ ' + formatDateTime(trade.exitDateTime.date);
    } else {
      dateText = '日時不明';
    }
    var dateEl = document.createElement('div');
    dateEl.className = 'trade-card-date';
    dateEl.textContent = dateText;
    header.appendChild(dateEl);

    var pairEl = document.createElement('div');
    pairEl.className = 'trade-card-pair';
    pairEl.textContent = trade.pair + ' ' + trade.direction + ' ' + trade.lot + 'ロット';
    header.appendChild(pairEl);

    var pnlEl = document.createElement('div');
    pnlEl.className = 'trade-card-pnl ' + (trade.amount.ok && trade.amount.pnl >= 0 ? 'pnl-plus' : 'pnl-minus');
    pnlEl.textContent = trade.amount.ok ? formatMoney(trade.amount.pnl) : '要確認: ' + trade.amount.raw;
    header.appendChild(pnlEl);

    card.appendChild(header);

    var summaryLine = document.createElement('div');
    summaryLine.className = 'trade-card-summary-line';
    summaryLine.textContent = trade.entry ? '根拠: ' + firstLine(trade.entry.rationale) : 'エントリー記録なし';
    card.appendChild(summaryLine);

    var details = document.createElement('div');
    details.className = 'trade-card-details';
    details.hidden = true;

    if (trade.entry) {
      appendDetailRow(details, 'エントリー価格', trade.entry.entryPrice);
      appendDetailRow(details, '利確価格', trade.entry.tpPrice);
      appendDetailRow(details, '損切価格', trade.entry.slPrice);
      appendDetailRow(details, '根拠', trade.entry.rationale);
      appendDetailRow(details, 'シナリオが成立しない条件', trade.entry.invalidateCondition);
    } else {
      appendDetailRow(details, 'エントリー記録', 'なし');
    }
    appendDetailRow(details, 'OCO通り決済か', trade.ocoFollowed === true ? 'YES' : (trade.ocoFollowed === false ? 'NO' : '不明'));
    if (trade.ocoFollowed === false) {
      appendDetailRow(details, 'NOの場合理由', trade.ocoReason);
    }
    appendDetailRow(details, '①の根拠通りだったか', trade.matchedScenario);

    card.appendChild(details);

    card.addEventListener('click', function () {
      details.hidden = !details.hidden;
    });

    return card;
  }

  function renderTradeList(container, trades) {
    container.innerHTML = '';
    if (trades.length === 0) {
      var empty = document.createElement('p');
      empty.className = 'empty-note';
      empty.textContent = 'この期間のトレードはありません。';
      container.appendChild(empty);
      return;
    }

    var sorted = trades.slice().sort(function (a, b) {
      var at = a.exitDateTime && a.exitDateTime.ok ? a.exitDateTime.date.getTime() : -Infinity;
      var bt = b.exitDateTime && b.exitDateTime.ok ? b.exitDateTime.date.getTime() : -Infinity;
      return bt - at;
    });

    sorted.forEach(function (trade) {
      container.appendChild(buildTradeCard(trade));
    });
  }

  return {
    renderError: renderError,
    renderSummary: renderSummary,
    renderDailyChart: renderDailyChart,
    renderPairDirection: renderPairDirection,
    renderTradeList: renderTradeList
  };
});

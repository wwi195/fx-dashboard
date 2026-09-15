# 「直近20件」チャート: ロット/pips表示・ラベル間引き・日別横軸の年表記整理 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 日別推移の「直近20件」タブで、各バーをタップ/ホバーした時にロット数とpipsも見えるようにし、横軸のラベル（○件前）を5件おき+「最新」だけに間引いて見やすくする。あわせて「日別」タブの横軸日付も、先頭だけ年表記・残りは月/日表記にして見やすくする。

**Architecture:** `aggregate.js`の`recentTradesSeries`が返す各要素に`lot`/`pips`を追加する（純粋関数、副作用なし）。`chart-data.js`の`buildRecentTradesChartConfig`と`buildDailyPnlChartConfig`にChart.jsのツールチップ`callbacks.label`・x軸`ticks.callback`を追加し、追加データ・見やすい表示形式を画面に反映する。`render.js`/`app.js`はデータを素通しするだけなので変更不要。

**Tech Stack:** Vanilla JS（UMDモジュール）、Chart.js 4.4.1、Node.jsテストランナー（`test/run.js`）

設計書: `docs/superpowers/specs/2026-09-16-recent-trades-tooltip-design.md`

---

### Task 1: `recentTradesSeries`にlot/pipsを追加する

**Files:**
- Modify: `aggregate.js:144-157`
- Test: `test/aggregate.test.js`

- [ ] **Step 1: 既存テストの期待値を更新し、新しいテストを追加する（失敗させる）**

`test/aggregate.test.js`の末尾にある`recentTradesSeries`のテスト3件を、以下の内容で置き換える（各期待オブジェクトに`lot: null, pips: null`を追加）。さらに、lotがある場合にpipsが算出されることを確認するテストを1件追加する。

```javascript
T.test('recentTradesSeries: 古い順に並べ、最新から数えたラベルを付ける', function () {
  var trades = [
    trade('ドル円', '買い', 100, 0, true, new Date(2026, 8, 1, 10, 0, 0)),
    trade('ドル円', '買い', -50, 0, true, new Date(2026, 8, 2, 10, 0, 0)),
    trade('ドル円', '買い', 200, 0, true, new Date(2026, 8, 3, 10, 0, 0)),
    trade('ドル円', '買い', -30, 0, true, new Date(2026, 8, 4, 10, 0, 0))
  ];
  var series = FX.recentTradesSeries(trades, 3);
  T.assertEqual(series, [
    { label: '3件前', pnl: -50, lot: null, pips: null },
    { label: '2件前', pnl: 200, lot: null, pips: null },
    { label: '最新', pnl: -30, lot: null, pips: null }
  ]);
});

T.test('recentTradesSeries: limitが件数より多ければ全件を返す', function () {
  var trades = [
    trade('ドル円', '買い', 100, 0, true, new Date(2026, 8, 1, 10, 0, 0)),
    trade('ドル円', '買い', -50, 0, true, new Date(2026, 8, 2, 10, 0, 0))
  ];
  var series = FX.recentTradesSeries(trades, 10);
  T.assertEqual(series, [
    { label: '2件前', pnl: 100, lot: null, pips: null },
    { label: '最新', pnl: -50, lot: null, pips: null }
  ]);
});

T.test('recentTradesSeries: 並び順が古い順でなくても内部でソートする', function () {
  var trades = [
    trade('ドル円', '買い', -30, 0, true, new Date(2026, 8, 4, 10, 0, 0)),
    trade('ドル円', '買い', 100, 0, true, new Date(2026, 8, 1, 10, 0, 0)),
    trade('ドル円', '買い', 200, 0, true, new Date(2026, 8, 3, 10, 0, 0)),
    trade('ドル円', '買い', -50, 0, true, new Date(2026, 8, 2, 10, 0, 0))
  ];
  var series = FX.recentTradesSeries(trades, 2);
  T.assertEqual(series, [
    { label: '2件前', pnl: 200, lot: null, pips: null },
    { label: '最新', pnl: -30, lot: null, pips: null }
  ]);
});

T.test('recentTradesSeries: lotがあればpipsを算出する(YEN_PER_PIP_PER_LOT=100)', function () {
  var trades = [
    trade('ドル円', '買い', 14000, 0, true, new Date(2026, 8, 1, 10, 0, 0), 0.1)
  ];
  var series = FX.recentTradesSeries(trades, 1);
  T.assertEqual(series, [
    { label: '最新', pnl: 14000, lot: 0.1, pips: 1400 }
  ]);
});
```

- [ ] **Step 2: テストを実行し、失敗を確認する**

Run: `node test/run.js`
Expected: `recentTradesSeries`関連の4テストがFAIL（`lot`/`pips`が`undefined`のため期待値と不一致、または新規テストで`pips`が`undefined`のためFAIL）

- [ ] **Step 3: `aggregate.js`を実装する**

`aggregate.js:144-157`の`recentTradesSeries`を以下に置き換える。

```javascript
  // 直近limit件のトレードを古い順に並べ、最新から数えた相対ラベルを付ける。
  // 呼び出し側で有効なトレード(amount.ok && exitDateTime.ok)に絞ってから渡すこと。
  function recentTradesSeries(trades, limit) {
    var sorted = trades.slice().sort(function (a, b) {
      return a.exitDateTime.date.getTime() - b.exitDateTime.date.getTime();
    });
    var recent = limit ? sorted.slice(-limit) : sorted;
    var n = recent.length;
    return recent.map(function (t, i) {
      var distanceFromLatest = n - 1 - i;
      var label = distanceFromLatest === 0 ? '最新' : (distanceFromLatest + 1) + '件前';
      var pips = t.lot ? t.amount.pnl / (YEN_PER_PIP_PER_LOT * t.lot) : null;
      return { label: label, pnl: t.amount.pnl, lot: t.lot, pips: pips };
    });
  }
```

（`YEN_PER_PIP_PER_LOT`は`aggregate.js:57`で既に定義済みの定数をそのまま使う）

- [ ] **Step 4: テストを実行し、成功を確認する**

Run: `node test/run.js`
Expected: 全テストPASS（末尾に `XX passed, 0 failed` と表示される）

- [ ] **Step 5: コミット**

```bash
git add aggregate.js test/aggregate.test.js
git commit -m "feat: recentTradesSeriesにlot/pipsを追加"
```

---

### Task 2: 「直近20件」チャートにツールチップとラベル間引きを実装する

**Files:**
- Modify: `chart-data.js:11-12`（定数追加）, `chart-data.js:31-46`（`buildRecentTradesChartConfig`）
- Test: `test/chart-data.test.js`

- [ ] **Step 1: 失敗するテストを書く**

`test/chart-data.test.js`の`buildRecentTradesChartConfig: labels/data/色を組み立てる`テストの直後に、以下2件のテストを追加する。

```javascript
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
```

- [ ] **Step 2: テストを実行し、失敗を確認する**

Run: `node test/run.js`
Expected: 追加した2テストがFAIL（`config.options.plugins.tooltip`や`config.options.scales.x`が`undefined`のためTypeError、またはJSON比較で不一致）

- [ ] **Step 3: `chart-data.js`を実装する**

まず`chart-data.js:11-12`の定数宣言の直後（13行目）にフォーマット用のヘルパー関数を追加する。

```javascript
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
```

次に`chart-data.js:31-46`の`buildRecentTradesChartConfig`を以下に置き換える。

```javascript
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
```

- [ ] **Step 4: テストを実行し、成功を確認する**

Run: `node test/run.js`
Expected: 全テストPASS

- [ ] **Step 5: コミット**

```bash
git add chart-data.js test/chart-data.test.js
git commit -m "feat: 直近20件チャートにロット/pipsツールチップと横軸ラベル間引きを追加"
```

---

### Task 4: 「日別」タブの横軸日付を先頭だけ年表記にする

**Files:**
- Modify: `chart-data.js`（`buildDailyPnlChartConfig`とその直前のヘルパー群）
- Test: `test/chart-data.test.js`

Task 2実施後、`chart-data.js`には`formatYen`/`formatPipsValue`ヘルパーと
`buildDailyPnlChartConfig`が定義されている。`buildDailyPnlChartConfig`関数
本体をこのTaskで書き換える。

- [ ] **Step 1: 失敗するテストを書く**

`test/chart-data.test.js`の`buildDailyPnlChartConfig: labels/data/色を組み立てる`
テストの直後に、以下のテストを追加する。

```javascript
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
```

- [ ] **Step 2: テストを実行し、失敗を確認する**

Run: `node test/run.js`
Expected: 追加したテストがFAIL（`config.options.scales.x`が`undefined`のためTypeError）

- [ ] **Step 3: `chart-data.js`を実装する**

`formatYen`/`formatPipsValue`の直後（`buildDailyPnlChartConfig`関数の直前）に、
日付フォーマット用のヘルパーを追加する。

```javascript
  function formatDailyAxisLabel(dateStr, isFirst) {
    var parts = dateStr.split('-');
    var y = parts[0];
    var m = String(Number(parts[1]));
    var d = String(Number(parts[2]));
    return isFirst ? (y + '/' + m + '/' + d) : (m + '/' + d);
  }
```

`buildDailyPnlChartConfig`関数を以下に置き換える。

```javascript
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
```

- [ ] **Step 4: テストを実行し、成功を確認する**

Run: `node test/run.js`
Expected: 全テストPASS

- [ ] **Step 5: コミット**

```bash
git add chart-data.js test/chart-data.test.js
git commit -m "feat: 日別タブの横軸日付を先頭だけ年表記・残りはM/D表記に変更"
```

---

### Task 5: 実ブラウザで動作確認し、GitHub Pagesに反映する

**Files:** なし（コード変更なし。動作確認とデプロイのみ）

- [ ] **Step 1: ローカルサーバーでdev.htmlを開く**

Run（プロジェクトルートで別プロセスとして起動）: `python -m http.server 8765`

`http://localhost:8765/dev.html` をブラウザで開く。

- [ ] **Step 2: 「直近20件」タブと「日別」タブで見た目を確認する**

「日別推移」の「直近20件」タブをクリックし、以下を目視確認する。
- 横軸のラベルが「最新」と5件おきのラベル（5件前/10件前/15件前/20件前）だけになっている（バーの本数自体は変わらず20本のまま）
- 任意のバーをクリック（またはホバー）し、ツールチップに「損益」「ロット」「pips」の3行が表示される
- ロット/pipsが取得できないトレード（`lot`が`null`）では「ロット: -」「pips: -」と表示される

続けて「日別」タブをクリックし、以下を目視確認する。
- 横軸の1本目だけ「YYYY/M/D」（年あり）、2本目以降は「M/D」（年なし）になっている

期待通りでなければ、Task 1/2/4の実装を見直す。

- [ ] **Step 3: リモートにpushし、GitHub Pagesに反映する**

```bash
git push origin master
```

反映まで数十秒〜数分かかる場合がある。`https://wwi195.github.io/fx-dashboard/` を開き、実データで同様にツールチップ・ラベル間引き・日別タブの日付表記を確認する。

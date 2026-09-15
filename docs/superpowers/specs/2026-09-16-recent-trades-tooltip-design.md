# 「直近20件」チャート: ロット/pips表示とラベル間引き 設計書

作成日: 2026-09-16

## 1. 目的

日別推移の「直近20件」タブ（各バー＝トレード1回分の損益）に、ロット数とpipsも
確認できるようにする。あわせて、横軸のラベル（「20件前」〜「最新」）が20個並んで
見づらいため、5件おきに間引いて表示する。

## 2. 対象外

- 既存の集計ロジック（`summarize`）や日別タブへの変更はなし
- バーの本数（20本）は変更しない。間引くのはラベルの表示のみ

## 3. データ拡張: `aggregate.js`

`recentTradesSeries(trades, limit)` の戻り値に `lot` と `pips` を追加する。

```
{ label: string, pnl: number, lot: number|null, pips: number|null }
```

- `lot`: `t.lot`（元々`normalizeEntry`/`normalizeExit`で数値化済み、なければ`null`）
- `pips`: `t.lot`が truthy なら `t.amount.pnl / (YEN_PER_PIP_PER_LOT * t.lot)`、
  そうでなければ`null`（`summarize`内の既存ロジックと同じ式を再利用）

## 4. 表示: `chart-data.js`

`buildRecentTradesChartConfig(series)` を拡張する。

### 4.1 ツールチップ

`options.plugins.tooltip.callbacks.label` をカスタマイズし、タップ/ホバー時に
3行で表示する。

```
損益: +14,000円
ロット: 0.1
pips: +140
```

`lot`/`pips`が`null`の場合はそれぞれ「ロット: -」「pips: -」と表示する。
pipsの符号は損益の符号に一致させる（既存の円表示と同じ形式で整数表示）。

### 4.2 横軸ラベルの間引き

`options.scales.x.ticks.callback` を追加。表示するのは「最新」と、
そこから5件おきのラベルのみ（例: 20件中なら 20件前/15件前/10件前/5件前/最新）。
間引かれるのはティックの文字だけで、バーの本数・ツールチップのタイトル
（元のラベル）はそのまま。

判定式（`series`をクロージャで参照。`index`は0始まり、`total = series.length`）:

```
distanceFromLatest = total - 1 - index
show = (distanceFromLatest === 0) || ((distanceFromLatest + 1) % 5 === 0)
```

## 5. 影響を受けないファイル

`render.js` / `app.js` はデータを素通しするだけなので変更不要。

## 6. テスト

- `test/aggregate.test.js`: `recentTradesSeries`が`lot`/`pips`を正しく算出する
  こと（lotありの通常ケース、lot=nullのケース）
- `test/chart-data.test.js`: `buildRecentTradesChartConfig`のツールチップ
  コールバックが期待通りの3行を返すこと、x軸ticksコールバックが
  5件おき+最新のみを表示すること

# 「直近20件」チャート: ロット/pips表示とラベル間引き 設計書

作成日: 2026-09-16

## 1. 目的

日別推移の「直近20件」タブ（各バー＝トレード1回分の損益）に、ロット数とpipsも
確認できるようにする。あわせて、横軸のラベル（「20件前」〜「最新」）が20個並んで
見づらいため、5件おきに間引いて表示する。

また、「日別」タブの横軸も日付がフル表記（例: `2026-09-08`）で長く読みにくいため、
1本目だけ年を含む表記にし、2本目以降は月/日だけの表記にする。

## 2. 対象外

- 既存の集計ロジック（`summarize`）への変更はなし
- 「直近20件」タブのバーの本数（20本）は変更しない。間引くのはラベルの表示のみ
- 「日別」タブのバーの本数・集計内容は変更しない。変更するのは横軸ラベルの表示形式のみ

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

## 5. 表示: `chart-data.js`（日別タブの横軸）

`buildDailyPnlChartConfig(dailyPnl)` に `options.scales.x.ticks.callback` を追加する。
`dailyPnl[i].date` は`aggregate.js`の`formatDateKey`が生成する `YYYY-MM-DD` 形式の文字列。

- `index === 0`（先頭のバー）: `YYYY/M/D`（例: `2026/6/23`）
- それ以外: `M/D`（例: `9/8`）

`data.labels`自体（ツールチップのタイトルに使われる元のラベル）は変更しない。
変更するのはx軸のティック表示のみ。

## 6. 影響を受けないファイル

`render.js` / `app.js` はデータを素通しするだけなので変更不要。

## 7. テスト

- `test/aggregate.test.js`: `recentTradesSeries`が`lot`/`pips`を正しく算出する
  こと（lotありの通常ケース、lot=nullのケース）
- `test/chart-data.test.js`:
  - `buildRecentTradesChartConfig`のツールチップコールバックが期待通りの3行を
    返すこと、x軸ticksコールバックが5件おき+最新のみを表示すること
  - `buildDailyPnlChartConfig`のx軸ticksコールバックが、先頭のみ`YYYY/M/D`、
    それ以外は`M/D`を返すこと

# FXトレード・ダッシュボード Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Googleフォームの「FXエントリー前記録」「FX決済後記録」の2シートを、GitHub Pages上のスマホ向け1画面（成績グラフ＋全トレード一覧）で可視化する。

**Architecture:** ビルド不要の素のHTML/CSS/JS。`parse.js`/`match.js`/`aggregate.js`/`chart-data.js`は副作用のない純粋関数のみで構成し、Node（`node test/run.js`）とブラウザ（`test/index.html`）の両方から同じテストコードで検証する（UMDパターンで二重公開）。`render.js`/`app.js`がDOM・fetchを扱う。

**Tech Stack:** Vanilla JS（ES5構文でNode/ブラウザ両対応）、Chart.js 4.4.4（cdnjs CDN）、GitHub Pages。ビルドツール・npm依存なし。

参照仕様書: `docs/superpowers/specs/2026-09-11-fx-dashboard-design.md`

---

## 事前に共有する設計判断（仕様書には無いが実装上必要だったもの）

- **一覧のカードにも期間フィルタを適用する。** ただし日時パースに失敗したレコードは「全期間」表示時のみ一覧に出し、「要確認」バッジを付ける（期間の判定ができないため）。
- `aggregate.js` に `filterValidTrades` / `filterByPeriod` を公開関数として切り出し、`summarize` と一覧表示の両方から同じロジックを使う（DRY）。
- テスト実行は `node test/run.js`（このセッションでの検証用）と、ブラウザで開く `test/index.html`（利用者向け、仕様書8節の要件）の両方を用意する。テストケース自体は同じファイル（`test/*.test.js`）を両方から読み込む。

---

### Task 1: リポジトリ骨格の作成

**Files:**
- Create: `.gitignore`
- Create: `parse.js`（空のUMD雛形）
- Create: `match.js`（空のUMD雛形）
- Create: `aggregate.js`（空のUMD雛形）
- Create: `chart-data.js`（空のUMD雛形）
- Create: `test/` ディレクトリ

- [ ] **Step 1: `.gitignore` を作成**

```
.DS_Store
Thumbs.db
*.log
```

- [ ] **Step 2: 空のUMDモジュール雛形を4つ作成**

`parse.js`:
```js
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.FX = root.FX || {};
    Object.assign(root.FX, factory());
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  return {};
});
```

`match.js` / `aggregate.js` / `chart-data.js` も同一内容で作成する（`return {}` のみ）。

- [ ] **Step 3: Node から読み込めることを確認**

Run: `node -e "console.log(require('./parse.js')); console.log(require('./match.js')); console.log(require('./aggregate.js')); console.log(require('./chart-data.js'))"`
Expected: `{}` が4回出力される（エラーなし）

- [ ] **Step 4: コミット**

```bash
git add .gitignore parse.js match.js aggregate.js chart-data.js
git commit -m "chore: モジュール骨格を作成"
```

---

### Task 2: テストハーネス（`test/harness.js`）

テスト基盤そのものなのでTDDの対象外とする（これ自体をテストする独立したテスト対象が存在しないため）。書いた直後にNodeで動作確認する。

**Files:**
- Create: `test/harness.js`

- [ ] **Step 1: `test/harness.js` を作成**

```js
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.FXTest = factory();
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  var tests = [];

  function test(name, fn) {
    tests.push({ name: name, fn: fn });
  }

  function run() {
    var results = [];
    var passCount = 0;
    var failCount = 0;
    tests.forEach(function (t) {
      try {
        t.fn();
        results.push({ name: t.name, pass: true });
        passCount += 1;
      } catch (e) {
        results.push({ name: t.name, pass: false, error: e.message });
        failCount += 1;
      }
    });
    return { results: results, passCount: passCount, failCount: failCount };
  }

  function assertEqual(actual, expected, message) {
    var a = JSON.stringify(actual);
    var e = JSON.stringify(expected);
    if (a !== e) {
      throw new Error((message ? message + ': ' : '') + 'expected ' + e + ' but got ' + a);
    }
  }

  function assertTrue(condition, message) {
    if (!condition) {
      throw new Error(message || 'expected condition to be true');
    }
  }

  function assertDateEqual(actual, expected, message) {
    if (!(actual instanceof Date) || !(expected instanceof Date) || actual.getTime() !== expected.getTime()) {
      throw new Error(
        (message ? message + ': ' : '') +
        'expected date ' + (expected instanceof Date ? expected.toISOString() : String(expected)) +
        ' but got ' + (actual instanceof Date ? actual.toISOString() : String(actual))
      );
    }
  }

  return {
    test: test,
    run: run,
    assertEqual: assertEqual,
    assertTrue: assertTrue,
    assertDateEqual: assertDateEqual
  };
});
```

- [ ] **Step 2: 動作確認**

Run:
```bash
node -e "
var T = require('./test/harness.js');
T.test('sample pass', function () { T.assertEqual(1 + 1, 2); });
T.test('sample fail', function () { T.assertEqual(1 + 1, 3); });
var r = T.run();
console.log(JSON.stringify(r, null, 2));
"
```
Expected: `passCount: 1`, `failCount: 1`、2件目の `error` に `expected 3 but got 2` を含む文字列が出力される

- [ ] **Step 3: コミット**

```bash
git add test/harness.js
git commit -m "test: テストハーネスを追加"
```

---

### Task 3: `parse.parseAmount`

金額欄の6実在パターン＋失敗2パターンをTDDで実装する。

**Files:**
- Modify: `parse.js`
- Create: `test/parse.test.js`
- Modify: `test/run.js`（新規作成）

- [ ] **Step 1: 失敗するテストを書く**

`test/parse.test.js` を新規作成:
```js
var FX = typeof module === 'object' ? require('../parse.js') : window.FX;
var T = typeof module === 'object' ? require('./harness.js') : window.FXTest;

T.test('parseAmount: プラスのみ', function () {
  T.assertEqual(FX.parseAmount('1710'), { ok: true, pnl: 1710, swap: 0 });
});

T.test('parseAmount: マイナスのみ', function () {
  T.assertEqual(FX.parseAmount('-10000'), { ok: true, pnl: -10000, swap: 0 });
});

T.test('parseAmount: マイナス損益+カッコ付きスワップ', function () {
  T.assertEqual(FX.parseAmount('-6100(スワップ4940)'), { ok: true, pnl: -6100, swap: 4940 });
});

T.test('parseAmount: プラス損益+「スワップ」表記あり', function () {
  T.assertEqual(FX.parseAmount('84000+スワップ17520'), { ok: true, pnl: 84000, swap: 17520 });
});

T.test('parseAmount: マイナス損益+「スワップ」表記なし', function () {
  T.assertEqual(FX.parseAmount('-9400+2430'), { ok: true, pnl: -9400, swap: 2430 });
});

T.test('parseAmount: マイナス損益+「スワップ」表記+プラス記号', function () {
  T.assertEqual(FX.parseAmount('-200+スワップ3340'), { ok: true, pnl: -200, swap: 3340 });
});

T.test('parseAmount: 空文字は失敗', function () {
  T.assertEqual(FX.parseAmount('').ok, false);
});

T.test('parseAmount: 先頭が数値でない場合は失敗', function () {
  T.assertEqual(FX.parseAmount('不明').ok, false);
});

T.test('parseAmount: 数値が3つ以上は失敗', function () {
  T.assertEqual(FX.parseAmount('100+200+300').ok, false);
});
```

`test/run.js` を新規作成:
```js
require('./parse.test.js');

var harness = require('./harness.js');
var summary = harness.run();

summary.results.forEach(function (r) {
  console.log((r.pass ? 'PASS' : 'FAIL') + ' - ' + r.name + (r.pass ? '' : ' :: ' + r.error));
});
console.log('\n' + summary.passCount + ' passed, ' + summary.failCount + ' failed');
process.exit(summary.failCount > 0 ? 1 : 0);
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `node test/run.js`
Expected: 終了コード `1`。全9件が `FAIL`（`parseAmount is not a function` 系のエラー）

- [ ] **Step 3: `parse.js` に `parseAmount` を実装**

`parse.js` の中身を以下に置き換える:
```js
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.FX = root.FX || {};
    Object.assign(root.FX, factory());
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  function parseAmount(raw) {
    if (raw === null || raw === undefined) return { ok: false, raw: raw };
    var s = String(raw).replace(/\\/g, '').trim();
    if (s === '') return { ok: false, raw: raw };
    if (!/^-?\d/.test(s)) return { ok: false, raw: raw };
    var matches = s.match(/-?\d+(\.\d+)?/g) || [];
    if (matches.length === 0 || matches.length > 2) return { ok: false, raw: raw };
    var pnl = parseFloat(matches[0]);
    var swap = matches.length === 2 ? parseFloat(matches[1]) : 0;
    return { ok: true, pnl: pnl, swap: swap };
  }

  return {
    parseAmount: parseAmount
  };
});
```

- [ ] **Step 4: テストが通ることを確認**

Run: `node test/run.js`
Expected: 終了コード `0`。`9 passed, 0 failed`

- [ ] **Step 5: コミット**

```bash
git add parse.js test/parse.test.js test/run.js
git commit -m "feat: parseAmount(金額欄のパース)を実装"
```

---

### Task 4: `parse.parseDateTime`

日時欄の4実在パターン＋失敗1パターンをTDDで実装する。

**Files:**
- Modify: `parse.js`
- Modify: `test/parse.test.js`

- [ ] **Step 1: 失敗するテストを追記**

`test/parse.test.js` の末尾に追記:
```js
T.test('parseDateTime: フル表記', function () {
  var r = FX.parseDateTime('2026/09/03 15:47:50', null);
  T.assertTrue(r.ok);
  T.assertDateEqual(r.date, new Date(2026, 8, 3, 15, 47, 50));
});

T.test('parseDateTime: 年なし M/D H:MM', function () {
  var r = FX.parseDateTime('9/3 15:40', null);
  T.assertTrue(r.ok);
  T.assertDateEqual(r.date, new Date(2026, 8, 3, 15, 40, 0));
});

T.test('parseDateTime: 日付なし(fallbackDateを使う)', function () {
  var fallback = new Date(2026, 8, 3, 0, 0, 0);
  var r = FX.parseDateTime('18:02', fallback);
  T.assertTrue(r.ok);
  T.assertDateEqual(r.date, new Date(2026, 8, 3, 18, 2, 0));
});

T.test('parseDateTime: コロンがスラッシュのtypo', function () {
  var r = FX.parseDateTime('9/9 8/58', null);
  T.assertTrue(r.ok);
  T.assertDateEqual(r.date, new Date(2026, 8, 9, 8, 58, 0));
});

T.test('parseDateTime: 分が1桁', function () {
  var r = FX.parseDateTime('9/9 9:5', null);
  T.assertTrue(r.ok);
  T.assertDateEqual(r.date, new Date(2026, 8, 9, 9, 5, 0));
});

T.test('parseDateTime: 空文字は失敗', function () {
  T.assertEqual(FX.parseDateTime('', null).ok, false);
});

T.test('parseDateTime: 数字を含まない文字列は失敗', function () {
  T.assertEqual(FX.parseDateTime('abc', null).ok, false);
});

T.test('parseDateTime: 日付なし+fallbackDateもなしは失敗', function () {
  T.assertEqual(FX.parseDateTime('18:02', null).ok, false);
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `node test/run.js`
Expected: 新規追加した8件が `FAIL`（`parseDateTime is not a function`）。既存9件は `PASS` のまま

- [ ] **Step 3: `parse.js` に `parseDateTime` を追加**

`parse.js` の `parseAmount` 関数の下に追加し、`return` に含める:
```js
  function parseDateTime(raw, fallbackDate) {
    if (!raw) return { ok: false, raw: raw };
    var trimmed = String(raw).trim();
    var tokens = trimmed.split(/\s+/);
    var datePart = null;
    var timePart = null;

    if (tokens.length === 2) {
      datePart = tokens[0];
      timePart = tokens[1];
    } else if (tokens.length === 1) {
      if (/^\d{1,2}:\d{1,2}(:\d{1,2})?$/.test(tokens[0])) {
        timePart = tokens[0];
      } else {
        return { ok: false, raw: raw };
      }
    } else {
      return { ok: false, raw: raw };
    }

    var year, month, day;
    if (datePart) {
      var dateSegs = datePart.split('/');
      if (dateSegs.length === 3) {
        year = parseInt(dateSegs[0], 10);
        month = parseInt(dateSegs[1], 10);
        day = parseInt(dateSegs[2], 10);
      } else if (dateSegs.length === 2) {
        year = 2026;
        month = parseInt(dateSegs[0], 10);
        day = parseInt(dateSegs[1], 10);
      } else {
        return { ok: false, raw: raw };
      }
    } else {
      if (!fallbackDate) return { ok: false, raw: raw };
      year = fallbackDate.getFullYear();
      month = fallbackDate.getMonth() + 1;
      day = fallbackDate.getDate();
    }

    var hour, minute, second;
    second = 0;
    var timeSegs = timePart.indexOf(':') !== -1 ? timePart.split(':') : timePart.split('/');
    if (timeSegs.length < 2) return { ok: false, raw: raw };
    hour = parseInt(timeSegs[0], 10);
    minute = parseInt(timeSegs[1], 10);
    if (timeSegs.length >= 3) second = parseInt(timeSegs[2], 10);

    if ([year, month, day, hour, minute, second].some(function (n) { return isNaN(n); })) {
      return { ok: false, raw: raw };
    }
    if (month < 1 || month > 12 || day < 1 || day > 31 || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
      return { ok: false, raw: raw };
    }

    return { ok: true, date: new Date(year, month - 1, day, hour, minute, second) };
  }
```

`return` 文を更新:
```js
  return {
    parseAmount: parseAmount,
    parseDateTime: parseDateTime
  };
```

- [ ] **Step 4: テストが通ることを確認**

Run: `node test/run.js`
Expected: 終了コード `0`。`17 passed, 0 failed`

- [ ] **Step 5: コミット**

```bash
git add parse.js test/parse.test.js
git commit -m "feat: parseDateTime(日時欄のパース)を実装"
```

---

### Task 5: `parse.parseCsv`

引用符・カンマ・改行を含むセルに対応するCSVパーサをTDDで実装する。

**Files:**
- Modify: `parse.js`
- Modify: `test/parse.test.js`

- [ ] **Step 1: 失敗するテストを追記**

`test/parse.test.js` の末尾に追記:
```js
T.test('parseCsv: 引用符内のカンマ・改行・エスケープされた引用符', function () {
  var input = 'a,"b,c",d\n"e\nf",g,h\n"i""j",k,l';
  var rows = FX.parseCsv(input);
  T.assertEqual(rows, [
    ['a', 'b,c', 'd'],
    ['e\nf', 'g', 'h'],
    ['i"j', 'k', 'l']
  ]);
});

T.test('parseCsv: 末尾改行があっても空行を追加しない', function () {
  var rows = FX.parseCsv('a,b\nc,d\n');
  T.assertEqual(rows, [['a', 'b'], ['c', 'd']]);
});

T.test('parseCsv: CRLF区切りに対応', function () {
  var rows = FX.parseCsv('a,b\r\nc,d');
  T.assertEqual(rows, [['a', 'b'], ['c', 'd']]);
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `node test/run.js`
Expected: 追加した3件が `FAIL`（`parseCsv is not a function`）

- [ ] **Step 3: `parse.js` に `parseCsv` を追加**

`parseDateTime` 関数の下に追加し、`return` に含める:
```js
  function parseCsv(text) {
    var rows = [];
    var row = [];
    var field = '';
    var inQuotes = false;
    var i = 0;
    var len = text.length;

    function pushField() {
      row.push(field);
      field = '';
    }
    function pushRow() {
      pushField();
      rows.push(row);
      row = [];
    }

    while (i < len) {
      var ch = text[i];
      if (inQuotes) {
        if (ch === '"') {
          if (text[i + 1] === '"') {
            field += '"';
            i += 2;
            continue;
          } else {
            inQuotes = false;
            i += 1;
            continue;
          }
        } else {
          field += ch;
          i += 1;
          continue;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
          i += 1;
          continue;
        } else if (ch === ',') {
          pushField();
          i += 1;
          continue;
        } else if (ch === '\r') {
          i += 1;
          continue;
        } else if (ch === '\n') {
          pushRow();
          i += 1;
          continue;
        } else {
          field += ch;
          i += 1;
          continue;
        }
      }
    }

    if (field.length > 0 || row.length > 0) {
      pushRow();
    }

    return rows;
  }
```

`return` 文を更新:
```js
  return {
    parseAmount: parseAmount,
    parseDateTime: parseDateTime,
    parseCsv: parseCsv
  };
```

- [ ] **Step 4: テストが通ることを確認**

Run: `node test/run.js`
Expected: 終了コード `0`。`20 passed, 0 failed`

- [ ] **Step 5: コミット**

```bash
git add parse.js test/parse.test.js
git commit -m "feat: parseCsv(CSVパーサ)を実装"
```

---

### Task 6: `parse.normalizeEntry` / `parse.normalizeExit`

シートの列順（設計書2節）を前提に、行配列を型付きオブジェクトへ変換する。ヘッダー行は含めない（呼び出し側で`slice(1)`する）。

**Files:**
- Modify: `parse.js`
- Modify: `test/parse.test.js`

- [ ] **Step 1: 失敗するテストを追記**

`test/parse.test.js` の末尾に追記:
```js
T.test('normalizeEntry: 列順どおりに変換する', function () {
  var rows = [
    ['2026/06/19 23:19:28', 'ドル円', '売り', '2', '根拠テキスト', '161.38', '160.5', '161.7', '本日中']
  ];
  var result = FX.normalizeEntry(rows);
  T.assertEqual(result.length, 1);
  T.assertTrue(result[0].timestamp.ok);
  T.assertDateEqual(result[0].timestamp.date, new Date(2026, 5, 19, 23, 19, 28));
  T.assertEqual(result[0].pair, 'ドル円');
  T.assertEqual(result[0].direction, '売り');
  T.assertEqual(result[0].lot, 2);
  T.assertEqual(result[0].rationale, '根拠テキスト');
  T.assertEqual(result[0].entryPrice, '161.38');
  T.assertEqual(result[0].tpPrice, '160.5');
  T.assertEqual(result[0].slPrice, '161.7');
  T.assertEqual(result[0].invalidateCondition, '本日中');
});

T.test('normalizeExit: 日時のフォールバック連鎖(送信時刻→エントリー日時)', function () {
  var rows = [
    ['2026/09/03 18:06:03', 'ドル円', '買い', '10', '9/3 17:52', '18:02', '13700', 'NO', '理由', 'yes']
  ];
  var result = FX.normalizeExit(rows);
  T.assertTrue(result[0].entryDateTime.ok);
  T.assertDateEqual(result[0].entryDateTime.date, new Date(2026, 8, 3, 17, 52, 0));
  T.assertTrue(result[0].exitDateTime.ok);
  T.assertDateEqual(result[0].exitDateTime.date, new Date(2026, 8, 3, 18, 2, 0));
  T.assertEqual(result[0].pair, 'ドル円');
  T.assertEqual(result[0].direction, '買い');
  T.assertEqual(result[0].lot, 10);
  T.assertEqual(result[0].amount, { ok: true, pnl: 13700, swap: 0 });
  T.assertEqual(result[0].ocoFollowed, false);
  T.assertEqual(result[0].ocoReason, '理由');
  T.assertEqual(result[0].matchedScenario, 'yes');
});

T.test('normalizeExit: 決済がエントリーより前の時刻なら翌日とみなす', function () {
  var rows = [
    ['2026/09/03 23:00:00', 'ドル円', '買い', '10', '9/3 23:55', '0:08', '10500', 'NO', '理由', 'NO']
  ];
  var result = FX.normalizeExit(rows);
  T.assertDateEqual(result[0].entryDateTime.date, new Date(2026, 8, 3, 23, 55, 0));
  T.assertDateEqual(result[0].exitDateTime.date, new Date(2026, 8, 4, 0, 8, 0));
});

T.test('normalizeExit: YES/NO以外のOCO欄はnull', function () {
  var rows = [
    ['2026/09/01 0:00:00', 'ドル円', '買い', '1', '9/1 0:00', '9/1 0:10', '100', '', '', '']
  ];
  var result = FX.normalizeExit(rows);
  T.assertEqual(result[0].ocoFollowed, null);
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `node test/run.js`
Expected: 追加した4件が `FAIL`（`normalizeEntry`/`normalizeExit is not a function`）

- [ ] **Step 3: `parse.js` に `normalizeEntry` / `normalizeExit` を追加**

`parseCsv` 関数の下に追加し、`return` に含める:
```js
  function normalizeEntry(rows) {
    return rows.map(function (row) {
      var ts = parseDateTime(row[0], null);
      var lotNum = parseFloat(row[3]);
      return {
        timestamp: ts,
        pair: (row[1] || '').trim(),
        direction: (row[2] || '').trim(),
        lot: isNaN(lotNum) ? null : lotNum,
        rationale: row[4] || '',
        entryPrice: row[5] || '',
        tpPrice: row[6] || '',
        slPrice: row[7] || '',
        invalidateCondition: row[8] || ''
      };
    });
  }

  function normalizeExit(rows) {
    return rows.map(function (row) {
      var submissionTs = parseDateTime(row[0], null);
      var submissionDate = submissionTs.ok ? submissionTs.date : null;

      var entryDt = parseDateTime(row[4], submissionDate);
      var entryFallbackDate = entryDt.ok ? entryDt.date : submissionDate;
      var exitDt = parseDateTime(row[5], entryFallbackDate);

      if (entryDt.ok && exitDt.ok && exitDt.date.getTime() < entryDt.date.getTime()) {
        exitDt = { ok: true, date: new Date(exitDt.date.getTime() + 24 * 60 * 60 * 1000) };
      }

      var lotNum = parseFloat(row[3]);
      var ocoRaw = (row[7] || '').trim().toUpperCase();

      return {
        pair: (row[1] || '').trim(),
        direction: (row[2] || '').trim(),
        lot: isNaN(lotNum) ? null : lotNum,
        entryDateTime: entryDt,
        exitDateTime: exitDt,
        amount: parseAmount(row[6]),
        ocoFollowed: ocoRaw === 'YES' ? true : (ocoRaw === 'NO' ? false : null),
        ocoReason: row[8] || '',
        matchedScenario: row[9] || ''
      };
    });
  }
```

`return` 文を更新:
```js
  return {
    parseAmount: parseAmount,
    parseDateTime: parseDateTime,
    parseCsv: parseCsv,
    normalizeEntry: normalizeEntry,
    normalizeExit: normalizeExit
  };
```

列の並びはCSVヘッダーのテキストではなく、設計書2節に記載した固定の列順（インデックス）に依存している。この前提は `parse.js` 冒頭のコメントとしても明記しておく（Step 3の直前に以下のコメントを`parse.js`先頭、UMDラッパーの直後に追加）:

```js
  // normalizeEntry / normalizeExit は列の並び順（インデックス）に依存する。
  // ヘッダーの文言が変わっても、列の順序が変わらない限り壊れない。
  // 列順は docs/superpowers/specs/2026-09-11-fx-dashboard-design.md の「列定義」を参照。
```

- [ ] **Step 4: テストが通ることを確認**

Run: `node test/run.js`
Expected: 終了コード `0`。`24 passed, 0 failed`

- [ ] **Step 5: コミット**

```bash
git add parse.js test/parse.test.js
git commit -m "feat: normalizeEntry/normalizeExitを実装"
```

---

### Task 7: `match.linkTrades`

2シートの突合ロジック。全組み合わせを時間差昇順にソートしてから確定させる（決済記録の並び順に依存しない）ことを、あえて分岐しうるフィクスチャで検証する。

**Files:**
- Modify: `match.js`
- Create: `test/match.test.js`
- Modify: `test/run.js`

- [ ] **Step 1: 失敗するテストを書く**

`test/match.test.js` を新規作成:
```js
var FX = typeof module === 'object' ? require('../match.js') : window.FX;
var T = typeof module === 'object' ? require('./harness.js') : window.FXTest;

function entry(id, timestampDate, pair, direction, lot) {
  return { id: id, timestamp: { ok: true, date: timestampDate }, pair: pair, direction: direction, lot: lot };
}

function exit(id, entryDate, pair, direction, lot) {
  return { id: id, entryDateTime: { ok: true, date: entryDate }, pair: pair, direction: direction, lot: lot };
}

T.test('linkTrades: 完全一致で紐付く', function () {
  var e1 = entry('E1', new Date(2026, 8, 1, 10, 0, 0), 'ドル円', '買い', 5);
  var x1 = exit('X1', new Date(2026, 8, 1, 10, 0, 0), 'ドル円', '買い', 5);
  var result = FX.linkTrades([e1], [x1]);
  T.assertEqual(result.trades.length, 1);
  T.assertEqual(result.trades[0].entry.id, 'E1');
  T.assertEqual(result.unmatchedEntries.length, 0);
});

T.test('linkTrades: 数分ズレでも紐付く', function () {
  var e1 = entry('E1', new Date(2026, 8, 1, 10, 0, 0), 'ドル円', '買い', 5);
  var x1 = exit('X1', new Date(2026, 8, 1, 10, 5, 0), 'ドル円', '買い', 5);
  var result = FX.linkTrades([e1], [x1]);
  T.assertEqual(result.trades[0].entry.id, 'E1');
});

T.test('linkTrades: 7日ちょうどは紐付く', function () {
  var e1 = entry('E1', new Date(2026, 8, 1, 0, 0, 0), 'ドル円', '買い', 5);
  var x1 = exit('X1', new Date(2026, 8, 8, 0, 0, 0), 'ドル円', '買い', 5);
  var result = FX.linkTrades([e1], [x1]);
  T.assertEqual(result.trades[0].entry.id, 'E1');
});

T.test('linkTrades: 7日+1msは紐付かない', function () {
  var e1 = entry('E1', new Date(2026, 8, 1, 0, 0, 0), 'ドル円', '買い', 5);
  var x1 = exit('X1', new Date(2026, 8, 8, 0, 0, 0, 1), 'ドル円', '買い', 5);
  var result = FX.linkTrades([e1], [x1]);
  T.assertEqual(result.trades[0].entry, null);
  T.assertEqual(result.unmatchedEntries.length, 1);
});

T.test('linkTrades: ロットが違うと候補にならない', function () {
  var e1 = entry('E1', new Date(2026, 8, 1, 10, 0, 0), 'ドル円', '買い', 5);
  var x1 = exit('X1', new Date(2026, 8, 1, 10, 0, 0), 'ドル円', '買い', 3);
  var result = FX.linkTrades([e1], [x1]);
  T.assertEqual(result.trades[0].entry, null);
});

T.test('linkTrades: 時間差が最小のペアから優先して確定する(奪い合い)', function () {
  // E1=10:00, E2=09:59。X1=10:05(E1まで5分,E2まで6分)。X2=10:01(E1まで1分,E2まで2分)。
  // 全ペアの時間差を昇順に並べると (X2,E1,1分) が最小 → 先にX2-E1を確定。
  // 残りはE1が使用済みのため、X1は消去法でE2と紐付く(6分ズレ)。
  // exits配列内での並び順([X1,X2])に沿って処理する素朴な貪欲法だと
  // X1が先にE1(5分)を取ってしまい、この結果にはならない。
  var e1 = entry('E1', new Date(2026, 8, 1, 10, 0, 0), 'ドル円', '買い', 5);
  var e2 = entry('E2', new Date(2026, 8, 1, 9, 59, 0), 'ドル円', '買い', 5);
  var x1 = exit('X1', new Date(2026, 8, 1, 10, 5, 0), 'ドル円', '買い', 5);
  var x2 = exit('X2', new Date(2026, 8, 1, 10, 1, 0), 'ドル円', '買い', 5);

  var result = FX.linkTrades([e1, e2], [x1, x2]);
  var byId = {};
  result.trades.forEach(function (t) { byId[t.id] = t; });

  T.assertEqual(byId.X2.entry.id, 'E1');
  T.assertEqual(byId.X1.entry.id, 'E2');
});

T.test('linkTrades: 紐付かなかったエントリーはunmatchedEntriesに残る', function () {
  var e1 = entry('E1', new Date(2026, 8, 1, 10, 0, 0), 'ドル円', '買い', 5);
  var e2 = entry('E2', new Date(2026, 8, 1, 10, 0, 0), 'メキシコペソ円', '買い', 30);
  var x1 = exit('X1', new Date(2026, 8, 1, 10, 0, 0), 'ドル円', '買い', 5);
  var result = FX.linkTrades([e1, e2], [x1]);
  T.assertEqual(result.unmatchedEntries.length, 1);
  T.assertEqual(result.unmatchedEntries[0].id, 'E2');
});
```

`test/run.js` を更新（`require('./match.test.js')` を追加）:
```js
require('./parse.test.js');
require('./match.test.js');

var harness = require('./harness.js');
var summary = harness.run();

summary.results.forEach(function (r) {
  console.log((r.pass ? 'PASS' : 'FAIL') + ' - ' + r.name + (r.pass ? '' : ' :: ' + r.error));
});
console.log('\n' + summary.passCount + ' passed, ' + summary.failCount + ' failed');
process.exit(summary.failCount > 0 ? 1 : 0);
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `node test/run.js`
Expected: `match.test.js` の7件が `FAIL`（`linkTrades is not a function`）。`parse.test.js` の24件は `PASS`

- [ ] **Step 3: `match.js` に `linkTrades` を実装**

`match.js` の中身を以下に置き換える:
```js
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.FX = root.FX || {};
    Object.assign(root.FX, factory());
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  var MAX_DIFF_MS = 7 * 24 * 60 * 60 * 1000;

  function linkTrades(entries, exits) {
    var candidates = [];

    exits.forEach(function (exit, exitIdx) {
      if (!exit.entryDateTime || !exit.entryDateTime.ok) return;
      entries.forEach(function (entry, entryIdx) {
        if (!entry.timestamp || !entry.timestamp.ok) return;
        if (entry.pair !== exit.pair) return;
        if (entry.direction !== exit.direction) return;
        if (entry.lot === null || exit.lot === null || entry.lot !== exit.lot) return;
        var diff = Math.abs(exit.entryDateTime.date.getTime() - entry.timestamp.date.getTime());
        if (diff > MAX_DIFF_MS) return;
        candidates.push({ exitIdx: exitIdx, entryIdx: entryIdx, diff: diff });
      });
    });

    candidates.sort(function (a, b) { return a.diff - b.diff; });

    var usedExit = {};
    var usedEntry = {};
    var matchedEntryForExit = {};

    candidates.forEach(function (c) {
      if (usedExit[c.exitIdx] || usedEntry[c.entryIdx]) return;
      usedExit[c.exitIdx] = true;
      usedEntry[c.entryIdx] = true;
      matchedEntryForExit[c.exitIdx] = c.entryIdx;
    });

    var trades = exits.map(function (exit, exitIdx) {
      var entryIdx = matchedEntryForExit[exitIdx];
      var entry = entryIdx !== undefined ? entries[entryIdx] : null;
      var trade = {};
      Object.keys(exit).forEach(function (k) { trade[k] = exit[k]; });
      trade.entry = entry;
      return trade;
    });

    var unmatchedEntries = entries.filter(function (entry, idx) { return !usedEntry[idx]; });

    return { trades: trades, unmatchedEntries: unmatchedEntries };
  }

  return {
    linkTrades: linkTrades
  };
});
```

- [ ] **Step 4: テストが通ることを確認**

Run: `node test/run.js`
Expected: 終了コード `0`。`31 passed, 0 failed`

- [ ] **Step 5: コミット**

```bash
git add match.js test/match.test.js test/run.js
git commit -m "feat: linkTrades(2シートの突合)を実装"
```

---

### Task 8: `aggregate.periodRange`

期間フィルタの範囲計算。カレンダー上の実際の曜日に依存しない検証方法にする。

**Files:**
- Modify: `aggregate.js`
- Create: `test/aggregate.test.js`
- Modify: `test/run.js`

- [ ] **Step 1: 失敗するテストを書く**

`test/aggregate.test.js` を新規作成:
```js
var FX = typeof module === 'object' ? require('../aggregate.js') : window.FX;
var T = typeof module === 'object' ? require('./harness.js') : window.FXTest;

T.test('periodRange: allはnull', function () {
  T.assertEqual(FX.periodRange('all', new Date(2026, 8, 15, 10, 0, 0)), null);
});

T.test('periodRange: monthは当月1日0時からnowまで', function () {
  var now = new Date(2026, 8, 15, 10, 30, 0);
  var r = FX.periodRange('month', now);
  T.assertDateEqual(r.start, new Date(2026, 8, 1, 0, 0, 0));
  T.assertDateEqual(r.end, now);
});

T.test('periodRange: weekは直近月曜0時からnowまで', function () {
  var now = new Date(2026, 8, 15, 10, 30, 0);
  var r = FX.periodRange('week', now);
  T.assertEqual(r.start.getDay(), 1);
  T.assertEqual(r.start.getHours(), 0);
  T.assertEqual(r.start.getMinutes(), 0);
  T.assertTrue(r.start.getTime() <= now.getTime());
  T.assertTrue(now.getTime() - r.start.getTime() < 7 * 24 * 60 * 60 * 1000);
  T.assertDateEqual(r.end, now);
});

T.test('periodRange: 7dはnowの7日前ちょうどからnowまで', function () {
  var now = new Date(2026, 8, 15, 10, 30, 0);
  var r = FX.periodRange('7d', now);
  T.assertEqual(r.end.getTime() - r.start.getTime(), 7 * 24 * 60 * 60 * 1000);
  T.assertDateEqual(r.end, now);
});
```

`test/run.js` を更新:
```js
require('./parse.test.js');
require('./match.test.js');
require('./aggregate.test.js');

var harness = require('./harness.js');
var summary = harness.run();

summary.results.forEach(function (r) {
  console.log((r.pass ? 'PASS' : 'FAIL') + ' - ' + r.name + (r.pass ? '' : ' :: ' + r.error));
});
console.log('\n' + summary.passCount + ' passed, ' + summary.failCount + ' failed');
process.exit(summary.failCount > 0 ? 1 : 0);
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `node test/run.js`
Expected: `aggregate.test.js` の4件が `FAIL`（`periodRange is not a function`）

- [ ] **Step 3: `aggregate.js` に `periodRange` を実装**

`aggregate.js` の中身を以下に置き換える:
```js
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.FX = root.FX || {};
    Object.assign(root.FX, factory());
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  function periodRange(key, now) {
    if (key === 'all') return null;
    if (key === 'month') {
      return { start: new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0), end: now };
    }
    if (key === 'week') {
      var day = now.getDay();
      var diffToMonday = day === 0 ? 6 : day - 1;
      var start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMonday, 0, 0, 0);
      return { start: start, end: now };
    }
    if (key === '7d') {
      var start7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return { start: start7, end: now };
    }
    return null;
  }

  return {
    periodRange: periodRange
  };
});
```

- [ ] **Step 4: テストが通ることを確認**

Run: `node test/run.js`
Expected: 終了コード `0`。`35 passed, 0 failed`

- [ ] **Step 5: コミット**

```bash
git add aggregate.js test/aggregate.test.js test/run.js
git commit -m "feat: periodRange(期間フィルタの範囲計算)を実装"
```

---

### Task 9: `aggregate.filterValidTrades` / `filterByPeriod` / `summarize`

手計算で検証できる5件のフィクスチャで、全指標を一度に検証する。

**Files:**
- Modify: `aggregate.js`
- Modify: `test/aggregate.test.js`

- [ ] **Step 1: 失敗するテストを追記**

`test/aggregate.test.js` の末尾に追記:
```js
function trade(pair, direction, pnl, swap, exitDateOk, exitDate) {
  return {
    pair: pair,
    direction: direction,
    amount: { ok: true, pnl: pnl, swap: swap },
    exitDateTime: { ok: exitDateOk, date: exitDate }
  };
}

function buildFixture() {
  return [
    trade('ドル円', '買い', 1000, 0, true, new Date(2026, 8, 1, 10, 0, 0)),
    trade('ドル円', '買い', -500, 0, true, new Date(2026, 8, 1, 12, 0, 0)),
    trade('ドル円', '売り', 2000, 0, true, new Date(2026, 8, 2, 9, 0, 0)),
    { pair: 'メキシコペソ円', direction: '買い', amount: { ok: true, pnl: -1000, swap: 300 }, exitDateTime: { ok: true, date: new Date(2026, 8, 3, 8, 0, 0) } },
    { pair: 'ドル円', direction: '買い', amount: { ok: false, raw: '???' }, exitDateTime: { ok: true, date: new Date(2026, 8, 1, 9, 0, 0) } }
  ];
}

T.test('filterValidTrades: 金額または日時が失敗した記録を除外する', function () {
  var trades = buildFixture();
  var valid = FX.filterValidTrades(trades);
  T.assertEqual(valid.length, 4);
});

T.test('filterByPeriod: nullなら全件通す', function () {
  var trades = buildFixture();
  T.assertEqual(FX.filterByPeriod(trades, null).length, 5);
});

T.test('filterByPeriod: 範囲内のみ残す', function () {
  var trades = buildFixture();
  var period = { start: new Date(2026, 8, 2, 0, 0, 0), end: new Date(2026, 8, 3, 23, 59, 59) };
  var result = FX.filterByPeriod(trades, period);
  T.assertEqual(result.length, 2);
});

T.test('summarize: 5件フィクスチャで全指標を検証', function () {
  var s = FX.summarize(buildFixture(), null);

  T.assertEqual(s.excludedCount, 1);
  T.assertEqual(s.count, 4);
  T.assertEqual(s.pnlSum, 1500);
  T.assertEqual(s.swapSum, 300);
  T.assertEqual(s.total, 1800);
  T.assertEqual(s.winRate, 0.5);
  T.assertEqual(s.avgWin, 1500);
  T.assertEqual(s.avgLoss, 750);
  T.assertEqual(s.rr, 2);
  T.assertEqual(s.maxWin, 2000);
  T.assertEqual(s.maxLoss, -1000);

  T.assertEqual(s.dailyPnl, [
    { date: '2026-09-01', pnl: 500 },
    { date: '2026-09-02', pnl: 2000 },
    { date: '2026-09-03', pnl: -1000 }
  ]);

  var byPd = {};
  s.byPairDirection.forEach(function (d) { byPd[d.pair + '|' + d.direction] = d; });
  T.assertEqual(byPd['ドル円|買い'], { pair: 'ドル円', direction: '買い', pnlSum: 500, count: 2, winRate: 0.5 });
  T.assertEqual(byPd['ドル円|売り'], { pair: 'ドル円', direction: '売り', pnlSum: 2000, count: 1, winRate: 1 });
  T.assertEqual(byPd['メキシコペソ円|買い'], { pair: 'メキシコペソ円', direction: '買い', pnlSum: -1000, count: 1, winRate: 0 });
});

T.test('summarize: トレード0件ならwinRate/avgWin/avgLoss/rr/maxWin/maxLossはnull', function () {
  var s = FX.summarize([], null);
  T.assertEqual(s.count, 0);
  T.assertEqual(s.winRate, null);
  T.assertEqual(s.avgWin, null);
  T.assertEqual(s.avgLoss, null);
  T.assertEqual(s.rr, null);
  T.assertEqual(s.maxWin, null);
  T.assertEqual(s.maxLoss, null);
});

T.test('summarize: 負けトレードが0件ならrrはnull', function () {
  var trades = [trade('ドル円', '買い', 1000, 0, true, new Date(2026, 8, 1, 10, 0, 0))];
  var s = FX.summarize(trades, null);
  T.assertEqual(s.avgLoss, null);
  T.assertEqual(s.rr, null);
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `node test/run.js`
Expected: 追加した7件が `FAIL`

- [ ] **Step 3: `aggregate.js` に `filterValidTrades` / `filterByPeriod` / `summarize` を追加**

`periodRange` 関数の下に追加し、`return` に含める:
```js
  function filterValidTrades(trades) {
    return trades.filter(function (t) {
      return t.amount && t.amount.ok && t.exitDateTime && t.exitDateTime.ok;
    });
  }

  function filterByPeriod(trades, period) {
    if (!period) return trades;
    return trades.filter(function (t) {
      var time = t.exitDateTime.date.getTime();
      return time >= period.start.getTime() && time <= period.end.getTime();
    });
  }

  function formatDateKey(date) {
    var y = date.getFullYear();
    var m = String(date.getMonth() + 1);
    var d = String(date.getDate());
    if (m.length < 2) m = '0' + m;
    if (d.length < 2) d = '0' + d;
    return y + '-' + m + '-' + d;
  }

  function sum(arr) {
    return arr.reduce(function (a, b) { return a + b; }, 0);
  }

  function summarize(trades, period) {
    var valid = filterValidTrades(trades);
    var excludedCount = trades.length - valid.length;
    var inRange = filterByPeriod(valid, period);

    var pnlSum = 0;
    var swapSum = 0;
    var wins = [];
    var losses = [];
    var dailyMap = {};
    var pairDirMap = {};

    inRange.forEach(function (t) {
      var pnl = t.amount.pnl;
      var swap = t.amount.swap;
      pnlSum += pnl;
      swapSum += swap;
      if (pnl > 0) wins.push(pnl);
      if (pnl < 0) losses.push(pnl);

      var dateKey = formatDateKey(t.exitDateTime.date);
      dailyMap[dateKey] = (dailyMap[dateKey] || 0) + pnl;

      var pdKey = t.pair + '|' + t.direction;
      if (!pairDirMap[pdKey]) {
        pairDirMap[pdKey] = { pair: t.pair, direction: t.direction, pnlSum: 0, count: 0, wins: 0 };
      }
      pairDirMap[pdKey].pnlSum += pnl;
      pairDirMap[pdKey].count += 1;
      if (pnl > 0) pairDirMap[pdKey].wins += 1;
    });

    var count = inRange.length;
    var winRate = count > 0 ? wins.length / count : null;
    var avgWin = wins.length > 0 ? sum(wins) / wins.length : null;
    var avgLoss = losses.length > 0 ? Math.abs(sum(losses)) / losses.length : null;
    var rr = avgWin !== null && avgLoss !== null && avgLoss > 0 ? avgWin / avgLoss : null;
    var maxWin = wins.length > 0 ? Math.max.apply(null, wins) : null;
    var maxLoss = losses.length > 0 ? Math.min.apply(null, losses) : null;

    var dailyPnl = Object.keys(dailyMap).sort().map(function (k) {
      return { date: k, pnl: dailyMap[k] };
    });
    var byPairDirection = Object.keys(pairDirMap).map(function (k) {
      var e = pairDirMap[k];
      return {
        pair: e.pair,
        direction: e.direction,
        pnlSum: e.pnlSum,
        count: e.count,
        winRate: e.count > 0 ? e.wins / e.count : null
      };
    });

    return {
      pnlSum: pnlSum,
      swapSum: swapSum,
      total: pnlSum + swapSum,
      count: count,
      winRate: winRate,
      avgWin: avgWin,
      avgLoss: avgLoss,
      rr: rr,
      maxWin: maxWin,
      maxLoss: maxLoss,
      dailyPnl: dailyPnl,
      byPairDirection: byPairDirection,
      excludedCount: excludedCount
    };
  }
```

`return` 文を更新:
```js
  return {
    periodRange: periodRange,
    filterValidTrades: filterValidTrades,
    filterByPeriod: filterByPeriod,
    summarize: summarize
  };
```

- [ ] **Step 4: テストが通ることを確認**

Run: `node test/run.js`
Expected: 終了コード `0`。`42 passed, 0 failed`

- [ ] **Step 5: コミット**

```bash
git add aggregate.js test/aggregate.test.js
git commit -m "feat: summarize(集計)を実装"
```

---

### Task 10: `chart-data.js`（Chart.js設定オブジェクトの生成）

DOMやChart.jsのコンストラクタには触れず、Chart.jsに渡す設定オブジェクトの組み立てだけを担う。ここまでの純粋関数と同じ理由でテスト可能にする。

**Files:**
- Modify: `chart-data.js`
- Create: `test/chart-data.test.js`
- Modify: `test/run.js`

- [ ] **Step 1: 失敗するテストを書く**

`test/chart-data.test.js` を新規作成:
```js
var FX = typeof module === 'object' ? require('../chart-data.js') : window.FX;
var T = typeof module === 'object' ? require('./harness.js') : window.FXTest;

T.test('buildDailyChartConfig: labels/data/色を組み立てる', function () {
  var dailyPnl = [
    { date: '2026-09-01', pnl: 500 },
    { date: '2026-09-02', pnl: -200 }
  ];
  var config = FX.buildDailyChartConfig(dailyPnl);
  T.assertEqual(config.data.labels, ['2026-09-01', '2026-09-02']);
  T.assertEqual(config.data.datasets[0].data, [500, -200]);
  T.assertEqual(config.data.datasets[0].backgroundColor, ['#2f9e59', '#c0392b']);
  T.assertEqual(config.type, 'bar');
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
```

`test/run.js` を更新:
```js
require('./parse.test.js');
require('./match.test.js');
require('./aggregate.test.js');
require('./chart-data.test.js');

var harness = require('./harness.js');
var summary = harness.run();

summary.results.forEach(function (r) {
  console.log((r.pass ? 'PASS' : 'FAIL') + ' - ' + r.name + (r.pass ? '' : ' :: ' + r.error));
});
console.log('\n' + summary.passCount + ' passed, ' + summary.failCount + ' failed');
process.exit(summary.failCount > 0 ? 1 : 0);
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `node test/run.js`
Expected: 追加した2件が `FAIL`

- [ ] **Step 3: `chart-data.js` を実装**

`chart-data.js` の中身を以下に置き換える:
```js
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

  function buildDailyChartConfig(dailyPnl) {
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
    buildDailyChartConfig: buildDailyChartConfig,
    buildPairDirectionChartConfig: buildPairDirectionChartConfig
  };
});
```

- [ ] **Step 4: テストが通ることを確認**

Run: `node test/run.js`
Expected: 終了コード `0`。`44 passed, 0 failed`

- [ ] **Step 5: コミット**

```bash
git add chart-data.js test/chart-data.test.js test/run.js
git commit -m "feat: chart-data.js(Chart.js設定の組み立て)を実装"
```

---

### Task 11: ブラウザ向けテストランナー `test/index.html`

仕様書8節の要件（ブラウザで開くとアサーションが走る）を満たす。テストケース自体はTask 3〜10で作成済みのファイルをそのまま読み込む。

**Files:**
- Create: `test/index.html`

- [ ] **Step 1: `test/index.html` を作成**

```html
<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<title>FXダッシュボード テスト</title>
<style>
  body { font-family: sans-serif; padding: 16px; background: #fafafa; }
  #test-summary { font-weight: bold; margin-bottom: 12px; }
  ul { list-style: none; padding: 0; }
  li { padding: 4px 8px; font-family: monospace; font-size: 13px; }
  li.pass { color: #2f9e59; }
  li.fail { color: #c0392b; background: #fdecea; }
</style>
</head>
<body>
<h1>FXダッシュボード テスト</h1>
<div id="test-summary">実行中…</div>
<ul id="test-results"></ul>

<script src="../parse.js"></script>
<script src="../match.js"></script>
<script src="../aggregate.js"></script>
<script src="../chart-data.js"></script>
<script src="harness.js"></script>
<script src="parse.test.js"></script>
<script src="match.test.js"></script>
<script src="aggregate.test.js"></script>
<script src="chart-data.test.js"></script>
<script>
  var summary = window.FXTest.run();
  var out = document.getElementById('test-results');
  summary.results.forEach(function (r) {
    var li = document.createElement('li');
    li.className = r.pass ? 'pass' : 'fail';
    li.textContent = (r.pass ? '✓ ' : '✗ ') + r.name + (r.pass ? '' : ' — ' + r.error);
    out.appendChild(li);
  });
  document.getElementById('test-summary').textContent =
    summary.passCount + ' passed, ' + summary.failCount + ' failed';
</script>
</body>
</html>
```

- [ ] **Step 2: 簡易サーバーで200が返ることを確認（ブラウザの代わりに疎通だけ確認する）**

Run:
```bash
python -m http.server 8934 --directory . &
SERVER_PID=$!
sleep 1
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8934/test/index.html
curl -s http://localhost:8934/test/index.html | grep -c 'script src'
kill $SERVER_PID
```
Expected: 1行目 `200`、2行目 `9`（scriptタグが9個）

- [ ] **Step 3: コミット**

```bash
git add test/index.html
git commit -m "test: ブラウザ向けテストランナーを追加"
```

---

### Task 12: `config.js`

**Files:**
- Create: `config.js`

- [ ] **Step 1: `config.js` を作成**

```js
// Googleスプレッドシートの「ファイル → 共有 → ウェブに公開 → CSV」で
// 発行されたURLをそれぞれ貼り付けてください。
// 手順は docs/superpowers/specs/2026-09-11-fx-dashboard-design.md の10節を参照。
window.FX_CONFIG = {
  CSV_ENTRY: '',
  CSV_EXIT: ''
};
```

- [ ] **Step 2: コミット**

```bash
git add config.js
git commit -m "chore: config.jsの雛形を追加"
```

---

### Task 13: `index.html` と `style.css`

**Files:**
- Create: `index.html`
- Create: `style.css`

- [ ] **Step 1: `style.css` を作成**

```css
:root {
  --bg: #fafafa;
  --card-bg: #ffffff;
  --text: #1a1a1a;
  --text-muted: #6b6b6b;
  --border: #e2e2e2;
  --plus: #2f9e59;
  --minus: #c0392b;
  --accent: #2563eb;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: var(--bg);
  color: var(--text);
  padding-bottom: 40px;
}

.error-banner {
  background: #fdecea;
  color: var(--minus);
  padding: 16px;
  font-size: 14px;
  line-height: 1.6;
}

.empty-state {
  padding: 40px 16px;
  text-align: center;
  color: var(--text-muted);
}

.period-filter {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  position: sticky;
  top: 0;
  background: var(--bg);
  z-index: 10;
  overflow-x: auto;
}

.period-filter button {
  flex: 1 0 auto;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 20px;
  background: var(--card-bg);
  color: var(--text);
  font-size: 13px;
}

.period-filter button.active {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}

.summary-tiles {
  padding: 0 16px;
}

.summary-main-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 12px;
}

.summary-tile {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 12px;
  text-align: center;
}

.summary-tile-label {
  font-size: 12px;
  color: var(--text-muted);
}

.summary-tile-value {
  font-size: 18px;
  font-weight: bold;
  margin-top: 4px;
}

.summary-sub-row {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 6px;
  margin-bottom: 8px;
}

.summary-sub-stat {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 8px 10px;
  display: flex;
  justify-content: space-between;
  font-size: 13px;
}

.summary-sub-label { color: var(--text-muted); }

.excluded-warn {
  font-size: 12px;
  color: var(--minus);
  padding: 4px 0 12px;
}

.pnl-plus { color: var(--plus); }
.pnl-minus { color: var(--minus); }

.chart-section {
  padding: 16px;
}

.chart-section h2, .trade-list-section h2 {
  font-size: 15px;
  margin: 0 0 8px;
}

.chart-section canvas {
  max-height: 260px;
}

.pair-direction-list {
  list-style: none;
  padding: 0;
  margin: 12px 0 0;
}

.pair-direction-list li {
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
  border-bottom: 1px solid var(--border);
  font-size: 13px;
}

.trade-list-section {
  padding: 16px;
}

.trade-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.trade-card {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 12px;
}

.trade-card-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 4px;
  font-size: 13px;
}

.trade-card-date { color: var(--text-muted); }
.trade-card-pair { font-weight: 500; }
.trade-card-pnl { font-weight: bold; font-size: 15px; }

.trade-card-summary-line {
  margin-top: 6px;
  font-size: 12px;
  color: var(--text-muted);
}

.trade-card-details {
  margin-top: 10px;
  border-top: 1px solid var(--border);
  padding-top: 8px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
  padding: 3px 0;
}

.detail-label { color: var(--text-muted); flex-shrink: 0; }
.detail-value { text-align: right; }

.badge {
  display: inline-block;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
  margin-bottom: 6px;
}

.badge-warn {
  background: #fdecea;
  color: var(--minus);
}

.empty-note {
  color: var(--text-muted);
  font-size: 13px;
}

@media (min-width: 900px) {
  .charts-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }
}
```

- [ ] **Step 2: `index.html` を作成**

```html
<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>FXトレード・ダッシュボード</title>
<link rel="stylesheet" href="style.css">
</head>
<body>
<div id="error-banner" class="error-banner" hidden></div>
<div id="empty-state" class="empty-state" hidden>記録がありません。</div>

<div id="app-main" hidden>
  <header id="period-filter" class="period-filter">
    <button type="button" class="active" data-period="all">全期間</button>
    <button type="button" data-period="month">今月</button>
    <button type="button" data-period="week">今週</button>
    <button type="button" data-period="7d">直近7日</button>
  </header>

  <section id="summary-tiles" class="summary-tiles"></section>

  <div class="charts-row">
    <section class="chart-section">
      <h2>日別損益</h2>
      <canvas id="daily-chart"></canvas>
    </section>

    <section class="chart-section">
      <h2>通貨ペア × 方向</h2>
      <canvas id="pair-direction-chart"></canvas>
      <ul id="pair-direction-list" class="pair-direction-list"></ul>
    </section>
  </div>

  <section class="trade-list-section">
    <h2>トレード一覧</h2>
    <div id="trade-list" class="trade-list"></div>
  </section>
</div>

<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.4/chart.umd.min.js"></script>
<script src="config.js"></script>
<script src="parse.js"></script>
<script src="match.js"></script>
<script src="aggregate.js"></script>
<script src="chart-data.js"></script>
<script src="render.js"></script>
<script src="app.js"></script>
</body>
</html>
```

- [ ] **Step 3: 簡易サーバーで200が返ることを確認**

Run:
```bash
python -m http.server 8934 --directory . &
SERVER_PID=$!
sleep 1
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8934/index.html
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8934/style.css
kill $SERVER_PID
```
Expected: 両方とも `200`

- [ ] **Step 4: コミット**

```bash
git add index.html style.css
git commit -m "feat: 画面の骨格(index.html/style.css)を追加"
```

---

### Task 14: `render.js`

DOM操作とChart.js呼び出しを担う。純粋関数ではないため自動テストは行わず、コードレビューで正しさを確認する（Task 16でfixtureデータを使った疎通確認を行う）。

**Files:**
- Create: `render.js`

- [ ] **Step 1: `render.js` を作成**

```js
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

  function renderDailyChart(canvas, dailyPnl, prevChart) {
    if (prevChart) prevChart.destroy();
    var config = FX.buildDailyChartConfig(dailyPnl);
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
```

- [ ] **Step 2: コミット**

```bash
git add render.js
git commit -m "feat: render.js(画面描画)を実装"
```

---

### Task 15: `app.js`

起動・fetch・各モジュールの結線。統合部分なので自動テストは行わない（Task 16でfixtureを使って疎通確認する）。

**Files:**
- Create: `app.js`

- [ ] **Step 1: `app.js` を作成**

```js
(function () {
  'use strict';

  function main() {
    var els = {
      errorBanner: document.getElementById('error-banner'),
      emptyState: document.getElementById('empty-state'),
      main: document.getElementById('app-main'),
      periodFilter: document.getElementById('period-filter'),
      summary: document.getElementById('summary-tiles'),
      dailyCanvas: document.getElementById('daily-chart'),
      pairDirectionCanvas: document.getElementById('pair-direction-chart'),
      pairDirectionList: document.getElementById('pair-direction-list'),
      tradeList: document.getElementById('trade-list')
    };

    var state = {
      trades: [],
      periodKey: 'all',
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

      FX.renderSummary(els.summary, summary);
      state.dailyChart = FX.renderDailyChart(els.dailyCanvas, summary.dailyPnl, state.dailyChart);
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

    function fetchCsv(url) {
      return fetch(url).then(function (res) {
        if (!res.ok) throw new Error('HTTPエラー: ' + res.status);
        return res.text();
      });
    }

    els.periodFilter.addEventListener('click', onPeriodClick);

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
```

- [ ] **Step 2: コミット**

```bash
git add app.js
git commit -m "feat: app.js(起動・結線)を実装"
```

---

### Task 16: フィクスチャによる疎通確認とREADME

実データではなく合成データで、ローカルサーバー越しに一連の流れ（fetch→parse→match→aggregate→render）が壊れていないことを確認する。実データをリポジトリに含めない。

**Files:**
- Create: `test/fixtures/sample-entries.csv`
- Create: `test/fixtures/sample-exits.csv`
- Create: `dev.html`
- Create: `README.md`

- [ ] **Step 1: 合成フィクスチャCSVを作成**

`test/fixtures/sample-entries.csv`:
```
タイムスタンプ,通貨ペア,方向,ロット数,根拠,エントリー価格,利確価格,損切価格,シナリオが成立しない条件
2026/09/01 10:00:00,ドル円,買い,5,サンプルの根拠1,150.000,150.300,149.800,本日中
2026/09/01 12:00:00,ドル円,買い,3,サンプルの根拠2,150.100,150.400,149.900,本日中
2026/09/02 09:00:00,ドル円,売り,7,サンプルの根拠3,151.000,150.700,151.200,なし
2026/09/03 08:00:00,メキシコペソ円,買い,10,サンプルの根拠4,9.200,9.500,9.000,なし
```

`test/fixtures/sample-exits.csv`:
```
タイムスタンプ,通貨ペア,方向(エントリー時),ロット,エントリー日時,決済日時,結果金額(円),OCO通り決済か,NOの場合理由,①の根拠通りだったか
2026/09/01 11:00:00,ドル円,買い,5,9/1 10:00,9/1 10:58,1000,YES,,yes
2026/09/01 13:00:00,ドル円,買い,3,9/1 12:00,9/1 12:55,-500,YES,,NO
2026/09/02 10:00:00,ドル円,売り,7,9/2 9:00,9/2 9:50,2000,YES,,yes
2026/09/03 09:00:00,メキシコペソ円,買い,10,9/3 8:00,9/3 8:45,-1000(スワップ300),NO,早期撤退,NO
```

- [ ] **Step 2: `dev.html` を作成（fixtureを読み込む動作確認用ページ）**

```html
<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>FXダッシュボード (開発用/合成データ)</title>
<link rel="stylesheet" href="style.css">
</head>
<body>
<p style="padding:8px 16px;background:#fff3cd;font-size:12px;">
  これは合成データによる動作確認用ページです。test/fixtures/ の中身を読み込みます。
</p>
<div id="error-banner" class="error-banner" hidden></div>
<div id="empty-state" class="empty-state" hidden>記録がありません。</div>

<div id="app-main" hidden>
  <header id="period-filter" class="period-filter">
    <button type="button" class="active" data-period="all">全期間</button>
    <button type="button" data-period="month">今月</button>
    <button type="button" data-period="week">今週</button>
    <button type="button" data-period="7d">直近7日</button>
  </header>

  <section id="summary-tiles" class="summary-tiles"></section>

  <div class="charts-row">
    <section class="chart-section">
      <h2>日別損益</h2>
      <canvas id="daily-chart"></canvas>
    </section>

    <section class="chart-section">
      <h2>通貨ペア × 方向</h2>
      <canvas id="pair-direction-chart"></canvas>
      <ul id="pair-direction-list" class="pair-direction-list"></ul>
    </section>
  </div>

  <section class="trade-list-section">
    <h2>トレード一覧</h2>
    <div id="trade-list" class="trade-list"></div>
  </section>
</div>

<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.4/chart.umd.min.js"></script>
<script>
  window.FX_CONFIG = {
    CSV_ENTRY: 'test/fixtures/sample-entries.csv',
    CSV_EXIT: 'test/fixtures/sample-exits.csv'
  };
</script>
<script src="parse.js"></script>
<script src="match.js"></script>
<script src="aggregate.js"></script>
<script src="chart-data.js"></script>
<script src="render.js"></script>
<script src="app.js"></script>
</body>
</html>
```

- [ ] **Step 3: ローカルサーバーで疎通確認（fetchの成否とHTMLへのデータ反映をcurl+grepで検証）**

Run:
```bash
python -m http.server 8934 --directory . &
SERVER_PID=$!
sleep 1
curl -s -o /dev/null -w 'dev.html: %{http_code}\n' http://localhost:8934/dev.html
curl -s -o /dev/null -w 'sample-entries.csv: %{http_code}\n' http://localhost:8934/test/fixtures/sample-entries.csv
curl -s -o /dev/null -w 'sample-exits.csv: %{http_code}\n' http://localhost:8934/test/fixtures/sample-exits.csv
kill $SERVER_PID
```
Expected: 3行とも `200`

この時点で `dev.html` を実際にブラウザで開き、以下を目視確認する（この計画の実行者が手元のブラウザで行う）:
- サマリータイルにトレード損益 `¥+1,500`、スワップ `¥+300`、合計 `¥+1,800` が出る
- 日別損益棒グラフが3本（9/1, 9/2, 9/3）描画される
- 通貨ペア×方向に「ドル円 買い」「ドル円 売り」「メキシコペソ円 買い」の3行が出る
- トレード一覧が4件、新しい順（9/3が先頭）で表示され、タップで詳細が開閉する

- [ ] **Step 4: `README.md` を作成**

```markdown
# FXトレード・ダッシュボード

Googleフォームで記録している「FXエントリー前記録」と「FX決済後記録」を、
スマホのブラウザで開くだけで成績が一目で分かる画面にするツールです。

設計の詳細は `docs/superpowers/specs/2026-09-11-fx-dashboard-design.md` を参照してください。

## セットアップ

1. 各Googleスプレッドシートで `ファイル → 共有 → ウェブに公開` を開く
2. 公開対象を該当シート、形式を `カンマ区切り形式 (.csv)` にして公開
3. 発行されたURL2つを `config.js` の `CSV_ENTRY` / `CSV_EXIT` に貼る
4. GitHubにこのリポジトリをpushし、Settings → Pages を有効化する
5. 発行されたPages URLをスマホのホーム画面に追加する

## 開発

- `node test/run.js` — ロジック部分（parse/match/aggregate/chart-data）のテストを実行
- `test/index.html` をブラウザで開いても同じテストが実行される
- `dev.html` をローカルサーバー経由で開くと、`test/fixtures/` の合成データで画面を確認できる
  （`python -m http.server` などで配信してください。`file://` で直接開くと fetch がCORSでブロックされます）

## ディレクトリ構成

- `index.html` / `style.css` — 画面
- `config.js` — CSVの公開URL（利用者が設定）
- `parse.js` — CSVパース・金額/日時の正規化（純粋関数）
- `match.js` — 2シートの突合（純粋関数）
- `aggregate.js` — 集計（純粋関数）
- `chart-data.js` — Chart.js設定オブジェクトの組み立て（純粋関数）
- `render.js` — DOM描画
- `app.js` — 起動・fetch・結線
- `test/` — テストコードとブラウザ向けテストランナー
```

- [ ] **Step 5: コミット**

```bash
git add test/fixtures dev.html README.md
git commit -m "test: 合成データによる疎通確認とREADMEを追加"
```

---

## 完了後にユーザーが行うこと（実装のスコープ外）

設計書10節のとおり、以下はユーザー自身の操作です:

1. 2つのスプレッドシートを「ウェブに公開（CSV）」する
2. 発行されたURLを `config.js` に貼る
3. GitHubにリポジトリを作成してpushし、Settings → Pages を有効化する（Pagesは無料プランではリポジトリを公開にする必要がある。設計書の「プライバシー上の前提」で確認済み）
4. 発行されたPages URLをスマホのホーム画面に追加する

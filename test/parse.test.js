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

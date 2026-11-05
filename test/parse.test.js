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

T.test('parseAmount: マイナススワップを読み取る', function () {
  T.assertEqual(FX.parseAmount('25470+スワップ-2055'), { ok: true, pnl: 25470, swap: -2055 });
  T.assertEqual(FX.parseAmount('-6100(スワップ-4940)'), { ok: true, pnl: -6100, swap: -4940 });
});

T.test('parseAmount: 誤読のおそれがない表記ゆれは読み取る', function () {
  T.assertEqual(FX.parseAmount('25470＋スワップ545'), { ok: true, pnl: 25470, swap: 545 });
  T.assertEqual(FX.parseAmount('-6100（スワップ4940）'), { ok: true, pnl: -6100, swap: 4940 });
  T.assertEqual(FX.parseAmount('25470 + スワップ 545'), { ok: true, pnl: 25470, swap: 545 });
  T.assertEqual(FX.parseAmount('25470円'), { ok: true, pnl: 25470, swap: 0 });
  T.assertEqual(FX.parseAmount('\-6100'), { ok: true, pnl: -6100, swap: 0 });
});

[
  ['-とスワップが離れている', '25470-スワップ2055'],
  ['-の後に空白', '25470 - 2055'],
  ['全角マイナス', '25470+スワップ−2055'],
  ['長音記号', '25470+スワップー2055'],
  ['三角', '25470+スワップ▲2055'],
  ['「マイナス」の文字', '25470+スワップマイナス2055'],
  ['桁区切りカンマ', '25,470'],
  ['全角数字', '25470+スワップ２０５５'],
  ['スワップ以外の項目', '25470+手数料500'],
  ['スワップの金額がない', '25470+スワップ']
].forEach(function (c) {
  T.test('parseAmount: 紛らわしい記入は要確認にする(' + c[0] + ')', function () {
    T.assertEqual(FX.parseAmount(c[1]), { ok: false, raw: c[1] });
  });
});

T.test('parseDateTime: 年なしの日付は基準日の年を使う', function () {
  var ref = new Date(2027, 0, 5, 10, 0, 0);
  T.assertDateEqual(FX.parseDateTime('1/5 9:50', null, ref).date, new Date(2027, 0, 5, 9, 50, 0));
});

T.test('parseDateTime: 年またぎは前年とみなす', function () {
  var ref = new Date(2027, 0, 2, 10, 0, 0);
  T.assertDateEqual(FX.parseDateTime('12/31 23:00', null, ref).date, new Date(2026, 11, 31, 23, 0, 0));
});

T.test('parseDateTime: 数日先の日付は打ち間違いでも前年にしない', function () {
  var ref = new Date(2026, 8, 3, 10, 0, 0);
  T.assertDateEqual(FX.parseDateTime('9/30 10:00', null, ref).date, new Date(2026, 8, 30, 10, 0, 0));
});

var EXIT_HEADERS_NEW = ['タイムスタンプ', '通貨ペア', '方向(エントリー時)', 'ロット', 'エントリー日時', '決済日時', '結果金額(円)', 'OCO通り決済か', ' NOの場合理由', '①の根拠通りだったか', 'スワップ(円)'];

function exitRow(exitAt, amount, swap) {
  return ['2027/01/05 12:00:00', 'ドル円', '売り', '5', '1/5 10:00', exitAt, amount, 'NO', '恐怖決済', 'yes', swap];
}

T.test('normalizeExit: スワップ欄を読み取る(マイナス含む)', function () {
  var r = FX.normalizeExit([exitRow('1/5 11:00', '25470', '-2055')], EXIT_HEADERS_NEW)[0];
  T.assertEqual(r.amount, { ok: true, pnl: 25470, swap: -2055 });
  T.assertEqual(r.ocoReason, '恐怖決済');
});

T.test('normalizeExit: スワップ欄が空なら0円', function () {
  var r = FX.normalizeExit([exitRow('1/5 11:00', '25470', '')], EXIT_HEADERS_NEW)[0];
  T.assertEqual(r.amount, { ok: true, pnl: 25470, swap: 0 });
});

T.test('normalizeExit: 新しい列がない過去の形式は金額欄のスワップを読む', function () {
  var headers = EXIT_HEADERS_NEW.slice(0, 10);
  var r = FX.normalizeExit([exitRow('1/5 11:00', '25470+スワップ-2055').slice(0, 10)], headers)[0];
  T.assertEqual(r.amount, { ok: true, pnl: 25470, swap: -2055 });
});

T.test('normalizeExit: 新しい列が空の過去の行は金額欄のスワップを読む', function () {
  var r = FX.normalizeExit([exitRow('1/5 11:00', '25470+スワップ545', '')], EXIT_HEADERS_NEW)[0];
  T.assertEqual(r.amount, { ok: true, pnl: 25470, swap: 545 });
});

T.test('normalizeExit: 金額欄とスワップ欄の両方にスワップがあれば要確認', function () {
  var r = FX.normalizeExit([exitRow('1/5 11:00', '25470+スワップ545', '545')], EXIT_HEADERS_NEW)[0];
  T.assertEqual(r.amount.ok, false);
  T.assertEqual(r.amount.raw, '25470+スワップ545 / スワップ欄: 545');
});

T.test('normalizeExit: スワップ欄が数字でなければ要確認', function () {
  var r = FX.normalizeExit([exitRow('1/5 11:00', '25470', 'なし')], EXIT_HEADERS_NEW)[0];
  T.assertEqual(r.amount.ok, false);
});

T.test('normalizeExit: 決済日時が空なら送信時刻を使う', function () {
  var r = FX.normalizeExit([exitRow('', '100', '')], EXIT_HEADERS_NEW)[0];
  T.assertTrue(r.exitDateTime.ok);
  T.assertDateEqual(r.exitDateTime.date, new Date(2027, 0, 5, 12, 0, 0));
});

T.test('normalizeExit: 時刻だけの決済日時は送信日を使う', function () {
  var row = exitRow('11:30', '100', '');
  row[4] = '1/3 10:00';
  var r = FX.normalizeExit([row], EXIT_HEADERS_NEW)[0];
  T.assertDateEqual(r.exitDateTime.date, new Date(2027, 0, 5, 11, 30, 0));
});

T.test('normalizeExit: 時刻だけで送信時刻より後なら前日とみなす', function () {
  var row = exitRow('23:50', '100', '');
  row[4] = '1/3 10:00';
  var r = FX.normalizeExit([row], EXIT_HEADERS_NEW)[0];
  T.assertDateEqual(r.exitDateTime.date, new Date(2027, 0, 4, 23, 50, 0));
});

T.test('normalizeExit: 年なしの日時は送信時刻の年で読む', function () {
  var r = FX.normalizeExit([exitRow('1/5 11:00', '100', '')], EXIT_HEADERS_NEW)[0];
  T.assertDateEqual(r.entryDateTime.date, new Date(2027, 0, 5, 10, 0, 0));
  T.assertDateEqual(r.exitDateTime.date, new Date(2027, 0, 5, 11, 0, 0));
});

var ENTRY_HEADERS_NEW = ['タイムスタンプ', '通貨ペア', '方向', 'ロット数', '根拠', 'エントリー価格', '利確価格(+30pips以上目安)', '損切価格(-20pips以下目安)', 'シナリオが成立しない条件（有効期限含む）', '注文方法', '利確pips', '損切pips', 'いつまで持つ？', 'OCO以外で動くならどんなとき？'];

T.test('normalizeEntry: 新しい列を見出し名で読み取る', function () {
  var row = ['2027/01/05 10:00:00', 'ドル円', '買い', '5', '根拠', '158.2', '', '', '', 'IFO', '50', '20', '当日中', '指標で撤退'];
  var r = FX.normalizeEntry([row], ENTRY_HEADERS_NEW)[0];
  T.assertEqual(r.orderType, 'IFO');
  T.assertEqual(r.tpPips, '50');
  T.assertEqual(r.slPips, '20');
  T.assertEqual(r.holdUntil, '当日中');
  T.assertEqual(r.exitPlan, '指標で撤退');
});

T.test('normalizeEntry: 新しい列がない過去の形式は空文字になる', function () {
  var row = ['2026/06/19 23:19:28', 'ドル円', '売り', '2', '根拠', '161.38', '160.5', '161.7', '本日中'];
  var r = FX.normalizeEntry([row], ENTRY_HEADERS_NEW.slice(0, 9))[0];
  T.assertEqual(r.tpPrice, '160.5');
  T.assertEqual(r.invalidateCondition, '本日中');
  T.assertEqual(r.tpPips, '');
  T.assertEqual(r.holdUntil, '');
});

T.test('plannedPrice: 買いの利確は上、損切は下', function () {
  T.assertEqual(FX.plannedPrice('158.2', '買い', '50', 'tp'), 158.7);
  T.assertEqual(FX.plannedPrice('158.2', '買い', '20', 'sl'), 158);
});

T.test('plannedPrice: 売りの利確は下、損切は上', function () {
  T.assertEqual(FX.plannedPrice('158.2', '売り', '50', 'tp'), 157.7);
  T.assertEqual(FX.plannedPrice('158.2', '売り', '20', 'sl'), 158.4);
});

T.test('plannedPrice: 価格やpipsが数字でなければnull', function () {
  T.assertEqual(FX.plannedPrice('161.38(IFO)', '買い', '50', 'tp'), null);
  T.assertEqual(FX.plannedPrice('158.2', '買い', '目安', 'tp'), null);
  T.assertEqual(FX.plannedPrice('158.2', '不明', '50', 'tp'), null);
});

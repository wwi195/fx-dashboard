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

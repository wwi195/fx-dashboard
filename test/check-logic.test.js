var FX = typeof module === 'object' ? require('../check-logic.js') : window.FX;
var T = typeof module === 'object' ? require('./harness.js') : window.FXTest;

function allGreen(situation) {
  var answers = {};
  FX.checkQuestionsFor(situation).forEach(function (q) {
    answers[q.id] = q.multi ? [q.options[0].label] : q.options[0].label;
  });
  return answers;
}

T.test('checkQuestionsFor: 迷っている・負けた後は5問、勝った後は8問', function () {
  T.assertEqual(FX.checkQuestionsFor('迷っている').length, 5);
  T.assertEqual(FX.checkQuestionsFor('負けた後（インターバル明け）').length, 5);
  T.assertEqual(FX.checkQuestionsFor('勝った後（インターバル明け）').length, 8);
});

T.test('checkVerdict: 全部🟢なら入ってOK', function () {
  var v = FX.checkVerdict('迷っている', allGreen('迷っている'));
  T.assertEqual(v.key, 'go');
  T.assertEqual(v.label, '入ってOK');
});

T.test('checkVerdict: 🟡が1つだけなら入ってOK', function () {
  var a = allGreen('迷っている');
  a.revenge = '少し気になる';
  T.assertEqual(FX.checkVerdict('迷っている', a).key, 'go');
});

T.test('checkVerdict: 🟡が2つで今日は見るだけ', function () {
  var a = allGreen('迷っている');
  a.revenge = '少し気になる';
  a.mood = '浮ついてる';
  var v = FX.checkVerdict('迷っている', a);
  T.assertEqual(v.key, 'watch');
  T.assertEqual(v.label, '今日は見るだけ');
});

T.test('checkVerdict: 🔴が1つでもあれば今日はやめとこ', function () {
  var a = allGreen('迷っている');
  a.reason = 'チャートの外';
  var v = FX.checkVerdict('迷っている', a);
  T.assertEqual(v.key, 'stop');
  T.assertEqual(v.label, '今日はやめとこ');
});

T.test('checkVerdict: 体調は寝不足かお酒で🔴、疲れだけなら🟡', function () {
  var a = allGreen('迷っている');
  a.body = ['疲れている'];
  T.assertEqual(FX.checkLevel(FX.checkQuestionsFor('迷っている')[3], a.body), 'yellow');
  a.body = ['疲れている', 'お酒が入っている'];
  T.assertEqual(FX.checkVerdict('迷っている', a).key, 'stop');
  a.body = ['寝不足'];
  T.assertEqual(FX.checkVerdict('迷っている', a).key, 'stop');
});

T.test('checkVerdict: 勝った後の追加質問も判定に入る', function () {
  var a = allGreen('勝った後（インターバル明け）');
  a.winBasis = '「今ならいける」だけ';
  T.assertEqual(FX.checkVerdict('勝った後（インターバル明け）', a).key, 'stop');
});

T.test('checkVerdict: 判定の理由として🔴🟡の質問を返す', function () {
  var a = allGreen('迷っている');
  a.revenge = '少し気になる';
  a.mood = '焦ってる';
  var v = FX.checkVerdict('迷っている', a);
  T.assertEqual(v.flags.map(function (f) { return f.level + ':' + f.id; }), ['yellow:revenge', 'red:mood']);
});

T.test('checkFormFields: 質問ごとに 🟢/🟡/🔴 付きで、勝った後の質問は空欄で送る', function () {
  var a = allGreen('迷っている');
  a.body = ['疲れている'];
  var fields = FX.checkFormFields({
    situation: '迷っている',
    answers: a,
    feeling: 'ちょっとそわそわ',
    verdict: FX.checkVerdict('迷っている', a),
    action: 'わかった、やめとく',
    entryReason: ''
  });
  T.assertEqual(fields['状況'], '迷っている');
  T.assertEqual(fields['体調'], '🟡 疲れている');
  T.assertEqual(fields['取り返したい負け'], '🟢 ない');
  T.assertEqual(fields['勝ちで気が大きく'], '');
  T.assertEqual(fields['気持ちを一言で'], 'ちょっとそわそわ');
  T.assertEqual(fields['判定'], '入ってOK');
  T.assertEqual(fields['選んだ行動'], 'わかった、やめとく');
  T.assertEqual(fields['入る理由'], '');
});

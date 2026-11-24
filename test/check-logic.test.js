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

T.test('checkVerdict: 🟡1つ（1点）で1時間様子見', function () {
  var a = allGreen('迷っている');
  a.revenge = '少し気になる';
  var v = FX.checkVerdict('迷っている', a);
  T.assertEqual(v.key, 'wait1');
  T.assertEqual(v.points, 1);
  T.assertEqual(v.hours, 1);
  T.assertEqual(v.label, '1時間様子見');
  T.assertEqual(v.style, 'watch');
});

T.test('checkVerdict: 2点で2時間・3点で4時間・4点で8時間・5点以上で今日はやめ', function () {
  var a = allGreen('迷っている');
  a.revenge = 'ある'; // 2点
  T.assertEqual(FX.checkVerdict('迷っている', a).key, 'wait2');
  T.assertEqual(FX.checkVerdict('迷っている', a).label, '2時間休む');
  a.mood = '浮ついてる'; // 3点
  T.assertEqual(FX.checkVerdict('迷っている', a).key, 'wait4');
  a.mood = '焦ってる'; // 4点
  T.assertEqual(FX.checkVerdict('迷っている', a).key, 'wait8');
  T.assertEqual(FX.checkVerdict('迷っている', a).hours, 8);
  a.fomo = '少しなる'; // 5点
  var v = FX.checkVerdict('迷っている', a);
  T.assertEqual(v.key, 'stop');
  T.assertEqual(v.label, '今日はもうやめておこう');
  T.assertEqual(v.hours, null);
});

T.test('checkVerdict: 体調は寝不足かお酒なら点数に関係なく今日はやめ、疲れだけなら1点', function () {
  var a = allGreen('迷っている');
  a.body = ['疲れている'];
  T.assertEqual(FX.checkLevel(FX.checkQuestionsFor('迷っている')[3], a.body), 'yellow');
  T.assertEqual(FX.checkVerdict('迷っている', a).key, 'wait1');
  a.body = ['疲れている', 'お酒が入っている'];
  T.assertEqual(FX.checkVerdict('迷っている', a).key, 'stop');
  T.assertEqual(FX.checkVerdict('迷っている', a).points, 2);
  a.body = ['寝不足'];
  T.assertEqual(FX.checkVerdict('迷っている', a).key, 'stop');
});

T.test('checkVerdict: 勝った後の追加質問も点数に入る', function () {
  var a = allGreen('勝った後（インターバル明け）');
  a.winBasis = '「今ならいける」だけ';
  T.assertEqual(FX.checkVerdict('勝った後（インターバル明け）', a).key, 'wait2');
  a.winBig = '少しなってる';
  T.assertEqual(FX.checkVerdict('勝った後（インターバル明け）', a).key, 'wait4');
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
  T.assertEqual(fields['判定'], '1時間様子見');
  T.assertEqual(fields['点数'], '1');
  T.assertEqual(fields['選んだ行動'], 'わかった、やめとく');
  T.assertEqual(fields['入る理由'], '');
});

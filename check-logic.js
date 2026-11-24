// 心のチェック：質問の定義と判定（画面やネットワークに依存しない純粋な部分）
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.FX = root.FX || {};
    Object.assign(root.FX, factory());
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  var SITUATIONS = ['迷っている', '勝った後（インターバル明け）', '負けた後（インターバル明け）'];
  var WIN_SITUATION = '勝った後（インターバル明け）';

  function opt(level, label) {
    return { level: level, label: label };
  }

  // field はGoogleフォーム「FX心のチェック」の質問名（一字一句そのまま）
  var COMMON_QUESTIONS = [
    {
      id: 'revenge', field: '取り返したい負け',
      text: '取り返したい負けはある？',
      options: [opt('green', 'ない'), opt('yellow', '少し気になる'), opt('red', 'ある')]
    },
    {
      id: 'reason', field: '入りたい理由',
      text: '入りたい理由は、チャートの中？外？',
      hint: 'ツールを試したい・暇・SNSで見た・取り返したい…は「外」',
      options: [opt('green', 'チャートの中'), opt('yellow', '半々'), opt('red', 'チャートの外')]
    },
    {
      id: 'fomo', field: '入らなかったら損',
      text: '入らなかったら、損した気分になる？',
      options: [opt('green', 'ならない'), opt('yellow', '少しなる'), opt('red', '強くなる')]
    },
    {
      id: 'body', field: '体調', multi: true,
      text: '体調は？',
      hint: '当てはまるものを全部選ぶ',
      options: [
        opt('green', '良い・普通'),
        opt('yellow', '疲れている'),
        opt('red', '寝不足'),
        opt('red', 'お酒が入っている')
      ]
    },
    {
      id: 'mood', field: '今の気持ち',
      text: '今の気持ちは？',
      options: [opt('green', '平常'), opt('yellow', '浮ついてる'), opt('red', '焦ってる')]
    }
  ];

  var WIN_QUESTIONS = [
    {
      id: 'winBig', field: '勝ちで気が大きく',
      text: 'さっきの勝ちで、気が大きくなってない？',
      options: [opt('green', 'なってない'), opt('yellow', '少しなってる'), opt('red', 'なってる')]
    },
    {
      id: 'winGiveBack', field: '利益を減らしてもいい',
      text: 'この利益、少し減らしてもいいと思ってない？',
      options: [opt('green', '思ってない'), opt('yellow', '少し思ってる'), opt('red', '思ってる')]
    },
    {
      id: 'winBasis', field: '根拠の強さ',
      text: '前のトレードと同じくらい根拠ある？',
      options: [opt('green', '同じくらいある'), opt('yellow', '少し弱い'), opt('red', '「今ならいける」だけ')]
    }
  ];

  var LEVEL_MARK = { green: '🟢', yellow: '🟡', red: '🔴' };
  var LEVEL_RANK = { green: 0, yellow: 1, red: 2 };

  // 点数：🟢0点・🟡1点・🔴2点（複数選択の質問は一番悪い色の点）。
  // 合計で判定：0点 入ってOK／1点 1時間様子見／2点 2時間／3点 4時間／4点 8時間／5点以上 今日はもうやめておこう。
  // 体調の「寝不足」「お酒が入っている」は時間では戻らないので、点数に関係なく今日はもうやめておこう。
  var LEVEL_POINTS = { green: 0, yellow: 1, red: 2 };
  var TODAY_STOP_BODY = ['寝不足', 'お酒が入っている'];

  // style は画面の色（go=緑・watch=黄・stop=赤）。hours は休む時間（今日はやめは null）
  var VERDICTS = {
    go: { key: 'go', style: 'go', hours: 0, label: '入ってOK', message: '今の状態なら、根拠どおりに入ってOK。OCOはいつも通りに。' },
    wait1: { key: 'wait1', style: 'watch', hours: 1, label: '1時間様子見', message: '少し気になるところがあります。1時間はチャートを見るだけ。入らない。1時間たったら、もう一度チェックしよう。' },
    wait2: { key: 'wait2', style: 'stop', hours: 2, label: '2時間休む', message: 'チャートを閉じて、2時間忘れよう。休んだら、もう一度チェック。' },
    wait4: { key: 'wait4', style: 'stop', hours: 4, label: '4時間休む', message: 'チャートを閉じて、4時間忘れよう。休んだら、もう一度チェック。' },
    wait8: { key: 'wait8', style: 'stop', hours: 8, label: '8時間休む', message: 'チャートを閉じて、8時間忘れよう。ひと眠りしてから、もう一度チェック。' },
    stop: { key: 'stop', style: 'stop', hours: null, label: '今日はもうやめておこう', message: '今日はトレードしない日。チャートも閉じよう。' }
  };
  var BODY_STOP_MESSAGE = '寝不足・お酒は、時間をおいても戻りません。今日はトレードしない日。チャートも閉じよう。';

  function verdictKeyForPoints(points) {
    if (points <= 0) return 'go';
    if (points === 1) return 'wait1';
    if (points === 2) return 'wait2';
    if (points === 3) return 'wait4';
    if (points === 4) return 'wait8';
    return 'stop';
  }

  function checkQuestionsFor(situation) {
    return situation === WIN_SITUATION ? COMMON_QUESTIONS.concat(WIN_QUESTIONS) : COMMON_QUESTIONS.slice();
  }

  // 回答（単一は文字列、複数選択は配列）の色。複数選択は一番悪い色。
  function checkLevel(question, answer) {
    var labels = Array.isArray(answer) ? answer : [answer];
    var level = null;
    question.options.forEach(function (o) {
      if (labels.indexOf(o.label) === -1) return;
      if (level === null || LEVEL_RANK[o.level] > LEVEL_RANK[level]) level = o.level;
    });
    return level;
  }

  function checkVerdict(situation, answers) {
    var flags = [];
    var points = 0;
    var bodyStop = false;
    checkQuestionsFor(situation).forEach(function (q) {
      var answer = answers[q.id];
      var level = checkLevel(q, answer);
      if (level) points += LEVEL_POINTS[level];
      if (level === 'red' || level === 'yellow') flags.push({ id: q.id, text: q.text, level: level, points: LEVEL_POINTS[level] });
      if (q.id === 'body') {
        var labels = Array.isArray(answer) ? answer : [answer];
        if (TODAY_STOP_BODY.some(function (b) { return labels.indexOf(b) !== -1; })) bodyStop = true;
      }
    });
    var key = bodyStop ? 'stop' : verdictKeyForPoints(points);
    var v = VERDICTS[key];
    return {
      key: key,
      style: v.style,
      hours: v.hours,
      points: points,
      label: v.label,
      message: bodyStop ? BODY_STOP_MESSAGE : v.message,
      flags: flags
    };
  }

  function formatAnswer(question, answer) {
    if (answer == null || (Array.isArray(answer) && answer.length === 0)) return '';
    var level = checkLevel(question, answer);
    var text = Array.isArray(answer) ? answer.join('・') : answer;
    return (level ? LEVEL_MARK[level] + ' ' : '') + text;
  }

  // Googleフォームへ送る {質問名: 値}。その状況で聞かない質問は空欄。
  function checkFormFields(record) {
    var asked = checkQuestionsFor(record.situation);
    var fields = { '状況': record.situation };
    COMMON_QUESTIONS.concat(WIN_QUESTIONS).forEach(function (q) {
      fields[q.field] = asked.indexOf(q) === -1 ? '' : formatAnswer(q, record.answers[q.id]);
    });
    fields['気持ちを一言で'] = record.feeling || '';
    fields['判定'] = record.verdict.label;
    fields['選んだ行動'] = record.action || '';
    fields['入る理由'] = record.entryReason || '';
    return fields;
  }

  return {
    CHECK_SITUATIONS: SITUATIONS,
    CHECK_LEVEL_MARK: LEVEL_MARK,
    checkQuestionsFor: checkQuestionsFor,
    checkLevel: checkLevel,
    checkVerdict: checkVerdict,
    checkFormFields: checkFormFields
  };
});

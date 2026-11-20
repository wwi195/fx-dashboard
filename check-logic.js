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

  var VERDICTS = {
    go: { key: 'go', label: '入ってOK', message: '今の状態なら、根拠どおりに入ってOK。OCOはいつも通りに。' },
    watch: { key: 'watch', label: '今日は見るだけ', message: '気になるところが2つ以上。今日はチャートを見るだけにしよう。' },
    stop: { key: 'stop', label: '今日はやめとこ', message: '🔴があります。今日はトレードしない日。チャートも閉じよう。' }
  };

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
    var reds = 0;
    var yellows = 0;
    checkQuestionsFor(situation).forEach(function (q) {
      var level = checkLevel(q, answers[q.id]);
      if (level === 'red') reds += 1;
      if (level === 'yellow') yellows += 1;
      if (level === 'red' || level === 'yellow') flags.push({ id: q.id, text: q.text, level: level });
    });
    var key = reds > 0 ? 'stop' : yellows >= 2 ? 'watch' : 'go';
    return {
      key: key,
      label: VERDICTS[key].label,
      message: VERDICTS[key].message,
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

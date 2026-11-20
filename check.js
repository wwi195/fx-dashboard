// 心のチェック：画面（1問ずつ表示 → 判定 → Googleフォームへ記録）
(function () {
  'use strict';

  var app = document.getElementById('check-app');
  var config = window.FX_CONFIG || {};

  var state;

  function reset() {
    state = {
      step: 'situation', // situation → question → feeling → verdict → reason → sending → done / error
      situation: null,
      questions: [],
      index: 0,
      answers: {},
      feeling: '',
      verdict: null,
      action: '',
      entryReason: ''
    };
  }

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'text') node.textContent = attrs[k];
      else if (k === 'onClick') node.addEventListener('click', attrs[k]);
      else node.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { if (c) node.appendChild(c); });
    return node;
  }

  function choiceButton(label, onClick, extraClass) {
    return el('button', { type: 'button', 'class': 'check-choice ' + (extraClass || ''), text: label, onClick: onClick });
  }

  function progressText() {
    var total = state.questions.length + 1; // +1 = 気持ちを一言で
    var current = state.step === 'feeling' ? total : state.index + 1;
    return current + ' / ' + total;
  }

  function backButton(onClick) {
    return el('button', { type: 'button', 'class': 'check-nav-back', text: '← 戻る', onClick: onClick });
  }

  function renderSituation() {
    return [
      el('h1', { 'class': 'check-question', text: '今の状況は？' }),
      el('p', { 'class': 'check-hint', text: 'インターバル中なら、まだやらない。終わってから。' }),
      el('div', { 'class': 'check-choices' }, FX.CHECK_SITUATIONS.map(function (s) {
        return choiceButton(s, function () {
          state.situation = s;
          state.questions = FX.checkQuestionsFor(s);
          state.index = 0;
          state.answers = {};
          state.step = 'question';
          render();
        });
      }))
    ];
  }

  function goNextQuestion() {
    if (state.index < state.questions.length - 1) {
      state.index += 1;
    } else {
      state.step = 'feeling';
    }
    render();
  }

  function goPrevQuestion() {
    if (state.index > 0) {
      state.index -= 1;
    } else {
      state.step = 'situation';
    }
    render();
  }

  function renderSingle(q) {
    return el('div', { 'class': 'check-choices' }, q.options.map(function (o) {
      var selected = state.answers[q.id] === o.label;
      return choiceButton(FX.CHECK_LEVEL_MARK[o.level] + ' ' + o.label, function () {
        state.answers[q.id] = o.label;
        goNextQuestion();
      }, selected ? 'selected' : '');
    }));
  }

  // 複数選択：「良い・普通」は他と同時に選べない
  function renderMulti(q) {
    var current = state.answers[q.id] || [];
    var normal = q.options[0].label;
    var list = el('div', { 'class': 'check-choices' }, q.options.map(function (o) {
      var on = current.indexOf(o.label) !== -1;
      return choiceButton((on ? '☑ ' : '☐ ') + FX.CHECK_LEVEL_MARK[o.level] + ' ' + o.label, function () {
        var next;
        if (o.label === normal) {
          next = on ? [] : [normal];
        } else {
          next = current.filter(function (l) { return l !== normal; });
          next = on ? next.filter(function (l) { return l !== o.label; }) : next.concat([o.label]);
        }
        state.answers[q.id] = next;
        render();
      }, on ? 'selected' : '');
    }));
    var nextBtn = el('button', { type: 'button', 'class': 'check-primary', text: '次へ', onClick: goNextQuestion });
    if (current.length === 0) nextBtn.disabled = true;
    return el('div', {}, [list, nextBtn]);
  }

  function renderQuestion() {
    var q = state.questions[state.index];
    return [
      el('p', { 'class': 'check-progress', text: progressText() }),
      el('h1', { 'class': 'check-question', text: q.text }),
      q.hint ? el('p', { 'class': 'check-hint', text: q.hint }) : null,
      q.multi ? renderMulti(q) : renderSingle(q),
      backButton(goPrevQuestion)
    ];
  }

  function renderFeeling() {
    var input = el('textarea', { 'class': 'check-text', rows: '3', placeholder: '例：ちょっとそわそわしてる' });
    input.value = state.feeling;
    var nextBtn = el('button', { type: 'button', 'class': 'check-primary', text: '判定を見る', onClick: function () {
      state.feeling = input.value.trim();
      state.verdict = FX.checkVerdict(state.situation, state.answers);
      state.step = 'verdict';
      render();
    } });
    function sync() { nextBtn.disabled = input.value.trim() === ''; }
    input.addEventListener('input', sync);
    sync();
    setTimeout(function () { input.focus(); }, 0);
    return [
      el('p', { 'class': 'check-progress', text: progressText() }),
      el('h1', { 'class': 'check-question', text: '今の気持ちを、一言で' }),
      input,
      nextBtn,
      backButton(function () {
        state.feeling = input.value;
        state.index = state.questions.length - 1;
        state.step = 'question';
        render();
      })
    ];
  }

  function renderVerdict() {
    var v = state.verdict;
    var flagList = v.flags.length === 0 ? null : el('ul', { 'class': 'check-flags' }, v.flags.map(function (f) {
      return el('li', { text: FX.CHECK_LEVEL_MARK[f.level] + ' ' + f.text });
    }));
    var actions = v.key === 'go'
      ? [
          choiceButton('エントリーする', function () { submit('エントリーする'); }),
          choiceButton('やっぱりやめとく', function () { submit('やっぱりやめとく'); })
        ]
      : [
          choiceButton('わかった、やめとく', function () { submit('わかった、やめとく'); }),
          choiceButton('それでも入る（理由を書く）', function () { state.step = 'reason'; render(); }, 'check-override')
        ];
    return [
      el('div', { 'class': 'check-verdict check-verdict-' + v.key }, [
        el('p', { 'class': 'check-verdict-label', text: v.label }),
        el('p', { 'class': 'check-verdict-message', text: v.message })
      ]),
      flagList ? el('p', { 'class': 'check-hint', text: '引っかかったところ' }) : null,
      flagList,
      el('div', { 'class': 'check-choices' }, actions)
    ];
  }

  function renderReason() {
    var input = el('textarea', { 'class': 'check-text', rows: '4', placeholder: 'なぜ判定を無視して入るのか' });
    var sendBtn = el('button', { type: 'button', 'class': 'check-primary', text: '記録して入る', onClick: function () {
      state.entryReason = input.value.trim();
      submit('それでも入る');
    } });
    function sync() { sendBtn.disabled = input.value.trim() === ''; }
    input.addEventListener('input', sync);
    sync();
    setTimeout(function () { input.focus(); }, 0);
    return [
      el('h1', { 'class': 'check-question', text: '判定は「' + state.verdict.label + '」。それでも入る理由は？' }),
      el('p', { 'class': 'check-hint', text: 'あとで「判定を無視して入ったときの成績」と比べられるように残します。' }),
      input,
      sendBtn,
      backButton(function () { state.step = 'verdict'; render(); })
    ];
  }

  function currentFields() {
    return FX.checkFormFields({
      situation: state.situation,
      answers: state.answers,
      feeling: state.feeling,
      verdict: state.verdict,
      action: state.action,
      entryReason: state.entryReason
    });
  }

  function submit(action) {
    state.action = action;
    state.step = 'sending';
    render();
    var fields = currentFields();
    var body = new URLSearchParams();
    Object.keys(fields).forEach(function (name) {
      var entry = (config.CHECK_FORM_ENTRIES || {})[name];
      if (entry) body.append('entry.' + entry, fields[name]);
    });
    if (!config.CHECK_FORM_ACTION) {
      state.step = 'error';
      render();
      return;
    }
    // Googleフォームは別サイトなので返事の中身は読めない（no-cors）。届いたかは回答一覧で確認する。
    fetch(config.CHECK_FORM_ACTION, { method: 'POST', mode: 'no-cors', body: body })
      .then(function () { state.step = 'done'; render(); })
      .catch(function () { state.step = 'error'; render(); });
  }

  function summaryText() {
    var fields = currentFields();
    return ['【心のチェック】'].concat(Object.keys(fields).filter(function (k) {
      return fields[k] !== '';
    }).map(function (k) {
      return k + '：' + fields[k];
    })).join('\n');
  }

  function renderSummaryBlock() {
    var text = summaryText();
    var copyBtn = el('button', { type: 'button', 'class': 'check-secondary', text: 'まとめをコピー（Discordで深掘り用）', onClick: function () {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(function () { copyBtn.textContent = 'コピーしました'; });
      }
    } });
    return [el('pre', { 'class': 'check-summary', text: text }), copyBtn];
  }

  function renderDone() {
    return [
      el('h1', { 'class': 'check-question', text: '記録しました' }),
      el('p', { 'class': 'check-hint', text: state.action === 'それでも入る' || state.action === 'エントリーする'
        ? '入るなら、エントリー前フォームもいつも通りに。OCOを忘れずに。'
        : 'やめると決めた自分、えらい。今日はチャートを閉じよう。' })
    ].concat(renderSummaryBlock()).concat([
      el('a', { href: 'index.html', 'class': 'check-secondary check-link-button', text: 'ダッシュボードに戻る' })
    ]);
  }

  function renderError() {
    return [
      el('h1', { 'class': 'check-question', text: '記録に失敗しました' }),
      el('p', { 'class': 'check-hint', text: '電波を確認して、もう一度送ってください。下のまとめは残っています。' }),
      el('button', { type: 'button', 'class': 'check-primary', text: 'もう一度送る', onClick: function () { submit(state.action); } })
    ].concat(renderSummaryBlock());
  }

  function render() {
    var parts;
    switch (state.step) {
      case 'situation': parts = renderSituation(); break;
      case 'question': parts = renderQuestion(); break;
      case 'feeling': parts = renderFeeling(); break;
      case 'verdict': parts = renderVerdict(); break;
      case 'reason': parts = renderReason(); break;
      case 'sending': parts = [el('p', { 'class': 'check-hint', text: '記録しています…' })]; break;
      case 'done': parts = renderDone(); break;
      default: parts = renderError();
    }
    app.innerHTML = '';
    parts.forEach(function (p) { if (p) app.appendChild(p); });
    window.scrollTo(0, 0);
  }

  reset();
  render();
})();

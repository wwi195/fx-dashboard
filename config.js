// Googleスプレッドシートの「ファイル → 共有 → ウェブに公開 → CSV」で
// 発行されたURLをそれぞれ貼り付けてください。
// 手順は docs/superpowers/specs/2026-09-11-fx-dashboard-design.md の10節を参照。
window.FX_CONFIG = {
  CSV_ENTRY: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRpYJ0dR9WHchyyh6vlC_Md9JNzCaIQjiDODnj0tPKAIRadb_xI7ScXBGDo2Q3D5PBCDV77KcXhbBvB/pub?gid=1176633493&single=true&output=csv',
  CSV_EXIT: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSpHBAOYdYySpcBQdE3PD8nply72mnPj-xO3vIHKL2qFf-LnZ5IDG1CgFWVrMDiTP0tmu8d9oUoR6M0/pub?gid=393370168&single=true&output=csv',

  // 心のチェック（check.html）の記録先：Googleフォーム「FX心のチェック」
  // 質問名 → entry番号。フォームの質問名を変えたらここも合わせる。
  CHECK_FORM_ACTION: 'https://docs.google.com/forms/d/e/1FAIpQLSdNp8aQt7MCoNzZjP8s_pB0UPYnv46WVh8bqdABhF81x7GvLA/formResponse',
  CHECK_FORM_ENTRIES: {
    '状況': 1704285610,
    '取り返したい負け': 1658935106,
    '入りたい理由': 2121510040,
    '入らなかったら損': 1710136801,
    '体調': 1700467575,
    '今の気持ち': 332197256,
    '勝ちで気が大きく': 903964654,
    '利益を減らしてもいい': 146477777,
    '根拠の強さ': 1584943982,
    '気持ちを一言で': 1866994908,
    '判定': 1081164050,
    '選んだ行動': 1591158394,
    '入る理由': 1811940516
  }
};

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

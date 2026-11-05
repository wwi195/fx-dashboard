(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.FX = root.FX || {};
    Object.assign(root.FX, factory());
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  // normalizeEntry / normalizeExit は列の並び順（インデックス）に依存する。
  // ヘッダーの文言が変わっても、列の順序が変わらない限り壊れない。
  // 列順は docs/superpowers/specs/2026-09-11-fx-dashboard-design.md の「列定義」を参照。

  function parseAmount(raw) {
    if (raw === null || raw === undefined) return { ok: false, raw: raw };
    var s = String(raw).replace(/\\/g, '').trim();
    if (s === '') return { ok: false, raw: raw };
    if (!/^-?\d/.test(s)) return { ok: false, raw: raw };
    // 誤読すると損益やスワップの符号・桁が変わるので、紛らわしい記入は推測せず要確認にする。
    if (!/^(?:[\d.+＋\-()（）円\s]|スワップ)+$/.test(s)) return { ok: false, raw: raw };
    if (/-(?!\d)/.test(s)) return { ok: false, raw: raw };
    var matches = s.match(/-?\d+(\.\d+)?/g) || [];
    if (matches.length === 0 || matches.length > 2) return { ok: false, raw: raw };
    if (matches.length === 1 && s.indexOf('スワップ') !== -1) return { ok: false, raw: raw };
    var pnl = parseFloat(matches[0]);
    var swap = matches.length === 2 ? parseFloat(matches[1]) : 0;
    return { ok: true, pnl: pnl, swap: swap };
  }

  // 基準日がない場合の年。フォームの記録には送信時刻があるので、通常は使われない。
  var DEFAULT_YEAR = 2026;
  // 年なしの日付が基準日よりこれ以上先なら、年またぎとみなして前年にする。
  // 数日先の打ち間違いを前年扱いにしないよう、半年の幅を取る。
  var YEAR_ROLLBACK_MS = 180 * 24 * 60 * 60 * 1000;

  function parseDateTime(raw, fallbackDate, referenceDate) {
    if (!raw) return { ok: false, raw: raw };
    var trimmed = String(raw).trim();
    var tokens = trimmed.split(/\s+/);
    var datePart = null;
    var timePart = null;

    if (tokens.length === 2) {
      datePart = tokens[0];
      timePart = tokens[1];
    } else if (tokens.length === 1) {
      if (/^\d{1,2}:\d{1,2}(:\d{1,2})?$/.test(tokens[0])) {
        timePart = tokens[0];
      } else {
        return { ok: false, raw: raw };
      }
    } else {
      return { ok: false, raw: raw };
    }

    var year, month, day;
    var yearOmitted = false;
    if (datePart) {
      var dateSegs = datePart.split('/');
      if (dateSegs.length === 3) {
        year = parseInt(dateSegs[0], 10);
        month = parseInt(dateSegs[1], 10);
        day = parseInt(dateSegs[2], 10);
      } else if (dateSegs.length === 2) {
        yearOmitted = true;
        year = referenceDate ? referenceDate.getFullYear() : DEFAULT_YEAR;
        month = parseInt(dateSegs[0], 10);
        day = parseInt(dateSegs[1], 10);
      } else {
        return { ok: false, raw: raw };
      }
    } else {
      if (!fallbackDate) return { ok: false, raw: raw };
      year = fallbackDate.getFullYear();
      month = fallbackDate.getMonth() + 1;
      day = fallbackDate.getDate();
    }

    var hour, minute, second;
    second = 0;
    var timeSegs = timePart.indexOf(':') !== -1 ? timePart.split(':') : timePart.split('/');
    if (timeSegs.length < 2) return { ok: false, raw: raw };
    hour = parseInt(timeSegs[0], 10);
    minute = parseInt(timeSegs[1], 10);
    if (timeSegs.length >= 3) second = parseInt(timeSegs[2], 10);

    if ([year, month, day, hour, minute, second].some(function (n) { return isNaN(n); })) {
      return { ok: false, raw: raw };
    }
    if (month < 1 || month > 12 || day < 1 || day > 31 || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
      return { ok: false, raw: raw };
    }

    var date = new Date(year, month - 1, day, hour, minute, second);
    if (yearOmitted && referenceDate && date.getTime() - referenceDate.getTime() > YEAR_ROLLBACK_MS) {
      date = new Date(year - 1, month - 1, day, hour, minute, second);
    }
    return { ok: true, date: date };
  }

  // フォームに記入された日時を読む。時刻だけで送信時刻より後なら前日とみなす。
  function parseRecordedDateTime(raw, submissionDate, fallbackDate) {
    var result = parseDateTime(raw, submissionDate || fallbackDate, submissionDate);
    var timeOnly = /^\d{1,2}:\d{1,2}(:\d{1,2})?$/.test(String(raw || '').trim());
    if (result.ok && timeOnly && submissionDate && result.date.getTime() > submissionDate.getTime()) {
      var d = result.date;
      return {
        ok: true,
        date: new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1, d.getHours(), d.getMinutes(), d.getSeconds())
      };
    }
    return result;
  }

  function columnReader(headers) {
    var names = (headers || []).map(function (h) { return String(h).trim(); });
    return function (row, name) {
      var idx = names.indexOf(name);
      return idx === -1 ? '' : String(row[idx] || '').trim();
    };
  }

  // スワップ欄の値を金額に反映する。金額欄にもスワップがあれば、二重計上を避けて要確認にする。
  function applySwapColumn(amount, amountRaw, swapRaw) {
    if (swapRaw === '') return amount;
    var cleaned = swapRaw.replace(/\\/g, '');
    if (!/^-?\d+(\.\d+)?$/.test(cleaned) || !amount.ok || amount.swap !== 0) {
      return { ok: false, raw: amountRaw + ' / スワップ欄: ' + swapRaw };
    }
    return { ok: true, pnl: amount.pnl, swap: parseFloat(cleaned) };
  }

  var PRICE_PER_PIP = 0.01;

  // エントリー価格と方向、pipsから利確(tp)または損切(sl)の価格を計算する。計算できなければnull。
  function plannedPrice(entryPrice, direction, pips, kind) {
    var isNumber = /^\d+(\.\d+)?$/;
    var price = String(entryPrice || '').trim();
    var distance = String(pips || '').trim();
    if (!isNumber.test(price) || !isNumber.test(distance)) return null;
    if (direction !== '買い' && direction !== '売り') return null;
    var towardProfit = (direction === '買い') === (kind === 'tp');
    var delta = parseFloat(distance) * PRICE_PER_PIP * (towardProfit ? 1 : -1);
    return Number((parseFloat(price) + delta).toFixed(3));
  }

  function parseCsv(text) {
    var rows = [];
    var row = [];
    var field = '';
    var inQuotes = false;
    var i = 0;
    var len = text.length;

    function pushField() {
      row.push(field);
      field = '';
    }
    function pushRow() {
      pushField();
      rows.push(row);
      row = [];
    }

    while (i < len) {
      var ch = text[i];
      if (inQuotes) {
        if (ch === '"') {
          if (text[i + 1] === '"') {
            field += '"';
            i += 2;
            continue;
          } else {
            inQuotes = false;
            i += 1;
            continue;
          }
        } else {
          field += ch;
          i += 1;
          continue;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
          i += 1;
          continue;
        } else if (ch === ',') {
          pushField();
          i += 1;
          continue;
        } else if (ch === '\r') {
          i += 1;
          continue;
        } else if (ch === '\n') {
          pushRow();
          i += 1;
          continue;
        } else {
          field += ch;
          i += 1;
          continue;
        }
      }
    }

    if (field.length > 0 || row.length > 0) {
      pushRow();
    }

    return rows;
  }

  // 2026-11のフォーム改造で増えた列は、位置ではなく見出し名で読む。
  function normalizeEntry(rows, headers) {
    var read = columnReader(headers);
    return rows.map(function (row) {
      var ts = parseDateTime(row[0], null);
      var lotNum = parseFloat(row[3]);
      return {
        timestamp: ts,
        pair: (row[1] || '').trim(),
        direction: (row[2] || '').trim(),
        lot: isNaN(lotNum) ? null : lotNum,
        rationale: row[4] || '',
        entryPrice: row[5] || '',
        tpPrice: row[6] || '',
        slPrice: row[7] || '',
        invalidateCondition: row[8] || '',
        orderType: read(row, '注文方法'),
        tpPips: read(row, '利確pips'),
        slPips: read(row, '損切pips'),
        holdUntil: read(row, 'いつまで持つ？'),
        exitPlan: read(row, 'OCO以外で動くならどんなとき？')
      };
    });
  }

  function normalizeExit(rows, headers) {
    var read = columnReader(headers);
    return rows.map(function (row) {
      var submissionTs = parseDateTime(row[0], null);
      var submissionDate = submissionTs.ok ? submissionTs.date : null;

      var entryDt = parseRecordedDateTime(row[4], submissionDate, null);
      var exitBlank = String(row[5] || '').trim() === '';
      var exitDt = exitBlank && submissionDate
        ? { ok: true, date: submissionDate }
        : parseRecordedDateTime(row[5], submissionDate, entryDt.ok ? entryDt.date : null);

      if (entryDt.ok && exitDt.ok && exitDt.date.getTime() < entryDt.date.getTime()) {
        exitDt = { ok: true, date: new Date(exitDt.date.getTime() + 24 * 60 * 60 * 1000) };
      }

      var lotNum = parseFloat(row[3]);
      var ocoRaw = (row[7] || '').trim().toUpperCase();

      return {
        pair: (row[1] || '').trim(),
        direction: (row[2] || '').trim(),
        lot: isNaN(lotNum) ? null : lotNum,
        entryDateTime: entryDt,
        exitDateTime: exitDt,
        amount: applySwapColumn(parseAmount(row[6]), row[6], read(row, 'スワップ(円)')),
        ocoFollowed: ocoRaw === 'YES' ? true : (ocoRaw === 'NO' ? false : null),
        ocoReason: row[8] || '',
        matchedScenario: row[9] || ''
      };
    });
  }

  return {
    parseAmount: parseAmount,
    parseDateTime: parseDateTime,
    parseCsv: parseCsv,
    plannedPrice: plannedPrice,
    normalizeEntry: normalizeEntry,
    normalizeExit: normalizeExit
  };
});

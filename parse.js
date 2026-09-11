(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.FX = root.FX || {};
    Object.assign(root.FX, factory());
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  function parseAmount(raw) {
    if (raw === null || raw === undefined) return { ok: false, raw: raw };
    var s = String(raw).replace(/\\/g, '').trim();
    if (s === '') return { ok: false, raw: raw };
    if (!/^-?\d/.test(s)) return { ok: false, raw: raw };
    var matches = s.match(/-?\d+(\.\d+)?/g) || [];
    if (matches.length === 0 || matches.length > 2) return { ok: false, raw: raw };
    var pnl = parseFloat(matches[0]);
    var swap = matches.length === 2 ? parseFloat(matches[1]) : 0;
    return { ok: true, pnl: pnl, swap: swap };
  }

  function parseDateTime(raw, fallbackDate) {
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
    if (datePart) {
      var dateSegs = datePart.split('/');
      if (dateSegs.length === 3) {
        year = parseInt(dateSegs[0], 10);
        month = parseInt(dateSegs[1], 10);
        day = parseInt(dateSegs[2], 10);
      } else if (dateSegs.length === 2) {
        year = 2026;
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

    return { ok: true, date: new Date(year, month - 1, day, hour, minute, second) };
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

  return {
    parseAmount: parseAmount,
    parseDateTime: parseDateTime,
    parseCsv: parseCsv
  };
});

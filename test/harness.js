(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.FXTest = factory();
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  var tests = [];

  function test(name, fn) {
    tests.push({ name: name, fn: fn });
  }

  function run() {
    var results = [];
    var passCount = 0;
    var failCount = 0;
    tests.forEach(function (t) {
      try {
        t.fn();
        results.push({ name: t.name, pass: true });
        passCount += 1;
      } catch (e) {
        results.push({ name: t.name, pass: false, error: e.message });
        failCount += 1;
      }
    });
    return { results: results, passCount: passCount, failCount: failCount };
  }

  function assertEqual(actual, expected, message) {
    var a = JSON.stringify(actual);
    var e = JSON.stringify(expected);
    if (a !== e) {
      throw new Error((message ? message + ': ' : '') + 'expected ' + e + ' but got ' + a);
    }
  }

  function assertTrue(condition, message) {
    if (!condition) {
      throw new Error(message || 'expected condition to be true');
    }
  }

  function assertDateEqual(actual, expected, message) {
    if (!(actual instanceof Date) || !(expected instanceof Date) || actual.getTime() !== expected.getTime()) {
      throw new Error(
        (message ? message + ': ' : '') +
        'expected date ' + (expected instanceof Date ? expected.toISOString() : String(expected)) +
        ' but got ' + (actual instanceof Date ? actual.toISOString() : String(actual))
      );
    }
  }

  return {
    test: test,
    run: run,
    assertEqual: assertEqual,
    assertTrue: assertTrue,
    assertDateEqual: assertDateEqual
  };
});

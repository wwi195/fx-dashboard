require('./parse.test.js');
require('./match.test.js');

var harness = require('./harness.js');
var summary = harness.run();

summary.results.forEach(function (r) {
  console.log((r.pass ? 'PASS' : 'FAIL') + ' - ' + r.name + (r.pass ? '' : ' :: ' + r.error));
});
console.log('\n' + summary.passCount + ' passed, ' + summary.failCount + ' failed');
process.exit(summary.failCount > 0 ? 1 : 0);

// Sweep: draws N kept examples per metric with the real engine code and checks every approved rule.
// Usage: node checks/sweep.js [N] [out.csv]   (default N = 10000)
'use strict';
const C = require('../engine/core.js');
const def = require('../tools/market-share/definition.js');
const fs = require('fs');
const N = +(process.argv[2] || 10000), out = process.argv[3];
const rand = C.seeded(20261007);
let problems = 0, rows = ['metric,num,den,answer'];
for (const m of def.metrics) {
  let tries = 0, minAns = Infinity, maxAns = -Infinity, minDen = Infinity, minGap = Infinity;
  for (let i = 0; i < N; i++) {
    const d = C.drawPercentMetric(m, rand); tries += d.tries;
    const a = d.values[m.num], b = d.values[m.den], x = a / b * 100;
    const onGrid = (k, v) => v >= m.ranges[k].min && v <= m.ranges[k].max && (v - m.ranges[k].min) % m.ranges[k].step === 0;
    if (!onGrid(m.num, a) || !onGrid(m.den, b)) { problems++; console.log('off grid', m.id, a, b); }
    if (!(a < b)) { problems++; console.log('num >= den', m.id, a, b); }
    if (x < m.keep[0] || x > m.keep[1] || !isFinite(x)) { problems++; console.log('outside keep band', m.id, x); }
    if (C.thirdDecimalOfPercent(a, b) === 5) { problems++; console.log('5 in third decimal', m.id, x); }
    // the rounded answer must be marked correct, and its neighbours (±0.01) wrong
    const r = C.roundTo(x, def.grading.dp);
    if (!C.isCorrect(r, x, def.grading.tol)) { problems++; console.log('rounded answer marked wrong', m.id, a, b, r); }
    if (C.isCorrect(C.roundTo(r + 0.01, 2), x, def.grading.tol) || C.isCorrect(C.roundTo(r - 0.01, 2), x, def.grading.tol)) { problems++; console.log('two answers accepted', m.id, x); }
    minAns = Math.min(minAns, x); maxAns = Math.max(maxAns, x); minDen = Math.min(minDen, b);
    minGap = Math.min(minGap, Math.abs(Math.abs(x - r) - def.grading.tol));
    rows.push([m.id, a, b, x].join(','));
  }
  console.log(`${m.id}: ${N} kept from ${tries} draws (${(N / tries * 100).toFixed(1)}% kept); answers ${minAns.toFixed(4)}–${maxAns.toFixed(4)}%; smallest denominator ${minDen}; closest distance to the tolerance edge ${minGap.toExponential(2)}`);
}
// the spreadsheet example (Example 1) must obey the same rules
for (const m of def.metrics) {
  const v = def.example[m.id], x = v[m.num] / v[m.den] * 100;
  if (C.thirdDecimalOfPercent(v[m.num], v[m.den]) === 5) { problems++; console.log('example has 5 in third decimal', m.id); }
  rows.push([m.id, v[m.num], v[m.den], x].join(','));
}
if (out) fs.writeFileSync(out, rows.join('\n') + '\n');
console.log(problems ? `FAILED: ${problems} problems` : 'Sweep clean: 0 problems');
process.exit(problems ? 1 : 0);

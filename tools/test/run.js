'use strict';

/* 검증 스위트 전체 실행
 *
 *   node tools/test/run.js
 *
 * 하나라도 실패하면 exit 1. 요율을 갱신한 뒤에는 반드시 이걸 돌린다.
 */

const path = require('path');

const SUITES = [
  'ordinary',
  'tax',
  'insurance',
  'severance',
  'leave',
  'unemployment',
  'parental',
  'pension',
  'consistency',
  'precision'
];

const results = [];
for (const name of SUITES) {
  results.push(require(path.join(__dirname, name + '.js')));
}

console.log('\n' + '='.repeat(46));
console.log('검증 요약');
console.log('='.repeat(46));

let pass = 0;
let fail = 0;
for (const r of results) {
  pass += r.pass;
  fail += r.fail;
  const mark = r.fail ? '실패' : '통과';
  console.log('  ' + r.title.padEnd(16) + String(r.pass).padStart(4) + '건  ' + mark);
}

console.log('-'.repeat(46));
console.log('  ' + '합계'.padEnd(16) + String(pass).padStart(4) + '건 중 ' + fail + '건 실패');

if (fail) {
  console.log('\n실패 항목');
  for (const r of results) {
    for (const f of r.failures) console.log('  [' + r.title + '] ' + f);
  }
  process.exit(1);
}

console.log('\n전부 통과');

'use strict';

/* 검증 스위트 공용 헬퍼.
 *
 * 외부 테스트 프레임워크를 쓰지 않는다. 이 프로젝트는 런타임·빌드 모두
 * 의존성 0을 유지하고 있고, 검증도 Node 내장 기능만으로 충분하다.
 */

const path = require('path');

const ROOT = path.join(__dirname, '..', '..');

// calc.js 는 브라우저용이라 TAX_TABLE 을 전역에서 찾는다.
function loadCalc() {
  global.TAX_TABLE = require(path.join(ROOT, 'public', 'assets', 'tax-table.js'));
  return require(path.join(ROOT, 'public', 'assets', 'calc.js'));
}

function createSuite(title) {
  let pass = 0;
  let fail = 0;
  const failures = [];

  function section(name) {
    console.log('\n--- ' + name + ' ---');
  }

  function check(label, actual, expected, tol) {
    tol = tol || 0;
    const ok = typeof actual === 'number' && typeof expected === 'number'
      ? Math.abs(actual - expected) <= tol
      : actual === expected;
    if (ok) {
      pass++;
      console.log('PASS  ' + label + '  → ' + actual);
    } else {
      fail++;
      failures.push(label + ': ' + actual + ' (기대 ' + expected + ')');
      console.log('FAIL  ' + label + '  → ' + actual + '  (기대: ' + expected + ')');
    }
  }

  // 참/거짓만 보는 경우
  function ok(label, cond) {
    check(label, cond ? 1 : 0, 1);
  }

  function done() {
    console.log('\n' + title + ': ' + pass + ' passed, ' + fail + ' failed');
    return { title, pass, fail, failures };
  }

  return { section, check, ok, done };
}

// 정수 연산으로 만든 기댓값. 부동소수 곱셈으로 기댓값을 만들면
// 계산 버그와 기댓값이 함께 틀려 테스트가 통과해 버린다.
// 실제로 고용보험료가 27,000원 대신 26,990원으로 나오던 버그를
// 기존 테스트가 이 이유로 놓쳤다.
//
//   exactFloor10(3000000, 9, 1000)  →  3,000,000 × (9/1000) 을 10원 절사
function exactFloor10(base, numerator, denominator) {
  return Math.floor(base * numerator / denominator / 10) * 10;
}

module.exports = { loadCalc, createSuite, exactFloor10, ROOT };

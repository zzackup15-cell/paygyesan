'use strict';

/* 부동소수점 회귀 방지.
 *
 * 배경: 0.009 같은 요율은 2진 부동소수로 정확히 표현되지 않는다.
 * 3,000,000 × 0.009 가 26,999.999999999996 으로 나오고, 이대로 10원 절사하면
 * 고용보험료가 27,000원이 아니라 26,990원이 되어 10원이 사라진다.
 * 이 오차는 공제 합계와 실수령액까지 전파됐고, 실제로 라이브에 나가 있었다.
 *
 * 기존 테스트가 이를 놓친 이유는 기댓값을 똑같은 부동소수 연산으로
 * 만들었기 때문이다. 버그와 기댓값이 함께 틀려 통과해 버렸다.
 * 그래서 이 파일의 기댓값은 반드시 정수 연산으로만 만든다.
 */

const { loadCalc, createSuite, exactFloor10 } = require('./_assert');
const C = loadCalc();
const s = createSuite('부동소수점');

s.section('알려진 회귀 지점');
s.check('3,000,000 × 0.9% = 27,000원', C.insurance(3000000).employment, 27000);
s.check('3,000,000 × 0.45% = 13,500원',
  C.employerInsurance(3000000, { sizeKey: 'priority' }).stability, 13500);
s.check('실수령액 2,665,440원', C.netPay(3000000, 200000, 1, 0).net, 2665440);

s.section('진짜 소수가 있는 값은 그대로 절사되어야 한다 (과잉 보정 방지)');
// 2,777,777 × 0.9% = 24,999.993 → 24,990 이 정답. 25,000 으로 올리면 안 된다.
s.check('2,777,777 × 0.9% → 24,990원', C.insurance(2777777).employment, 24990);
s.check('1,111,111 × 0.9% → 9,990원', C.insurance(1111111).employment, 9990);

s.section('전 요율 차등 검사 (정수 연산 기댓값과 대조)');
let checked = 0;
const mismatches = [];

function sweep(label, fn, expectFn, from, to, step) {
  for (let w = from; w <= to; w += step) {
    const got = fn(w);
    const want = expectFn(w);
    checked++;
    if (got !== want) mismatches.push(label + ' base=' + w + ' → ' + got + ' (기대 ' + want + ')');
  }
}

// 근로자 부담
sweep('국민연금', w => C.insurance(w).pension,
  w => exactFloor10(Math.min(Math.max(Math.floor(w / 1000) * 1000, 410000), 6590000), 475, 10000),
  300000, 12000000, 6000);
sweep('건강보험', w => C.insurance(w).health, w => exactFloor10(w, 3595, 100000), 300000, 12000000, 6000);
sweep('고용보험', w => C.insurance(w).employment, w => exactFloor10(w, 9, 1000), 300000, 12000000, 6000);
sweep('장기요양', w => C.insurance(w).care,
  w => exactFloor10(exactFloor10(w, 3595, 100000), 1314, 10000), 300000, 12000000, 6000);

// 사업주 고용안정 4구간
for (const [key, bp] of [['under150', 25], ['priority', 45], ['under1000', 65], ['over1000', 85]]) {
  sweep('고용안정 ' + key, w => C.employerInsurance(w, { sizeKey: key }).stability,
    w => exactFloor10(w, bp, 10000), 300000, 12000000, 11000);
}

// 지방소득세 (소득세 × 10%)
sweep('지방소득세', w => C.netPay(w, 0, 1, 0).localTax,
  w => exactFloor10(C.incomeTax(w, 1, 0), 1, 10), 1000000, 12000000, 7000);

s.check('차등 검사 ' + checked.toLocaleString() + '건 불일치 0', mismatches.length, 0);
if (mismatches.length) mismatches.slice(0, 5).forEach(m => console.log('    ' + m));

s.section('비율 계산 (절사 없는 값)');
// 구직급여 60%, 최저 80%, 육아휴직 80% — 정수 분수로 대조
let ratioBad = 0;
for (let d = 10000; d <= 200000; d += 37) {
  const got = C.dailyBenefit(d, 8);
  const want = Math.max(Math.min(d, 113500) * 6 / 10, 8 * 10320 * 8 / 10);
  if (Math.abs(got - want) > 1e-6) ratioBad++;
}
s.check('구직급여일액 × 60% / 하한 × 80%', ratioBad, 0);

let parentalBad = 0;
for (let w = 100000; w <= 6000000; w += 3000) {
  const got = C.parentalLeaveMonth(7, w, false).amount;
  const want = Math.max(Math.min(w * 8 / 10, 1600000), 700000);
  if (Math.abs(got - want) > 1e-6) parentalBad++;
}
s.check('육아휴직 7개월차 × 80%', parentalBad, 0);

module.exports = s.done();

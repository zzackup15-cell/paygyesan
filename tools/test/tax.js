'use strict';

/* 소득세·4대보험 근로자 부담 — 간이세액표, 자녀공제, 국민연금 상·하한, netPay */

const { loadCalc, createSuite, exactFloor10 } = require('./_assert');
const C = loadCalc();
const s = createSuite('소득세·4대보험');

s.section('간이세액표 (소득세법 시행령 별표2)');
// 표에서 직접 확인한 값들. 부동소수와 무관한 정수라 그대로 쓴다.
s.check('월 300만 / 가족1', C.incomeTax(3000000, 1, 0), 74350);
s.check('월 280만 / 가족1', C.incomeTax(2800000, 1, 0), 56800);
s.check('월 100만 (세액 0 구간)', C.incomeTax(1000000, 1, 0), 0);
s.check('구간 내부는 같은 값', C.incomeTax(3000000, 1, 0), C.incomeTax(3019999, 1, 0));
s.check('가족 수가 늘면 세액 감소', C.incomeTax(3000000, 4, 0) < C.incomeTax(3000000, 1, 0) ? 1 : 0, 1);

s.section('월급여 1,000만원 경계 (별표2 제6호)');
const top1 = 1507400; // 10,000천원 · 가족수 1
s.check('정확히 1,000만원은 표의 값', C.incomeTax(10000000, 1, 0), top1);
s.check('1,000만원 초과부터 가산 산식', C.incomeTax(10000001, 1, 0) > top1 ? 1 : 0, 1);
s.check('1,200만원', C.incomeTax(12000000, 1, 0),
  Math.floor((top1 + 2000000 * 0.98 * 0.35 + 25000) / 10) * 10);
s.check('2,000만원', C.incomeTax(20000000, 1, 0),
  Math.floor((top1 + 1397000 + 6000000 * 0.98 * 0.38) / 10) * 10);
s.check('1억원', C.incomeTax(100000000, 1, 0),
  Math.floor((top1 + 31034600 + 13000000 * 0.45) / 10) * 10);

s.section('8~20세 자녀 세액공제 (별표2 제3호)');
s.check('1명', C.childCredit(1), 20830);
s.check('2명', C.childCredit(2), 45830);
s.check('3명', C.childCredit(3), 45830 + 33330);
s.check('5명', C.childCredit(5), 45830 + 33330 * 3);
s.check('음수', C.childCredit(-3), 0);
const base400 = C.incomeTax(4000000, 3, 0);
s.check('세액에서 차감', C.incomeTax(4000000, 3, 2), base400 - 45830);
s.check('공제가 세액보다 크면 0', C.incomeTax(1100000, 1, 3), 0);

s.section('4대보험 근로자 부담 (월 300만, 2026년 요율)');
const ins = C.insurance(3000000);
s.check('국민연금 4.75%', ins.pension, exactFloor10(3000000, 475, 10000));
s.check('건강보험 3.595%', ins.health, exactFloor10(3000000, 3595, 100000));
s.check('장기요양 건보료의 13.14%', ins.care, exactFloor10(ins.health, 1314, 10000));
s.check('고용보험 0.9% — 27,000원 (부동소수 회귀)', ins.employment, 27000);
s.check('합계', ins.total, ins.pension + ins.health + ins.care + ins.employment);

s.section('국민연금 기준소득월액 상·하한');
const hi = C.insurance(9000000);
const lo = C.insurance(300000);
s.check('상한 659만 적용', hi.pension, exactFloor10(6590000, 475, 10000));
s.check('하한 41만 적용', lo.pension, exactFloor10(410000, 475, 10000));
s.check('상한 경계 동일', C.insurance(6590000).pension, C.insurance(9999999).pension);
s.check('하한 경계 동일', C.insurance(100000).pension, C.insurance(410000).pension);
s.check('건강보험은 상한 미적용', hi.health, exactFloor10(9000000, 3595, 100000));
s.check('급여 0이면 전부 0', C.insurance(0).total, 0);

s.section('실수령액 (월 300만 / 비과세 20만 / 1인 가구)');
const n = C.netPay(3000000, 200000, 1, 0);
s.check('과세 대상 = 총액 − 비과세', n.taxable, 2800000);
s.check('소득세 = 표(280만, 가족1)', n.incomeTax, C.incomeTax(2800000, 1, 0));
s.check('지방소득세 = 소득세 10%', n.localTax, Math.floor(n.incomeTax / 10 / 10) * 10);
s.check('공제 합계 334,560원', n.deduction, 334560);
s.check('실수령 2,665,440원', n.net, 2665440);
s.check('실수령 = 총액 − 공제계', n.net, 3000000 - n.deduction);
s.check('공제계 = 4대보험 + 소득세 + 지방세', n.deduction, n.insuranceTotal + n.incomeTax + n.localTax);

s.section('실수령액 방어');
s.check('비과세 > 총액', C.netPay(1000000, 9999999, 1, 0).taxable, 0);
s.check('음수 총액', C.netPay(-500000, 0, 1, 0).net, 0);
s.check('NaN 총액', C.netPay(NaN, 0, 1, 0).net, 0);
s.check('가족수 0 → 1로 보정', C.incomeTax(3000000, 0, 0), C.incomeTax(3000000, 1, 0));
s.check('가족수 99 → 11로 보정', C.incomeTax(3000000, 99, 0), C.incomeTax(3000000, 11, 0));

module.exports = s.done();

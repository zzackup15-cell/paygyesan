'use strict';

/* 4대보험 사업주 부담 — 규모별 고용안정 요율, 산재 선택 입력 */

const { loadCalc, createSuite, exactFloor10 } = require('./_assert');
const C = loadCalc();
const s = createSuite('4대보험 사업주');

const emp = C.insurance(3000000);
const er = C.employerInsurance(3000000, { sizeKey: 'under150' });

s.section('3대 보험은 근로자와 동일 (월 300만)');
s.check('국민연금', er.pension, emp.pension);
s.check('건강보험', er.health, emp.health);
s.check('장기요양', er.care, emp.care);
s.check('고용보험 실업급여', er.employment, emp.employment);

s.section('고용안정·직업능력개발 (사업주 전액, 규모별)');
const tiers = [
  ['under150', 25, '150인 미만 0.25%'],
  ['priority', 45, '150인 이상 우선지원 0.45%'],
  ['under1000', 65, '150~1,000인 0.65%'],
  ['over1000', 85, '1,000인 이상 0.85%']
];
for (const [key, bp, label] of tiers) {
  const x = C.employerInsurance(3000000, { sizeKey: key });
  s.check(label, x.stability, exactFloor10(3000000, bp, 10000));
}
s.check('알 수 없는 규모 → 150인 미만', C.employerInsurance(3000000, { sizeKey: 'xxx' }).stability, 7500);
s.check('sizeKey 없음 → 150인 미만', C.employerInsurance(3000000, {}).stability, 7500);
s.check('opts 자체 없음 → 150인 미만', C.employerInsurance(3000000).stability, 7500);
s.check('근로자는 고용안정 부담 없음', emp.stability === undefined ? 1 : 0, 1);

s.section('국민연금 상·하한이 사업주에도 동일 적용');
s.check('상한 659만', C.employerInsurance(9000000, {}).pension, exactFloor10(6590000, 475, 10000));
s.check('상한 시 근로자와 동일', C.employerInsurance(9000000, {}).pension, C.insurance(9000000).pension);
s.check('하한 41만', C.employerInsurance(300000, {}).pension, exactFloor10(410000, 475, 10000));
s.check('하한 시 근로자와 동일', C.employerInsurance(300000, {}).pension, C.insurance(300000).pension);

s.section('산재보험 (업종별이라 선택 입력)');
s.check('미입력 시 0', C.employerInsurance(3000000, {}).accident, 0);
s.check('0.7% 입력', C.employerInsurance(3000000, { accidentRate: '0.7' }).accident, exactFloor10(3000000, 7, 1000));
s.check('1.5% 입력', C.employerInsurance(3000000, { accidentRate: '1.5' }).accident, exactFloor10(3000000, 15, 1000));
s.check('문자 입력 → 0', C.employerInsurance(3000000, { accidentRate: 'abc' }).accident, 0);
s.check('음수 → 절댓값(toHours 규칙)', C.employerInsurance(3000000, { accidentRate: '-2' }).accident, exactFloor10(3000000, 2, 100));
s.check('99% → 20% 상한', C.employerInsurance(3000000, { accidentRate: '99' }).accident, exactFloor10(3000000, 20, 100));

s.section('합계와 인건비 (월 300만 / 150인 미만)');
s.check('근로자 부담 291,520원', emp.total, 291520);
s.check('사업주 부담 299,020원', er.total, 299020);
s.check('사업주 합계 검산', er.total, er.pension + er.health + er.care + er.employment + er.stability + er.accident);
s.check('회사 인건비 3,299,020원', 3000000 + er.total, 3299020);
s.check('사업주 부담 > 근로자 부담', er.total > emp.total ? 1 : 0, 1);

s.section('방어');
s.check('급여 0', C.employerInsurance(0, {}).total, 0);
s.check('급여 음수', C.employerInsurance(-500000, {}).total, 0);
s.check('급여 NaN', C.employerInsurance(NaN, {}).total, 0);
let weird = 0;
for (const v of ['1e308', '-1', 'Infinity', 'NaN', '<script>', '  ', '0']) {
  const x = C.employerInsurance(C.toAmount(v), { sizeKey: 'under150', accidentRate: v });
  for (const k of ['pension', 'health', 'care', 'employment', 'stability', 'accident', 'total']) {
    if (!Number.isFinite(x[k]) || x[k] < 0) weird++;
  }
}
s.check('극단 입력 7종 × 7필드 전부 유한·비음수', weird, 0);

module.exports = s.done();

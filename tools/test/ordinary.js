'use strict';

/* 통상임금 — 월 소정근로시간, 주휴시간, 통상시급, 가산수당, 연봉 환산, 입력 방어 */

const { loadCalc, createSuite } = require('./_assert');
const C = loadCalc();
const s = createSuite('통상임금');

s.section('월 소정근로시간');
s.check('주 40시간 → 209시간', C.monthlyScheduledHours(40), 209);
s.check('주 35시간', C.monthlyScheduledHours(35), Math.round((35 + 7) * (365 / 7 / 12)));
s.check('주 20시간 → 104시간', C.monthlyScheduledHours(20), 104);
s.check('주 15시간 → 78시간', C.monthlyScheduledHours(15), 78);
s.check('주 14시간 (주휴 없음)', C.monthlyScheduledHours(14), Math.round(14 * (365 / 7 / 12)));
s.check('주 44시간 입력 → 40으로 상한', C.monthlyScheduledHours(44), 209);

s.section('주휴시간 (근로기준법 제18조 제3항)');
s.check('주 40시간 → 8시간', C.weeklyHolidayHours(40), 8);
s.check('주 20시간 → 4시간', C.weeklyHolidayHours(20), 4);
s.check('주 15시간 (경계, 발생)', C.weeklyHolidayHours(15), 3);
s.check('주 14.9시간 (초단시간, 미발생)', C.weeklyHolidayHours(14.9), 0);
s.check('주 14시간 → 0', C.weeklyHolidayHours(14), 0);

s.section('통상시급');
const items1 = [{ amount: 3000000, period: 'monthly', included: true }];
const total1 = C.totalOrdinaryWage(items1);
const hourly1 = C.hourlyOrdinaryWage(total1, C.monthlyScheduledHours(40));
s.check('기본급 300만 총액', total1, 3000000);
s.check('통상시급 14,354.1원', Math.round(hourly1 * 10) / 10, 14354.1, 0.05);
s.check('통상일급 114,833원', Math.round(C.derived(hourly1).daily), 114833);

s.section('복합 케이스 (기본급 300만 + 직책 20만 + 식대 20만 + 정기상여 연 600만, 성과급 100만 제외)');
const items2 = [
  { amount: 3000000, period: 'monthly', included: true },
  { amount: 200000, period: 'monthly', included: true },
  { amount: 200000, period: 'monthly', included: true },
  { amount: 6000000, period: 'annual', included: true },
  { amount: 1000000, period: 'monthly', included: false }
];
const total2 = C.totalOrdinaryWage(items2);
const hourly2 = C.hourlyOrdinaryWage(total2, 209);
s.check('월 통상임금 총액 3,900,000원', total2, 3900000);
s.check('통상시급 18,660.3원', Math.round(hourly2 * 10) / 10, 18660.3, 0.05);

s.section('가산수당');
const d = C.derived(hourly2);
s.check('연장 10시간 (×1.5)', Math.round(d.overtime * 10), 279904, 1);
s.check('야간 5시간 (×0.5)', Math.round(d.night * 5), 46651, 1);
s.check('휴일 8시간 이내 (×1.5)', Math.round(d.holidayWithin8 * 8), 223923, 1);
s.check('휴일 8시간 초과 (×2.0)', Math.round(d.holidayOver8 * 2), 74641, 1);
s.check('야간은 연장의 1/3 배율', Math.round(d.night * 3), Math.round(d.overtime), 1);
s.check('휴일초과는 연장의 4/3 배율', Math.round(d.holidayOver8 * 3), Math.round(d.overtime * 4), 2);

s.section('연봉 환산');
const gross2 = C.totalGrossWage(items2);
s.check('세전 급여 총액 (제외 항목 포함)', gross2, 4900000);
s.check('통상임금 기준 연봉', C.toAnnual(total2), 46800000);
s.check('세전 급여 총액 연봉', C.toAnnual(gross2), 58800000);
const extra = d.overtime * 10 + d.night * 5 + d.holidayWithin8 * 8 + d.holidayOver8 * 2;
s.check('가산수당 월 합계', Math.round(extra), 625120, 1);
s.check('영끌 연봉', Math.round(C.toAnnual(gross2 + extra)), 66301435, 20);
s.check('연 단위 항목 ÷12 후 ×12 원금 복원',
  C.toAnnual(C.totalGrossWage([{ amount: 6000000, period: 'annual', included: true }])), 6000000);

s.section('단시간 근로자');
s.check('주 20시간 월 100만 → 시급 9,615.4원',
  Math.round(C.hourlyOrdinaryWage(1000000, C.monthlyScheduledHours(20)) * 10) / 10, 9615.4, 0.05);

s.section('입력 방어');
s.check('음수', C.toAmount(-5000), 0);
s.check('문자', C.toAmount('abc'), 0);
s.check('Infinity', C.toAmount(Infinity), 0);
s.check('콤마 포함', C.toAmount('3,000,000'), 3000000);
s.check('금액 상한', C.toAmount('999999999999999'), C.MAX_AMOUNT);
s.check('시간 음수 → 절댓값', C.toHours('-8'), 8);
s.check('시간 문자', C.toHours('..'), 0);
s.check('시간 상한', C.toHours('99999'), 999);
s.check('0시간 → 시급 0', C.hourlyOrdinaryWage(3000000, 0), 0);
s.check('총액에 Infinity', C.totalOrdinaryWage([{ amount: Infinity, period: 'monthly', included: true }]), 0);
s.check('급여총액에 Infinity', C.totalGrossWage([{ amount: Infinity, period: 'monthly', included: false }]), 0);
s.check('연봉 환산 음수', C.toAnnual(-100), 0);
s.check('연봉 환산 NaN', C.toAnnual(NaN), 0);

module.exports = s.done();

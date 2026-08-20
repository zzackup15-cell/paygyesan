'use strict';

/* 계산기 간 일관성.
 *
 * 같은 법 개념을 두 계산기에서 따로 구현하면 언젠가 갈라진다.
 * 실제로 실업급여 계산기가 퇴직금과 같은 '평균임금'을 쓰면서도
 * 상여금 3/12 산입과 통상임금 비교를 빠뜨린 적이 있다.
 * 이 파일은 그런 어긋남을 잡는다.
 */

const { loadCalc, createSuite } = require('./_assert');
const C = loadCalc();
const s = createSuite('일관성');

s.section('통상시급 — 모든 계산기가 같은 산식을 쓴다');
const hourly = C.hourlyOrdinaryWage(3000000, C.monthlyScheduledHours(40));
const dailyOrdinary = hourly * 8;
s.check('월 300만 → 통상시급', Math.round(hourly * 10) / 10, 14354.1, 0.05);
s.check('통상일급 = 통상시급 × 8', Math.round(dailyOrdinary), 114833);
s.check('연차수당 기준과 동일', Math.round(C.annualLeavePay(dailyOrdinary, 1)), Math.round(dailyOrdinary));
s.check('퇴직금 통상임금 대체 기준과 동일',
  Math.round(C.severance(0, dailyOrdinary, 730).base), Math.round(dailyOrdinary));

s.section('평균임금 — 퇴직금과 실업급여가 같아야 한다 (근로기준법 제2조 제1항 제6호)');
const opts = { wage3Months: 9000000, annualBonus: 6000000, annualLeavePay: 1200000, periodDays: 92 };
const avg = C.averageDailyWage(opts);
s.check('상여·연차 3/12 산입', Math.round(avg), Math.round((9000000 + 1500000 + 300000) / 92));
s.check('퇴직금이 쓰는 값', Math.round(C.severance(avg, 0, 730).base), Math.round(avg));
s.check('실업급여 기초일액도 같은 값', Math.round(C.unemploymentBenefit({
  baseDaily: avg, dailyHours: 8, insuredYears: 3
}).baseDaily), Math.round(avg));

s.section('평균임금 < 통상임금이면 통상임금 (퇴직금 제2조 제2항 / 실업급여 제45조 제2항)');
const lowAvg = C.averageDailyWage({ wage3Months: 5000000, periodDays: 92 });
s.check('평균임금이 더 낮은 상황', lowAvg < dailyOrdinary ? 1 : 0, 1);
s.check('퇴직금은 통상임금으로 대체', Math.round(C.severance(lowAvg, dailyOrdinary, 730).base), Math.round(dailyOrdinary));
// 실업급여 UI 는 max(평균임금, 1일 통상임금) 을 기초일액으로 넘긴다.
// 두 계산기가 같은 판단을 하는지 확인한다.
s.check('실업급여도 같은 기준', Math.round(Math.max(lowAvg, dailyOrdinary)), Math.round(dailyOrdinary));

s.section('주휴시간 — 주휴수당과 월 소정근로시간이 같은 함수를 쓴다');
s.check('주 40시간 주휴 8시간', C.weeklyHolidayHours(40), 8);
s.check('월 소정근로시간에 주휴가 포함됨',
  C.monthlyScheduledHours(40), Math.round((40 + C.weeklyHolidayHours(40)) * C.WEEKS_PER_MONTH));
s.check('주 20시간도 동일 구조',
  C.monthlyScheduledHours(20), Math.round((20 + C.weeklyHolidayHours(20)) * C.WEEKS_PER_MONTH));

s.section('4대보험 — 근로자와 사업주가 같은 기준소득월액을 쓴다');
for (const w of [300000, 3000000, 6590000, 9000000]) {
  s.check('급여 ' + w.toLocaleString() + ' 국민연금 일치',
    C.employerInsurance(w, {}).pension, C.insurance(w).pension);
}

s.section('최저임금 — 주휴수당과 실업급여 하한이 같은 상수를 참조한다');
s.check('최저임금 상수', C.RATES.minWage.hourly, 10320);
s.check('월 환산 209시간 = 2,156,880원', C.RATES.minWage.hourly * 209, 2156880);
s.check('실업급여 하한이 최저임금에서 파생', C.minDailyBenefit(8), 8 * C.RATES.minWage.hourly * 0.8);

module.exports = s.done();

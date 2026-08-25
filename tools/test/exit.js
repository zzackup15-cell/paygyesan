'use strict';

/* 퇴사 시 받는 돈 (조합 계산).
 *
 * 새로운 산식은 하나도 없다. 그래서 이 파일의 중심 검증도 하나다.
 *
 *   조합해서 나온 값이 개별 계산기의 값과 정확히 같아야 한다.
 *
 * 조합 계산기의 위험은 산식이 틀리는 것이 아니라 '따로 놀기' 다. 퇴직금
 * 계산기와 이 페이지가 다른 숫자를 내놓으면 둘 다 못 믿게 된다. 실제로
 * 실업급여와 퇴직금이 같은 평균임금을 쓰면서 산식이 갈라진 적이 있다.
 */

const { loadCalc, createSuite } = require('./_assert');
const C = loadCalc();
const s = createSuite('퇴사 정산');

const CASE = {
  hireDate: '2021-03-02',
  lastWorkDate: '2026-06-30',
  monthlyWage: 3500000,
  annualBonus: 6000000,
  unusedDays: 10,
  monthlyCost: 2500000
};
const r = C.exitPackage(CASE);

// 개별 계산기와 같은 경로로 직접 구한 값
const hire = C.parseDate(CASE.hireDate);
const last = C.parseDate(CASE.lastWorkDate);
const quit = new Date(last.getTime() + 24 * 60 * 60 * 1000);
const days = C.serviceDays(hire, last);
const periodDays = C.daysBetween(C.minusMonths(quit, 3), quit);
const avg = C.averageDailyWage({
  wage3Months: CASE.monthlyWage * 3, annualBonus: CASE.annualBonus, periodDays
});
const ordinary = C.hourlyOrdinaryWage(CASE.monthlyWage, C.monthlyScheduledHours(40)) * 8;

s.section('★ 조합이 개별 계산기와 같은 값을 내는가');
s.check('재직일수', r.serviceDays, days);
s.check('평균임금', Math.round(r.averageDaily), Math.round(avg));
s.check('통상일급', Math.round(r.ordinaryDaily), Math.round(ordinary));
s.check('퇴직금', r.severance, Math.floor(C.severance(avg, ordinary, days).amount));
s.check('연차수당', r.annualLeavePay, Math.floor(C.annualLeavePay(ordinary, 10)));
const ui = C.unemploymentBenefit({
  baseDaily: Math.max(avg, ordinary), dailyHours: 8,
  insuredYears: C.monthsBetween(hire, quit) / 12, isOver50: false
});
s.check('구직급여일액', r.benefitDaily, Math.floor(ui.daily));
s.check('소정급여일수', r.benefitDays, ui.days);
s.check('구직급여 총액', r.benefitTotal, Math.floor(ui.daily) * ui.days);

s.section('평균임금과 통상임금 중 높은 쪽을 쓴다');
s.ok('이 사례는 통상임금이 더 높다', r.ordinaryDaily > r.averageDaily);
s.check('퇴직금 기준이 통상일급',
  Math.round(C.severance(r.averageDaily, r.ordinaryDaily, days).base), Math.round(r.ordinaryDaily));
// 상여금이 크면 평균임금이 역전한다
const bonusHeavy = C.exitPackage(Object.assign({}, CASE, { annualBonus: 30000000 }));
s.ok('상여금이 크면 평균임금이 더 높다', bonusHeavy.averageDaily > bonusHeavy.ordinaryDaily);
s.ok('그때 퇴직금이 더 크다', bonusHeavy.severance > r.severance);

s.section('합계');
s.check('즉시 수령 = 퇴직금 + 연차수당', r.immediate, r.severance + r.annualLeavePay);
s.check('총액 = 즉시 + 구직급여', r.total, r.immediate + r.benefitTotal);

s.section('구직급여 수급 자격');
s.ok('비자발 퇴사는 수급 가능', r.benefitEligible === true);
s.check('사유 표기', r.reason, 'ok');
const vol = C.exitPackage(Object.assign({}, CASE, { voluntary: true }));
s.ok('자발적 퇴사는 수급 불가', vol.benefitEligible === false);
s.check('사유 표기', vol.reason, 'voluntary');
s.check('구직급여 0', vol.benefitTotal, 0);
s.check('퇴직금·연차수당은 그대로', vol.immediate, r.immediate);
// 피보험 단위기간 180일 미만
const short = C.exitPackage({ hireDate: '2026-02-01', lastWorkDate: '2026-06-30', monthlyWage: 3000000 });
s.ok('180일 미만은 수급 불가', short.benefitEligible === false);
s.check('사유 표기', short.reason, 'shortInsured');
s.ok('재직 180일 미만', short.serviceDays < C.RATES.unemployment.minInsuredDays);

s.section('퇴직금은 1년 이상부터');
s.check('재직 364일이면 0',
  C.exitPackage({ hireDate: '2025-07-02', lastWorkDate: '2026-06-30', monthlyWage: 3000000 }).severance, 0);
s.ok('재직 365일이면 발생',
  C.exitPackage({ hireDate: '2025-07-01', lastWorkDate: '2026-06-30', monthlyWage: 3000000 }).severance > 0);

s.section('50세 이상은 소정급여일수가 길다');
const over50 = C.exitPackage(Object.assign({}, CASE, { isOver50: true }));
s.ok('일수가 더 많다', over50.benefitDays > r.benefitDays);
s.ok('총액도 더 많다', over50.benefitTotal > r.benefitTotal);

s.section('월별 현금흐름');
s.ok('흐름이 있다', r.flow.length > 0);
s.check('1개월차에 퇴직금', r.flow[0].severance, r.severance);
s.check('1개월차에 연차수당', r.flow[0].leave, r.annualLeavePay);
s.check('1개월차에는 구직급여 없음 (대기기간)', r.flow[0].benefit, 0);
s.ok('2개월차부터 구직급여', r.flow[1].benefit > 0);
const flowSum = r.flow.reduce((a, x) => a + x.amount, 0);
s.check('현금흐름 합계 = 총액', flowSum, r.total);
s.check('마지막 누적 = 총액', r.flow[r.flow.length - 1].cumulative, r.total);
// 구직급여 일수가 30일 단위로 쪼개져 전부 지급되는지
const paidDays = r.flow.reduce((a, x) => a + (x.benefit / r.benefitDaily || 0), 0);
s.check('지급 일수 합계 = 소정급여일수', Math.round(paidDays), r.benefitDays);
s.ok('흐름 개월 수 상한', r.flow.length <= C.EXIT.maxFlowMonths);
// 자발적 퇴사는 한 달치만
s.check('자발적 퇴사는 1개월', vol.flow.length, 1);

s.section('몇 개월 버티는가');
s.check('총액 ÷ 월 생활비', Math.round(r.survivalMonths * 10),
  Math.round(r.total / CASE.monthlyCost * 10));
s.check('생활비 미입력이면 0', C.exitPackage(Object.assign({}, CASE, { monthlyCost: 0 })).survivalMonths, 0);

s.section('입력 방어 — 어떤 값을 넣어도 유한하고 음수가 아니다');
const junk = [
  {},
  { hireDate: '', lastWorkDate: '', monthlyWage: 0 },
  { hireDate: '2020-01-01', lastWorkDate: '2019-01-01', monthlyWage: 3000000 },
  { hireDate: '2021-03-02', lastWorkDate: '2026-06-30', monthlyWage: -5000000 },
  { hireDate: '2021-03-02', lastWorkDate: '2026-06-30', monthlyWage: NaN },
  { hireDate: '2021-03-02', lastWorkDate: '2026-06-30', monthlyWage: 1e308 },
  { hireDate: '2021-03-02', lastWorkDate: '2026-06-30', monthlyWage: 3000000, unusedDays: -9 },
  { hireDate: '2021-03-02', lastWorkDate: '2026-06-30', monthlyWage: 3000000, unusedDays: 9999 },
  { hireDate: '2021-03-02', lastWorkDate: '2026-06-30', monthlyWage: '3,500,000', annualBonus: '6,000,000' },
  { hireDate: '1900-01-01', lastWorkDate: '2026-06-30', monthlyWage: 3000000 },
  { hireDate: '2021-03-02', lastWorkDate: '2026-06-30', monthlyWage: 3000000, weeklyHours: 0, dailyHours: 0 }
];
for (let i = 0; i < junk.length; i++) {
  const x = C.exitPackage(junk[i]);
  const flowOk = x.flow.every((f) => isFinite(f.amount) && f.amount >= 0);
  s.ok('입력 ' + (i + 1) + ' 유한·비음수',
    isFinite(x.total) && x.total >= 0 &&
    isFinite(x.severance) && x.severance >= 0 &&
    isFinite(x.benefitTotal) && x.benefitTotal >= 0 &&
    isFinite(x.survivalMonths) && x.survivalMonths >= 0 && flowOk);
}
s.check('날짜가 뒤집히면 재직 0',
  C.exitPackage({ hireDate: '2026-01-01', lastWorkDate: '2020-01-01', monthlyWage: 3000000 }).serviceDays, 0);
s.check('콤마 문자열 파싱',
  C.exitPackage(Object.assign({}, CASE, { monthlyWage: '3,500,000' })).severance, r.severance);
s.check('미사용 연차 상한', C.exitPackage(Object.assign({}, CASE, { unusedDays: 9999 })).annualLeavePay,
  Math.floor(C.annualLeavePay(r.ordinaryDaily, C.MAX_UNUSED_DAYS)));

s.section('결과는 원 단위 정수');
for (const wage of [2777777, 3333333, 4444444]) {
  const x = C.exitPackage(Object.assign({}, CASE, { monthlyWage: wage }));
  s.ok(wage.toLocaleString() + ' 정수',
    Number.isInteger(x.severance) && Number.isInteger(x.annualLeavePay) &&
    Number.isInteger(x.benefitTotal) && Number.isInteger(x.total));
}

module.exports = s.done();

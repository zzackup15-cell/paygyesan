'use strict';

/* 구직급여(실업급여) — 상·하한, 소정급여일수, 기초일액 (고용보험법 제45·46조, 별표1) */

const { loadCalc, createSuite } = require('./_assert');
const C = loadCalc();
const s = createSuite('실업급여');

const U = C.RATES.unemployment;
const MIN_WAGE = C.RATES.minWage.hourly;

s.section('2026년 기준값');
s.check('기초일액 상한 113,500원', U.maxBaseDaily, 113500);
s.check('구직급여일액 상한 68,100원', U.maxBaseDaily * U.rate, 68100);
s.check('최저기초일액 (8h × 10,320)', 8 * MIN_WAGE, 82560);
s.check('최저구직급여일액 66,048원', C.minDailyBenefit(8), 66048);
s.check('상·하한 차이 2,052원', U.maxBaseDaily * U.rate - C.minDailyBenefit(8), 2052);

s.section('소정급여일수 · 50세 미만 (별표1)');
s.check('1년 미만 120일', C.benefitDays(0.5, false), 120);
s.check('1년 경계 150일', C.benefitDays(1, false), 150);
s.check('1년 직전 120일', C.benefitDays(0.999, false), 120);
s.check('2년 150일', C.benefitDays(2, false), 150);
s.check('3년 경계 180일', C.benefitDays(3, false), 180);
s.check('5년 경계 210일', C.benefitDays(5, false), 210);
s.check('9년 210일', C.benefitDays(9, false), 210);
s.check('10년 경계 240일', C.benefitDays(10, false), 240);
s.check('20년 240일', C.benefitDays(20, false), 240);

s.section('소정급여일수 · 50세 이상·장애인');
s.check('1년 미만 120일', C.benefitDays(0.5, true), 120);
s.check('1년 180일', C.benefitDays(1, true), 180);
s.check('3년 210일', C.benefitDays(3, true), 210);
s.check('5년 240일', C.benefitDays(5, true), 240);
s.check('10년 270일', C.benefitDays(10, true), 270);
s.check('30년 270일', C.benefitDays(30, true), 270);

s.section('구직급여일액 = min(기초일액, 113,500) × 60%, 하한 미만이면 하한');
s.check('기초일액 15만 → 상한 68,100', C.dailyBenefit(150000, 8), 68100);
s.check('기초일액 113,500 → 68,100', C.dailyBenefit(113500, 8), 68100);
s.check('기초일액 12만 → 68,100', C.dailyBenefit(120000, 8), 68100);
s.check('기초일액 112,000 → 67,200 (60% 구간)', C.dailyBenefit(112000, 8), 67200);
s.check('기초일액 110,080 → 66,048 (하한 경계)', C.dailyBenefit(110080, 8), 66048, 0.01);
s.check('기초일액 10만 → 하한 66,048', C.dailyBenefit(100000, 8), 66048);

s.section('단시간 근로자 — 1일 소정근로시간이 하한을 낮춘다');
s.check('4시간 하한', C.minDailyBenefit(4), 4 * MIN_WAGE * 0.8);
s.check('8시간 초과 입력 → 8시간 제한', C.minDailyBenefit(12), C.minDailyBenefit(8));
s.check('미입력 → 8시간 기본', C.minDailyBenefit(0), C.minDailyBenefit(8));

s.section('종합 (월 300만 / 3년 / 50세 미만)');
const r = C.unemploymentBenefit({ baseDaily: 9000000 / 92, dailyHours: 8, insuredYears: 3, isOver50: false });
s.check('일액 하한 적용', Math.round(r.daily), 66048);
s.check('소정급여일수 180일', r.days, 180);
s.check('총 수급액', Math.round(r.total), 66048 * 180);
s.check('하한 적용 표시', r.atMin ? 1 : 0, 1);
s.check('상한 미적용', r.atMax ? 1 : 0, 0);

s.section('종합 (기초일액 20만 / 10년 / 50세 이상)');
const r2 = C.unemploymentBenefit({ baseDaily: 200000, dailyHours: 8, insuredYears: 10, isOver50: true });
s.check('일액 상한 68,100', r2.daily, 68100);
s.check('소정급여일수 270일', r2.days, 270);
s.check('총액', r2.total, 68100 * 270);
s.check('상한 적용 표시', r2.atMax ? 1 : 0, 1);

s.section('기초일액은 근로기준법상 평균임금 (제45조 제1항)');
const avg = C.averageDailyWage({ wage3Months: 9000000, annualBonus: 6000000, annualLeavePay: 1200000, periodDays: 92 });
s.check('상여·연차 3/12 산입 → 117,391원', Math.round(avg), 117391);
s.check('미산입 시 97,826원', Math.round(C.averageDailyWage({ wage3Months: 9000000, periodDays: 92 })), 97826);
const withB = C.unemploymentBenefit({ baseDaily: avg, dailyHours: 8, insuredYears: 3 });
const without = C.unemploymentBenefit({ baseDaily: 9000000 / 92, dailyHours: 8, insuredYears: 3 });
s.check('산입 시 상한액 적용', withB.daily, 68100);
s.check('미산입 시 하한액', Math.round(without.daily), 66048);
s.check('총액 차이 369,360원', Math.round(withB.total - without.total), 369360);

s.section('방어');
s.check('기초일액 0', C.unemploymentBenefit({ baseDaily: 0, dailyHours: 8, insuredYears: 3 }).total, 0);
s.check('기초일액 음수', C.dailyBenefit(-5000, 8), 0);
s.check('기초일액 NaN', C.dailyBenefit(NaN, 8), 0);
s.check('피보험기간 0 → 120일', C.benefitDays(0, false), 120);
s.check('피보험기간 음수 → 120일', C.benefitDays(-5, false), 120);
s.check('피보험기간 NaN → 120일', C.benefitDays(NaN, false), 120);

module.exports = s.done();

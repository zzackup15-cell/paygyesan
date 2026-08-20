'use strict';

/* 연차유급휴가 — 발생일수와 미사용수당 (근로기준법 제60조) */

const { loadCalc, createSuite } = require('./_assert');
const C = loadCalc();
const s = createSuite('연차수당');

const D = x => C.parseDate(x);
const at = (hire, base) => C.annualLeaveDays(D(hire), D(base));

s.section('경과 개월수');
s.check('01-01 ~ 02-01 = 1개월', C.monthsBetween(D('2025-01-01'), D('2025-02-01')), 1);
s.check('01-01 ~ 01-31 = 0개월 (미달)', C.monthsBetween(D('2025-01-01'), D('2025-01-31')), 0);
s.check('01-31 ~ 02-28 = 0개월 (일자 미달)', C.monthsBetween(D('2025-01-31'), D('2025-02-28')), 0);
s.check('01-01 ~ 이듬해 01-01 = 12개월', C.monthsBetween(D('2025-01-01'), D('2026-01-01')), 12);
s.check('역전 시 0', C.monthsBetween(D('2026-01-01'), D('2025-01-01')), 0);

s.section('1년 미만 — 1개월 개근당 1일 (최대 11일)');
s.check('입사 당일 0일', at('2025-01-01', '2025-01-01').currentDays, 0);
s.check('1개월 → 1일', at('2025-01-01', '2025-02-01').currentDays, 1);
s.check('6개월 → 6일', at('2025-01-01', '2025-07-01').currentDays, 6);
s.check('11개월 → 11일', at('2025-01-01', '2025-12-01').currentDays, 11);
s.check('11개월 시점 isFirstYear', at('2025-01-01', '2025-12-01').isFirstYear ? 1 : 0, 1);

s.section('1년 이상 — 15일 + 매 2년마다 1일 (한도 25일)');
const y = n => at('2000-01-01', (2000 + n) + '-01-01').currentDays;
s.check('1년차 15일', y(1), 15);
s.check('2년차 15일', y(2), 15);
s.check('3년차 16일', y(3), 16);
s.check('4년차 16일', y(4), 16);
s.check('5년차 17일', y(5), 17);
s.check('10년차 19일', y(10), 19);
s.check('20년차 24일', y(20), 24);
s.check('21년차 25일 (상한 도달)', y(21), 25);
s.check('30년차 25일 (상한 유지)', y(30), 25);
s.check('40년차 25일', y(40), 25);

s.section('1년 미만분과 1년차분은 별개');
const r = at('2024-01-01', '2025-06-01');
s.check('1년 경과 후 firstYearDays = 11', r.firstYearDays, 11);
s.check('1년 경과 후 annualDays = 15', r.annualDays, 15);
s.check('6개월 시점 firstYearDays = 6', at('2025-01-01', '2025-07-01').firstYearDays, 6);

s.section('연차수당 = 1일 통상임금 × 미사용 일수 (평균임금 아님)');
const daily = C.hourlyOrdinaryWage(3000000, 209) * 8;
s.check('1일 통상임금 114,833원', Math.round(daily), 114833);
s.check('미사용 15일 → 1,722,488원', Math.round(C.annualLeavePay(daily, 15)), 1722488);
s.check('미사용 0일', C.annualLeavePay(daily, 0), 0);
s.check('반차 0.5일', Math.round(C.annualLeavePay(daily, 0.5)), Math.round(daily * 0.5));
s.check('상한 25일로 제한', C.annualLeavePay(daily, 99), C.annualLeavePay(daily, 25));

s.section('방어');
s.check('통상임금 0', C.annualLeavePay(0, 15), 0);
s.check('통상임금 음수', C.annualLeavePay(-1000, 15), 0);
s.check('통상임금 NaN', C.annualLeavePay(NaN, 15), 0);
s.check('일수 음수 → 절댓값', C.annualLeavePay(daily, -5), C.annualLeavePay(daily, 5));
s.check('일수 문자', C.annualLeavePay(daily, 'abc'), 0);
s.check('날짜 없음', C.annualLeaveDays(null, null).currentDays, 0);
s.check('입사일이 미래', at('2027-01-01', '2026-01-01').currentDays, 0);

module.exports = s.done();

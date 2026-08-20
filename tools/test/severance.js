'use strict';

/* 퇴직금 — 날짜 계산, 평균임금, 통상임금 대체 (근로자퇴직급여 보장법 제8조) */

const { loadCalc, createSuite } = require('./_assert');
const C = loadCalc();
const s = createSuite('퇴직금');

const D = x => C.parseDate(x);
const iso = d => (d ? d.toISOString().slice(0, 10) : null);

s.section('날짜 파싱');
s.check('정상', iso(D('2026-08-03')), '2026-08-03');
s.check('한 자리 월일 허용', iso(D('2026-8-3')), '2026-08-03');
s.check('2월 30일 거부', D('2026-02-30'), null);
s.check('윤년 2월 29일 허용', iso(D('2024-02-29')), '2024-02-29');
s.check('평년 2월 29일 거부', D('2026-02-29'), null);
s.check('13월 거부', D('2026-13-01'), null);
s.check('빈 값', D(''), null);
s.check('문자', D('abc'), null);

s.section('3개월 전 (말일 보정)');
s.check('08-03 → 05-03', iso(C.minusMonths(D('2026-08-03'), 3)), '2026-05-03');
s.check('05-31 → 02-28 (말일 보정)', iso(C.minusMonths(D('2026-05-31'), 3)), '2026-02-28');
s.check('05-31 → 02-29 (윤년)', iso(C.minusMonths(D('2024-05-31'), 3)), '2024-02-29');
s.check('01-15 → 전년 10-15', iso(C.minusMonths(D('2026-01-15'), 3)), '2025-10-15');

s.section('재직일수');
s.check('2025-08-03 ~ 2026-08-02 = 365일', C.serviceDays(D('2025-08-03'), D('2026-08-02')), 365);
s.check('같은 날 입·퇴사 = 1일', C.serviceDays(D('2026-08-03'), D('2026-08-03')), 1);
s.check('퇴사일이 입사일보다 앞 = 0', C.serviceDays(D('2026-08-03'), D('2026-08-01')), 0);
s.check('3년 (윤년 포함) = 1,096일', C.serviceDays(D('2023-01-01'), D('2025-12-31')), 1096);

s.section('평균임금 (상여·연차 3/12 산입)');
const avg = C.averageDailyWage({ wage3Months: 9000000, annualBonus: 6000000, annualLeavePay: 1200000, periodDays: 92 });
s.check('(900만 + 150만 + 30만) ÷ 92', Math.round(avg), Math.round((9000000 + 1500000 + 300000) / 92));
s.check('117,391원', Math.round(avg), 117391);
s.check('상여·연차 없으면', Math.round(C.averageDailyWage({ wage3Months: 9000000, periodDays: 92 })), Math.round(9000000 / 92));
s.check('기간 0일 방어', C.averageDailyWage({ wage3Months: 9000000, periodDays: 0 }), 0);
s.check('음수 임금 방어', C.averageDailyWage({ wage3Months: -100, periodDays: 92 }), 0);

s.section('퇴직금 = 평균임금 × 30 × (재직일수 ÷ 365)');
s.check('10만원 · 1,096일 = 9,008,219원', Math.round(C.severance(100000, 0, 1096).amount), 9008219);
s.check('정확히 1년 = 30일분', Math.round(C.severance(100000, 0, 365).amount), 3000000);
s.check('2년 = 60일분', Math.round(C.severance(100000, 0, 730).amount), 6000000);
s.check('364일은 0원 (1년 미만)', C.severance(100000, 0, 364).amount, 0);
s.check('365일 경계에서 발생', C.severance(100000, 0, 365).amount > 0 ? 1 : 0, 1);

s.section('평균임금 < 통상임금이면 통상임금 (근로기준법 제2조 제2항)');
const r = C.severance(90000, 120000, 730);
s.check('큰 쪽 적용', r.base, 120000);
s.check('대체 여부 표시', r.usedOrdinary ? 1 : 0, 1);
s.check('금액도 통상일급 기준', Math.round(r.amount), Math.round(120000 * 30 * 730 / 365));
const r2 = C.severance(150000, 120000, 730);
s.check('평균임금이 크면 그대로', r2.base, 150000);
s.check('대체 아님', r2.usedOrdinary ? 1 : 0, 0);

s.section('방어');
s.check('임금 0', C.severance(0, 0, 730).amount, 0);
s.check('임금 음수', C.severance(-5000, 0, 730).amount, 0);
s.check('임금 NaN', C.severance(NaN, 0, 730).amount, 0);
s.check('재직일수 0', C.severance(100000, 0, 0).amount, 0);
s.check('재직일수 NaN', C.severance(100000, 0, NaN).amount, 0);

module.exports = s.done();

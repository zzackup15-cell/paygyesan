'use strict';

/* 육아휴직 급여 — 구간별 지급률·상한, 하한 70만원, 6+6 부모육아휴직제 */

const { loadCalc, createSuite } = require('./_assert');
const C = loadCalc();
const s = createSuite('육아휴직');

const amt = (m, w, plus) => C.parentalLeaveMonth(m, w, plus).amount;
const cap = (m, plus) => C.parentalLeaveMonth(m, 99999999, plus).cap;

s.section('기준값');
s.check('하한액 70만원', C.PARENTAL.floor, 700000);
s.check('최대 18개월', C.PARENTAL.maxMonths, 18);

s.section('구간별 상한 (경계 확인)');
s.check('1개월차 250만', cap(1, false), 2500000);
s.check('3개월차 250만', cap(3, false), 2500000);
s.check('4개월차 200만', cap(4, false), 2000000);
s.check('6개월차 200만', cap(6, false), 2000000);
s.check('7개월차 160만', cap(7, false), 1600000);
s.check('18개월차 160만', cap(18, false), 1600000);

s.section('통상임금 400만 (상한에 걸리는 고소득)');
s.check('1개월차 250만', amt(1, 4000000, false), 2500000);
s.check('4개월차 200만', amt(4, 4000000, false), 2000000);
s.check('7개월차 160만', amt(7, 4000000, false), 1600000);

s.section('통상임금 180만 (상한 미달, 지급률 적용)');
s.check('1개월차 100% → 180만', amt(1, 1800000, false), 1800000);
s.check('4개월차 100% → 180만', amt(4, 1800000, false), 1800000);
s.check('7개월차 80% → 144만', amt(7, 1800000, false), 1440000);

s.section('7개월차 지급률과 상한이 교차하는 지점');
s.check('210만 × 80% = 168만 → 상한 160만', amt(7, 2100000, false), 1600000);
s.check('195만 × 80% = 156만 → 그대로', amt(7, 1950000, false), 1560000);

s.section('하한액 70만원');
s.check('통상임금 60만 → 70만', amt(1, 600000, false), 700000);
s.check('통상임금 80만 7개월차 (80%=64만) → 70만', amt(7, 800000, false), 700000);
s.check('통상임금 90만 7개월차 (80%=72만) → 72만', amt(7, 900000, false), 720000);

s.section('6+6 부모육아휴직제 (첫 6개월 상한 상향)');
s.check('1개월차 250만', amt(1, 5000000, true), 2500000);
s.check('2개월차 250만', amt(2, 5000000, true), 2500000);
s.check('3개월차 300만', amt(3, 5000000, true), 3000000);
s.check('4개월차 350만', amt(4, 5000000, true), 3500000);
s.check('5개월차 400만', amt(5, 5000000, true), 4000000);
s.check('6개월차 450만', amt(6, 5000000, true), 4500000);
s.check('7개월차부터 일반 기준 160만', amt(7, 5000000, true), 1600000);

s.section('합계');
const r = C.parentalLeave(4000000, 12, false);
s.check('통상임금 400만 · 12개월 = 23,100,000원', r.total, 23100000);
s.check('250만×3 + 200만×3 + 160만×6 검산', r.total, 2500000 * 3 + 2000000 * 3 + 1600000 * 6);
s.check('행 개수 12', r.rows.length, 12);
s.check('6+6 · 500만 · 6개월 = 20,000,000원', C.parentalLeave(5000000, 6, true).total, 20000000);
s.check('18개월 총액', C.parentalLeave(4000000, 18, false).total, 2500000 * 3 + 2000000 * 3 + 1600000 * 12);

s.section('방어');
s.check('개월 0', C.parentalLeave(4000000, 0, false).total, 0);
s.check('개월 음수 → 절댓값(toHours 규칙)', C.parentalLeave(4000000, -5, false).months, 5);
s.check('개월 상한 초과 → 18로 제한', C.parentalLeave(4000000, 99, false).months, 18);
s.check('개월 문자', C.parentalLeave(4000000, 'abc', false).total, 0);
s.check('통상임금 0 → 하한 70만', amt(1, 0, false), 700000);
s.check('통상임금 음수 → 하한 70만', amt(1, -100000, false), 700000);
s.check('개월차 0', C.parentalLeaveMonth(0, 4000000, false).amount, 0);
s.check('개월차 NaN', C.parentalLeaveMonth(NaN, 4000000, false).amount, 0);

module.exports = s.done();

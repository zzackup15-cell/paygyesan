'use strict';

/* 주택임대소득 (월세).
 *
 * 이 계산기의 첫 번째 답은 금액이 아니라 '과세 대상인가' 다.
 * 1주택이고 기준시가 12억원 이하면 월세는 비과세이고 신고 의무도 없다.
 * 본인이 월세로 사는지는 따지지 않는다. 이걸 몰라 불안해하는 사람이 많다.
 *
 * 두 번째 답은 '분리과세와 종합과세 중 어느 쪽이 유리한가' 다.
 * 분리과세는 필요경비 50%(등록 60%)와 기본공제를 주지만 세율이 14% 로 고정이라,
 * 한계세율 6% 구간에서는 종합과세가 이긴다. 그 역전이 실제로 잡히는지 확인한다.
 */

const { loadCalc, createSuite } = require('./_assert');
const C = loadCalc();
const s = createSuite('주택임대소득');

const R = C.RENTAL;

s.section('적용 수치 (소득세법·시행령)');
s.check('고가주택 기준시가 12억', R.highValue, 1200000000);
s.check('간주임대료 보증금 공제 3억', R.deemedFrom, 300000000);
s.check('보증금 초과분 60%', R.deemedPct, 60);
s.check('정기예금이자율 3.1% (2025~2026 귀속)', R.depositRatePct, 31);
s.check('분리과세 한도 2,000만원', R.separateLimit, 20000000);
s.check('분리과세 세율 14%', R.separateTaxPct, 14);
s.check('필요경비율 50%', R.expensePct, 50);
s.check('등록임대주택 60%', R.expensePctRegistered, 60);
s.check('기본공제 200만원', R.deduction, 2000000);
s.check('등록임대주택 400만원', R.deductionRegistered, 4000000);

s.section('★ 과세 판정 — 본인이 세입자인지는 따지지 않는다');
s.ok('1주택 · 12억 이하 → 비과세', C.rentalTaxable(1, false).taxable === false);
s.check('그 사유', C.rentalTaxable(1, false).reason, 'oneHouse');
s.ok('1주택 · 12억 초과 → 과세', C.rentalTaxable(1, true).taxable === true);
s.check('그 사유', C.rentalTaxable(1, true).reason, 'highValue');
s.ok('2주택 → 과세', C.rentalTaxable(2, false).taxable === true);
s.ok('3주택 → 과세', C.rentalTaxable(3, false).taxable === true);
s.check('3주택 사유는 간주임대료까지', C.rentalTaxable(3, false).reason, 'multi');
s.ok('무주택 → 대상 아님', C.rentalTaxable(0, false).taxable === false);
// 고가주택 여부는 1주택에서만 의미가 있다
s.ok('2주택은 고가 여부와 무관하게 과세', C.rentalTaxable(2, true).taxable === true);

s.section('비과세면 금액이 전부 0 이어야 한다');
const free = C.rentalIncomeTax({ houses: 1, monthlyRent: 3000000, annualSalary: 50000000 });
s.ok('과세 대상 아님', free.taxable === false);
s.check('총수입 0', free.revenue, 0);
s.check('세금 0', free.tax, 0);
s.check('분리과세 세액 0', free.separateTax, 0);
s.check('종합과세 세액 0', free.comprehensiveTax, 0);
s.ok('분리과세 선택 대상도 아님', free.canSeparate === false);

s.section('간주임대료 — 3주택 이상, 보증금 3억 초과분');
s.check('1주택은 0', C.deemedRent(1000000000, 1), 0);
s.check('2주택도 0', C.deemedRent(1000000000, 2), 0);
s.check('3주택 · 보증금 3억 이하면 0', C.deemedRent(300000000, 3), 0);
s.check('3주택 · 보증금 3억 초과 1원', C.deemedRent(300000001, 3), 0);
// 기댓값은 정수 연산으로. (5억-3억) × 60% × 3.1%
s.check('3주택 · 보증금 5억', C.deemedRent(500000000, 3),
  Math.floor(200000000 * 60 / 100 * 31 / 1000));
s.check('그 값은 372만원', C.deemedRent(500000000, 3), 3720000);
s.check('3주택 · 보증금 10억', C.deemedRent(1000000000, 3),
  Math.floor(700000000 * 60 / 100 * 31 / 1000));
s.check('4주택도 같은 산식', C.deemedRent(500000000, 4), 3720000);
s.check('보증금 음수', C.deemedRent(-500000000, 3), 0);

s.section('총수입 = 연 월세 + 간주임대료');
const multi = C.rentalIncomeTax({ houses: 3, monthlyRent: 1500000, deposit: 500000000, annualSalary: 60000000 });
s.check('연 월세', multi.yearlyRent, 18000000);
s.check('간주임대료', multi.deemedRent, 3720000);
s.check('총수입', multi.revenue, 18000000 + 3720000);
s.ok('2,000만원 초과라 분리과세 불가', multi.canSeparate === false);
s.ok('그래서 종합과세로 계산', multi.betterIsSeparate === false);
s.check('세금 = 종합과세 세액', multi.tax, multi.comprehensiveTax);
// 2주택이면 같은 보증금이라도 간주임대료가 붙지 않는다
const two = C.rentalIncomeTax({ houses: 2, monthlyRent: 1500000, deposit: 500000000, annualSalary: 60000000 });
s.check('2주택은 보증금 무시', two.deemedRent, 0);
s.check('총수입은 월세만', two.revenue, 18000000);

s.section('필요경비와 기본공제');
const base = { houses: 2, monthlyRent: 1000000, annualSalary: 50000000 };
const plain = C.rentalIncomeTax(base);
s.check('총수입 1,200만', plain.revenue, 12000000);
s.check('필요경비 50%', plain.expense, 6000000);
s.check('연봉 5,000만 → 기본공제 없음', plain.deduction, 0);
const reg = C.rentalIncomeTax(Object.assign({}, base, { registered: true }));
s.check('등록임대주택 필요경비 60%', reg.expense, 7200000);
s.ok('등록 쪽 세금이 더 적다', reg.separateTax < plain.separateTax);
// 기본공제는 임대소득 뺀 종합소득금액이 2,000만원 이하일 때만
const low = C.rentalIncomeTax(Object.assign({}, base, { annualSalary: 20000000 }));
s.ok('종합소득금액이 2,000만 이하', low.otherIncome <= R.deductionIncomeLimit);
s.check('기본공제 200만원', low.deduction, 2000000);
const lowReg = C.rentalIncomeTax(Object.assign({}, base, { annualSalary: 20000000, registered: true }));
s.check('등록이면 400만원', lowReg.deduction, 4000000);
// 연봉이 높아 종합소득금액이 2,000만원을 넘으면 공제가 사라진다
s.ok('고연봉은 공제 소멸', C.rentalIncomeTax(Object.assign({}, base, { annualSalary: 80000000 })).deduction === 0);

s.section('분리과세 세액 = 과세표준 × 14% + 지방소득세 10%');
s.check('과세표준', low.separateBase, 12000000 - 6000000 - 2000000);
const sepIncome = Math.floor(low.separateBase * 14 / 100);
s.check('분리과세 세액', low.separateTax, sepIncome + Math.floor(sepIncome * 10 / 100));
s.check('그 값은 616,000원', low.separateTax, 616000);
// 공제가 수입을 넘으면 과세표준 0
const tiny = C.rentalIncomeTax({ houses: 2, monthlyRent: 100000, annualSalary: 10000000 });
s.check('과세표준 0', tiny.separateBase, 0);
s.check('분리과세 세액 0', tiny.separateTax, 0);

s.section('★ 분리과세가 항상 유리하지는 않다');
// 한계세율 6% 구간이면 14% 고정세율보다 종합과세가 싸다
s.ok('저연봉은 종합과세가 유리', low.betterIsSeparate === false);
s.ok('그때 세금은 종합과세 쪽', low.tax === low.comprehensiveTax);
s.ok('실제로 종합과세가 더 싸다', low.comprehensiveTax < low.separateTax);
// 한계세율이 15% 이상이면 분리과세가 이긴다
s.ok('연봉 5,000만은 분리과세 유리', plain.betterIsSeparate === true);
s.ok('그때 세금은 분리과세 쪽', plain.tax === plain.separateTax);
s.ok('둘 중 작은 값을 고른다', plain.tax === Math.min(plain.separateTax, plain.comprehensiveTax));

s.section('분리과세 선택 한도 2,000만원');
s.ok('정확히 2,000만원은 선택 가능',
  C.rentalIncomeTax({ houses: 2, monthlyRent: 20000000 / 12, annualSalary: 50000000 }).revenue <= R.separateLimit);
const at = C.rentalIncomeTax({ houses: 2, monthlyRent: 1666666, annualSalary: 50000000 });
s.ok('1,999만원대는 선택 가능', at.canSeparate === true);
const over = C.rentalIncomeTax({ houses: 2, monthlyRent: 1700000, annualSalary: 50000000 });
s.check('2,040만원 총수입', over.revenue, 20400000);
s.ok('2,000만원 초과는 선택 불가', over.canSeparate === false);
s.ok('초과하면 무조건 종합과세', over.betterIsSeparate === false);

s.section('실수령');
s.check('실수령 = 총수입 - 세금', plain.netIncome, plain.revenue - plain.tax);
s.check('비과세면 총수입 그대로', free.netIncome, free.revenue);
s.ok('세금이 총수입을 넘지 않는다', plain.tax < plain.revenue);

s.section('입력 방어 — 어떤 값을 넣어도 유한하고 음수가 아니다');
const junk = [
  {},
  { houses: -3, monthlyRent: -1000000, deposit: -5 },
  { houses: NaN, monthlyRent: NaN, annualSalary: NaN },
  { houses: Infinity, monthlyRent: Infinity, deposit: Infinity },
  { houses: 3, monthlyRent: 1e308, deposit: 1e308, annualSalary: 1e308 },
  { houses: '3', monthlyRent: '1,500,000', deposit: '500,000,000', annualSalary: '60,000,000' },
  { houses: 999, monthlyRent: 1000000 },
  { houses: 2, monthlyRent: 1000000, family: -5 },
  { houses: 1, isHighValue: true, monthlyRent: 0 }
];
for (let i = 0; i < junk.length; i++) {
  const r = C.rentalIncomeTax(junk[i]);
  s.ok('입력 ' + (i + 1) + ' 유한·비음수',
    isFinite(r.tax) && r.tax >= 0 &&
    isFinite(r.revenue) && r.revenue >= 0 &&
    isFinite(r.separateTax) && r.separateTax >= 0 &&
    isFinite(r.comprehensiveTax) && r.comprehensiveTax >= 0 &&
    isFinite(r.netIncome));
}
s.check('콤마 문자열 파싱',
  C.rentalIncomeTax({ houses: '3', monthlyRent: '1,500,000', deposit: '500,000,000' }).deemedRent, 3720000);
s.check('주택 수 상한 100', C.rentalIncomeTax({ houses: 999, monthlyRent: 1000000 }).houses, 100);

s.section('결과는 원 단위 정수');
for (const rent of [333333, 1234567, 2777777]) {
  const r = C.rentalIncomeTax({ houses: 3, monthlyRent: rent, deposit: 777777777, annualSalary: 55555555 });
  s.ok(rent.toLocaleString() + ' 정수',
    Number.isInteger(r.tax) && Number.isInteger(r.revenue) &&
    Number.isInteger(r.deemedRent) && Number.isInteger(r.expense));
}

module.exports = s.done();

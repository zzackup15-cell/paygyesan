'use strict';

/* 월급 외 추가 수익의 세금 (종합소득세).
 *
 * 이 계산기의 주장은 하나다. 추가 수익의 세금은 금액이 아니라
 * '기존 연봉'으로 정해진다. 종합소득세가 누진세라 부수입이 연봉 위에
 * 얹혀 한계세율을 맞기 때문이다. 그 주장이 실제로 성립하는지를 검증한다.
 *
 * 세율표는 소득세법 제55조를 그대로 옮긴 것이라 국세청 고시표와 한 자리도
 * 달라선 안 된다. 아래에서 8개 구간의 경계값을 전부 대조하고, 경계에서
 * 세액이 튀지 않는지(누진공제가 맞는지) 연속성으로 확인한다.
 */

const { loadCalc, createSuite } = require('./_assert');
const C = loadCalc();
const s = createSuite('추가수익 세금');

s.section('종합소득세율 — 국세청 세율표 8구간');
const table = [
  [14000000, 6, 0],
  [50000000, 15, 1260000],
  [88000000, 24, 5760000],
  [150000000, 35, 15440000],
  [300000000, 38, 19940000],
  [500000000, 40, 25940000],
  [1000000000, 42, 35940000],
  [2000000000, 45, 65940000]
];
for (const [base, pct, deduct] of table) {
  s.check('과표 ' + base.toLocaleString() + ' 한계세율', C.marginalPct(base), pct);
  // 기댓값은 정수 연산으로 만든다
  s.check('과표 ' + base.toLocaleString() + ' 산출세액',
    C.comprehensiveTax(base), Math.floor(base * pct / 100) - deduct);
}

s.section('누진공제가 맞으면 구간 경계에서 세액이 튀지 않는다');
for (const [boundary] of table.slice(0, 7)) {
  const below = C.comprehensiveTax(boundary);
  const above = C.comprehensiveTax(boundary + 1);
  s.ok('경계 ' + boundary.toLocaleString() + ' 연속', above >= below && above - below <= 1);
}

s.section('세율표 상수 자체');
s.check('구간 수', C.TAX_BRACKETS.length, 8);
s.check('최저세율', C.TAX_BRACKETS[0].pct, 6);
s.check('최고세율', C.TAX_BRACKETS[7].pct, 45);
s.check('1,400만 이하 누진공제 없음', C.TAX_BRACKETS[0].deduct, 0);
s.check('과표 0', C.comprehensiveTax(0), 0);
s.check('과표 음수', C.comprehensiveTax(-5000000), 0);
s.check('과표 1원', C.comprehensiveTax(1), 0);

s.section('근로소득공제 (소득세법 제47조)');
s.check('500만 → 70%', C.earnedIncomeDeduction(5000000), 3500000);
s.check('1,000만', C.earnedIncomeDeduction(10000000), 3500000 + Math.floor(5000000 * 40 / 100));
s.check('1,500만', C.earnedIncomeDeduction(15000000), 7500000);
s.check('3,000만', C.earnedIncomeDeduction(30000000), 7500000 + Math.floor(15000000 * 15 / 100));
s.check('4,500만', C.earnedIncomeDeduction(45000000), 12000000);
s.check('7,000만', C.earnedIncomeDeduction(70000000), 12000000 + Math.floor(25000000 * 5 / 100));
s.check('1억', C.earnedIncomeDeduction(100000000), 14750000);
s.check('2억', C.earnedIncomeDeduction(200000000), 14750000 + Math.floor(100000000 * 2 / 100));
s.check('한도 2,000만원', C.earnedIncomeDeduction(100000000000), 20000000);
s.check('0원', C.earnedIncomeDeduction(0), 0);

s.section('★ 핵심 — 같은 부수입도 연봉이 높으면 세금이 많다');
const salaries = [30000000, 50000000, 80000000, 120000000, 200000000];
let prevTax = -1;
let prevMarginal = 0;
for (const salary of salaries) {
  const r = C.sideIncomeTax({ annualSalary: salary, sideRevenue: 5000000, type: 'business' });
  s.ok('연봉 ' + salary / 10000 + '만 → 세금이 앞 구간보다 크거나 같다', r.addedTax >= prevTax);
  s.ok('연봉 ' + salary / 10000 + '만 → 한계세율이 낮아지지 않는다', r.marginalPct >= prevMarginal);
  prevTax = r.addedTax;
  prevMarginal = r.marginalPct;
}
// 저연봉과 고연봉의 차이가 실제로 벌어지는지
const low = C.sideIncomeTax({ annualSalary: 30000000, sideRevenue: 5000000, type: 'business' });
const high = C.sideIncomeTax({ annualSalary: 200000000, sideRevenue: 5000000, type: 'business' });
s.ok('고연봉이 저연봉보다 2배 넘게 낸다', high.addedTax > low.addedTax * 2);
s.check('저연봉 한계세율', low.marginalPct, 15);
s.check('고연봉 한계세율', high.marginalPct, 38);

s.section('추가 세금 = 두 과세표준의 세액 차이');
const mid = C.sideIncomeTax({ annualSalary: 60000000, sideRevenue: 10000000, type: 'business' });
s.check('과세표준이 소득금액만큼 늘어난다', mid.baseAfter - mid.baseBefore, mid.incomeAmount);
s.check('소득세 = 세액 차이',
  mid.incomeTax, C.comprehensiveTax(mid.baseAfter) - C.comprehensiveTax(mid.baseBefore));
s.check('지방소득세 = 소득세 × 10%', mid.localTax, Math.floor(mid.incomeTax * 10 / 100));
s.check('추가 세금 = 소득세 + 지방소득세', mid.addedTax, mid.incomeTax + mid.localTax);

s.section('기타소득 — 필요경비 60% 의제, 원천징수 8.8%');
const other = C.sideIncomeTax({ annualSalary: 50000000, sideRevenue: 10000000, type: 'other' });
s.check('필요경비 60%', other.expense, 6000000);
s.check('소득금액 40%', other.incomeAmount, 4000000);
s.check('원천징수 8.8%', other.withheld, Math.floor(10000000 * 88 / 1000));
s.check('원천징수액', other.withheld, 880000);
s.check('유형 표기', other.type, 'other');

s.section('사업소득 — 실제 경비, 원천징수 3.3%');
const biz = C.sideIncomeTax({ annualSalary: 50000000, sideRevenue: 10000000, sideExpense: 3000000, type: 'business' });
s.check('경비 그대로', biz.expense, 3000000);
s.check('소득금액', biz.incomeAmount, 7000000);
s.check('원천징수 3.3%', biz.withheld, Math.floor(10000000 * 33 / 1000));
s.check('원천징수액', biz.withheld, 330000);
s.check('경비 미입력이면 0', C.sideIncomeTax({ annualSalary: 50000000, sideRevenue: 10000000, type: 'business' }).expense, 0);
s.check('경비가 수입보다 크면 수입까지만',
  C.sideIncomeTax({ annualSalary: 50000000, sideRevenue: 5000000, sideExpense: 90000000, type: 'business' }).incomeAmount, 0);

s.section('같은 수입이면 기타소득이 사업소득보다 유리하다 (경비 없을 때)');
const sameOther = C.sideIncomeTax({ annualSalary: 50000000, sideRevenue: 8000000, type: 'other' });
const sameBiz = C.sideIncomeTax({ annualSalary: 50000000, sideRevenue: 8000000, type: 'business' });
s.ok('기타소득 소득금액이 더 작다', sameOther.incomeAmount < sameBiz.incomeAmount);
s.ok('기타소득 세금이 더 적다', sameOther.addedTax < sameBiz.addedTax);

s.section('원천징수는 정산이 아니다 — 5월에 더 내는 경우');
// 3.3% 만 떼는데 한계세율이 15% 이상이면 반드시 추가 납부가 생긴다
for (const salary of [40000000, 60000000, 90000000]) {
  const r = C.sideIncomeTax({ annualSalary: salary, sideRevenue: 6000000, type: 'business' });
  s.ok('연봉 ' + salary / 10000 + '만 → 추가 납부 발생', r.settlement > 0);
  s.check('정산 = 추가세금 - 원천징수', r.settlement, r.addedTax - r.withheld);
}
// 반대 방향도 있어야 한다. 기타소득은 8.8% 를 떼는데 필요경비 60% 를 빼고 나면
// 한계세율 6% 구간에서는 세금이 원천징수보다 적어 5월에 돌려받는다.
const refund = C.sideIncomeTax({ annualSalary: 20000000, sideRevenue: 10000000, type: 'other' });
s.check('저연봉 + 기타소득 한계세율', refund.marginalPct, 6);
s.ok('원천징수가 세금보다 많다', refund.withheld > refund.addedTax);
s.ok('환급 방향', refund.settlement < 0);

s.section('기타소득금액 300만원 이하 분리과세 선택');
// 지급액 750만원 → 소득금액 300만원 (경계)
s.ok('750만원(소득금액 300만) 분리과세 가능',
  C.sideIncomeTax({ annualSalary: 50000000, sideRevenue: 7500000, type: 'other' }).canSeparate);
s.check('그때 소득금액', C.sideIncomeTax({ annualSalary: 50000000, sideRevenue: 7500000, type: 'other' }).incomeAmount, 3000000);
s.ok('750만원 초과는 분리과세 불가',
  C.sideIncomeTax({ annualSalary: 50000000, sideRevenue: 7500010, type: 'other' }).canSeparate === false);
s.ok('사업소득은 금액과 무관하게 분리과세 불가',
  C.sideIncomeTax({ annualSalary: 50000000, sideRevenue: 1000000, type: 'business' }).canSeparate === false);
s.ok('수입 0이면 분리과세 대상 아님',
  C.sideIncomeTax({ annualSalary: 50000000, sideRevenue: 0, type: 'other' }).canSeparate === false);
s.check('분리과세 세액 = 원천징수액',
  C.sideIncomeTax({ annualSalary: 50000000, sideRevenue: 7500000, type: 'other' }).separateTax,
  Math.floor(7500000 * 88 / 1000));

s.section('건강보험 소득월액보험료 — 보수외소득 2,000만원 초과분');
const under = C.sideIncomeTax({ annualSalary: 50000000, sideRevenue: 20000000, type: 'business' });
s.check('정확히 2,000만원이면 부과 없음', under.healthMonthly, 0);
s.check('그때 연간 부담도 0', under.healthYear, 0);
const over = C.sideIncomeTax({ annualSalary: 50000000, sideRevenue: 32000000, type: 'business' });
s.ok('2,000만원 초과면 부과', over.healthMonthly > 0);
// 소득월액 = (3,200만 - 2,000만) / 12 = 100만. 요율은 노사 합계(본인 전액 부담)
const monthlyBase = (32000000 - 20000000) / 12;
s.check('건강보험료', over.healthMonthly,
  Math.floor(monthlyBase * C.RATES.health.rate * 2 / 10) * 10);
s.check('장기요양보험료', over.careMonthly,
  Math.floor(over.healthMonthly * C.RATES.care.ofHealth / 10) * 10);
s.check('연간 = (건보+장기요양) × 12', over.healthYear, (over.healthMonthly + over.careMonthly) * 12);
s.check('총 부담 = 세금 + 건보료', over.totalBurden, over.addedTax + over.healthYear);
// 기타소득은 필요경비 60% 를 빼고 나서 판정하므로 기준선이 훨씬 높다
s.check('기타소득은 소득금액 기준으로 판정',
  C.sideIncomeTax({ annualSalary: 50000000, sideRevenue: 50000000, type: 'other' }).incomeAmount, 20000000);
s.check('그래서 5,000만원 수입도 건보료 없음',
  C.sideIncomeTax({ annualSalary: 50000000, sideRevenue: 50000000, type: 'other' }).healthMonthly, 0);

s.section('실효세율과 실수령');
const eff = C.sideIncomeTax({ annualSalary: 60000000, sideRevenue: 10000000, type: 'business' });
s.check('실효세율 = 추가세금 / 소득금액', Math.round(eff.effectiveRate * 10000),
  Math.round(eff.addedTax / eff.incomeAmount * 10000));
s.check('실수령 = 수입 - 경비 - 세금 - 건보료',
  eff.netIncome, eff.revenue - eff.expense - eff.addedTax - eff.healthYear);
s.ok('실효세율이 한계세율보다 낮거나 같다', eff.effectiveRate <= eff.marginalPct / 100 * 1.1);
s.check('수입 0이면 실효세율 0', C.sideIncomeTax({ annualSalary: 50000000, sideRevenue: 0 }).effectiveRate, 0);

s.section('과세표준 추정 — 공제가 실제로 반영되는가');
const base50 = C.estimatedTaxBase(50000000, 1);
s.ok('과세표준 < 총급여', base50 < 50000000);
s.ok('근로소득공제만큼은 확실히 줄어든다', base50 <= 50000000 - C.earnedIncomeDeduction(50000000));
s.ok('인적공제도 빠진다', base50 <= 50000000 - C.earnedIncomeDeduction(50000000) - 1500000);
s.ok('부양가족이 늘면 과세표준이 준다', C.estimatedTaxBase(50000000, 4) < base50);
s.check('부양가족 1명당 150만원',
  base50 - C.estimatedTaxBase(50000000, 2), 1500000);
s.check('연봉 0', C.estimatedTaxBase(0, 1), 0);
// 연봉 1,200만원이면 공제를 다 빼도 과세표준이 300만원쯤 남는다.
// 세액공제 단계에서 실제 세금은 0 이 되지만 여기는 산출세액 이전이다.
s.ok('연봉 1,200만은 과세표준이 남는다', C.estimatedTaxBase(12000000, 1) > 0);
s.ok('그래도 총급여의 1/3 미만', C.estimatedTaxBase(12000000, 1) < 12000000 / 3);
s.check('연봉 500만은 공제가 급여를 넘어 0', C.estimatedTaxBase(5000000, 1), 0);

s.section('입력 방어 — 어떤 값을 넣어도 유한하고 음수가 아니다');
const junk = [
  {},
  { annualSalary: -5000000, sideRevenue: -1000000 },
  { annualSalary: NaN, sideRevenue: NaN, type: 'other' },
  { annualSalary: Infinity, sideRevenue: Infinity },
  { annualSalary: 1e308, sideRevenue: 1e308, type: 'other' },
  { annualSalary: '50,000,000', sideRevenue: '10,000,000', type: 'business' },
  { annualSalary: 50000000, sideRevenue: 10000000, sideExpense: -900, type: 'business' },
  { annualSalary: 50000000, sideRevenue: 10000000, family: -3 },
  { annualSalary: 50000000, sideRevenue: 10000000, family: 999 },
  { annualSalary: 50000000, sideRevenue: 10000000, type: '이상한값' },
  { annualSalary: 0, sideRevenue: 100000000000, type: 'other' }
];
for (let i = 0; i < junk.length; i++) {
  const r = C.sideIncomeTax(junk[i]);
  s.ok('입력 ' + (i + 1) + ' 유한·비음수',
    isFinite(r.addedTax) && r.addedTax >= 0 &&
    isFinite(r.withheld) && r.withheld >= 0 &&
    isFinite(r.incomeAmount) && r.incomeAmount >= 0 &&
    isFinite(r.healthYear) && r.healthYear >= 0 &&
    isFinite(r.settlement) && isFinite(r.netIncome));
}
s.check('콤마 문자열 파싱',
  C.sideIncomeTax({ annualSalary: '50,000,000', sideRevenue: '10,000,000', type: 'business' }).incomeAmount, 10000000);
s.check('알 수 없는 유형은 사업소득으로', C.sideIncomeTax({ sideRevenue: 1000000, type: 'zzz' }).type, 'business');

s.section('결과는 원 단위 정수');
for (const rev of [1234567, 7777777, 33333333]) {
  const r = C.sideIncomeTax({ annualSalary: 55555555, sideRevenue: rev, type: 'business' });
  s.ok(rev.toLocaleString() + ' 정수',
    Number.isInteger(r.addedTax) && Number.isInteger(r.withheld) &&
    Number.isInteger(r.incomeAmount) && Number.isInteger(r.healthYear));
}

module.exports = s.done();

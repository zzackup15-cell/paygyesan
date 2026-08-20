'use strict';

/* 국민연금 노령연금 예상 수령액.
 *
 * 이 파일의 중심에는 검증 하나가 있다.
 *
 *   평균소득자(B = A)가 40년 가입하면 소득대체율이 정확히 43% 여야 한다.
 *
 * '소득대체율 43%' 라는 말의 정의 자체가 그것이기 때문이다. 상수 1.29,
 * 20년 초과 가산 (1+0.05n/12), 20년 미만 지급률이 하나라도 틀리면 이 값이
 * 어긋난다. 실제로 20년 미만 지급률을 빠뜨렸을 때 10년 가입자와 20년
 * 가입자의 연금액이 같아지는 버그를 이 검증이 잡았다.
 *
 * 나아가 대체율은 가입연수에 정확히 비례해야 한다(43% × 연수/40).
 * 아래에서 10년부터 40년까지 전 구간을 그 이론값과 대조한다.
 */

const { loadCalc, createSuite } = require('./_assert');
const C = loadCalc();
const s = createSuite('국민연금');

const A = C.NPS.aValue;

// 가입기간을 연 단위로 지정해 계산 (전 기간 2026년 이후 = 상수 1.29 단일)
function pension(years, income, extra) {
  const opts = {
    birthYear: 2000,
    startYear: 2026, startMonth: 1,
    endYear: 2025 + years, endMonth: 12,
    monthlyIncome: income === undefined ? A : income
  };
  for (const k in (extra || {})) opts[k] = extra[k];
  return C.nationalPension(opts);
}

s.section('A값과 상수 — 고시값을 그대로 쓰는지');
s.check('2026년 A값', C.NPS.aValue, 3193511);
s.check('최소 가입기간 120개월', C.NPS.minMonths, 120);
s.check('1988~1998년 상수', C.npsConstant(1990), 2.4);
s.check('1998년 상수', C.npsConstant(1998), 2.4);
s.check('1999년 상수', C.npsConstant(1999), 1.8);
s.check('2007년 상수', C.npsConstant(2007), 1.8);
s.check('2008년 상수', C.npsConstant(2008), 1.5);
s.check('2009년 상수', C.npsConstant(2009), 1.485);
s.check('2015년 상수', C.npsConstant(2015), 1.395);
s.check('2025년 상수', C.npsConstant(2025), 1.245);
s.check('2026년 상수 (개혁 후 43% 고정)', C.npsConstant(2026), 1.29);
s.check('2040년도 1.29 유지', C.npsConstant(2040), 1.29);

// 상수는 소득대체율 × 3 이다. 정수 연산으로 기댓값을 만든다.
s.section('상수 = 소득대체율 × 3 (2008~2025년 매년 0.5%p 감소)');
for (let y = 2008; y <= 2025; y++) {
  s.check(y + '년', Math.round(C.npsConstant(y) * 1000), 1500 - 15 * (y - 2008));
}

s.section('1988~1998년 가입분만 B에 0.75');
s.check('1990년', C.npsIncomeWeight(1990), 0.75);
s.check('1998년', C.npsIncomeWeight(1998), 0.75);
s.check('1999년', C.npsIncomeWeight(1999), 1);
s.check('2026년', C.npsIncomeWeight(2026), 1);

s.section('★ 핵심 — 평균소득자 40년 가입은 소득대체율 43%');
const full = pension(40);
s.check('가입월수 480', full.months, 480);
s.check('소득대체율 43.00%', Math.round(full.replacementRate * 10000), 4300);

s.section('★ 핵심 — 대체율은 가입연수에 비례한다 (43% × 연수/40)');
for (const y of [10, 12, 15, 18, 20, 24, 25, 30, 33, 35, 40]) {
  const o = pension(y);
  // 이론값을 정수 연산으로 만든다: 43 × y / 40 (%)
  s.check(y + '년 → ' + (43 * y / 40).toFixed(2) + '%',
    Math.round(o.replacementRate * 10000), Math.round(4300 * y / 40));
}

s.section('20년 미만 지급률 — 10년 50%, 이후 1년마다 5%p');
s.check('10년 = 50%', Math.round(C.npsDurationRate(120) * 1000), 500);
s.check('11년 = 55%', Math.round(C.npsDurationRate(132) * 1000), 550);
s.check('15년 = 75%', Math.round(C.npsDurationRate(180) * 1000), 750);
s.check('19년 = 95%', Math.round(C.npsDurationRate(228) * 1000), 950);
s.check('20년 = 100%', C.npsDurationRate(240), 1);
s.check('30년도 100% (초과분은 기본연금액이 받는다)', C.npsDurationRate(360), 1);
s.check('10년 미만은 0', C.npsDurationRate(119), 0);
// 지급률을 빠뜨리면 10년과 20년 연금액이 같아진다. 그 회귀를 직접 막는다.
s.ok('10년 연금 < 20년 연금 (지급률 누락 회귀)', pension(10).monthly < pension(20).monthly);
s.check('20년은 10년의 정확히 2배', pension(20).monthly, pension(10).monthly * 2, 1);

s.section('20년 초과 가산 (1 + 0.05n/12)');
// 30년 = 20년 + 120개월 초과 → 기본연금액이 1.5배
s.check('30년 = 20년 × 1.5', pension(30).monthly, Math.floor(pension(20).monthly * 1.5), 2);
s.check('40년 = 20년 × 2.0', pension(40).monthly, pension(20).monthly * 2, 2);

s.section('최소 가입기간 10년');
s.ok('9년 11개월은 수급 불가', pension(10, A, { endYear: 2035, endMonth: 11 }).eligible === false);
s.check('9년 11개월 연금액 0', pension(10, A, { endYear: 2035, endMonth: 11 }).monthly, 0);
s.ok('정확히 10년은 수급 가능', pension(10).eligible === true);
s.ok('10년 연금액 > 0', pension(10).monthly > 0);

s.section('수급개시연령 (국민연금법 부칙)');
const ages = [[1950, 60], [1952, 60], [1953, 61], [1956, 61], [1957, 62], [1960, 62],
  [1961, 63], [1964, 63], [1965, 64], [1968, 64], [1969, 65], [1990, 65], [2005, 65]];
for (const [birth, age] of ages) s.check(birth + '년생', C.npsStartAge(birth), age);

s.section('조기노령연금 — 1년당 6% 감액, 최대 5년');
const base65 = pension(40, 3500000, { birthYear: 1990 });
for (const [age, pct] of [[64, 94], [63, 88], [62, 82], [61, 76], [60, 70]]) {
  const o = pension(40, 3500000, { birthYear: 1990, claimAge: age });
  s.check(age + '세 수령 지급률 ' + pct + '%', Math.round(o.payRate * 1000), pct * 10);
}
// 기댓값은 정수 연산으로. 절사 시점이 달라 1원 차이는 허용한다.
s.check('60세 연금액 = 정상의 70%', pension(40, 3500000, { birthYear: 1990, claimAge: 60 }).monthly,
  Math.floor(base65.monthly * 7 / 10), 2);
s.ok('5년 넘게 앞당겨도 70% 에서 멈춘다',
  pension(40, 3500000, { birthYear: 1990, claimAge: 55 }).payRate === 0.7);

s.section('연기연금 — 1년당 7.2% 가산, 최대 5년');
for (const [age, pct] of [[66, 1072], [67, 1144], [68, 1216], [69, 1288], [70, 1360]]) {
  const o = pension(40, 3500000, { birthYear: 1990, claimAge: age });
  s.check(age + '세 수령 지급률', Math.round(o.payRate * 1000), pct);
}
s.ok('5년 넘게 미뤄도 136% 에서 멈춘다',
  Math.round(pension(40, 3500000, { birthYear: 1990, claimAge: 80 }).payRate * 1000) === 1360);

s.section('기준소득월액 상·하한이 B값에 걸린다');
s.check('상한 초과 → 659만', pension(40, 90000000).bValue, 6590000);
s.check('하한 미만 → 41만', pension(40, 100000).bValue, 410000);
s.check('상한 안쪽은 그대로', pension(40, 3500000).bValue, 3500000);
s.ok('상한 초과분은 연금에 반영되지 않는다',
  pension(40, 90000000).monthly === pension(40, 6590000).monthly);

s.section('보험료율 인상 일정 (2025년 개혁: 2026년 9.5% → 2033년 13%)');
s.check('2025년 9.0%', Math.round(C.npsFeeRate(2025) * 1000), 90);
s.check('2026년 9.5%', Math.round(C.npsFeeRate(2026) * 1000), 95);
s.check('2027년 10.0%', Math.round(C.npsFeeRate(2027) * 1000), 100);
s.check('2030년 11.5%', Math.round(C.npsFeeRate(2030) * 1000), 115);
s.check('2033년 13.0%', Math.round(C.npsFeeRate(2033) * 1000), 130);
s.check('2040년도 13% 에서 멈춘다', Math.round(C.npsFeeRate(2040) * 1000), 130);
s.check('제도 초기도 9.0%', Math.round(C.npsFeeRate(1995) * 1000), 90);

s.section('가입 연도별 월수 분해');
const span = C.npsMonthsByYear(2020, 7, 2022, 3);
s.check('구간 수', span.rows.length, 3);
s.check('총 월수', span.total, 6 + 12 + 3);
s.check('첫해 7~12월', span.rows[0].months, 6);
s.check('가운데 해 12개월', span.rows[1].months, 12);
s.check('마지막 해 1~3월', span.rows[2].months, 3);
s.check('종료가 시작보다 이르면 0', C.npsMonthsByYear(2030, 1, 2020, 1).total, 0);
s.check('같은 달 1개월', C.npsMonthsByYear(2026, 5, 2026, 5).total, 1);

s.section('옛 상수가 섞이면 연금이 늘어난다');
// 1999~2007년은 소득대체율 60%(상수 1.8) 라 같은 기간이라도 더 많이 받는다
const oldMix = C.nationalPension({
  birthYear: 1975, startYear: 1999, startMonth: 1, endYear: 2038, endMonth: 12, monthlyIncome: A
});
s.check('1999~2038년 40년 가입월수', oldMix.months, 480);
s.ok('대체율이 43% 보다 높다', oldMix.replacementRate > 0.43);
s.ok('그래도 60% 는 넘지 않는다', oldMix.replacementRate < 0.60);
// 1988~1998년은 B에 0.75만 반영되므로 상수 2.4 라도 무한정 커지지 않는다
const oldest = C.nationalPension({
  birthYear: 1968, startYear: 1988, startMonth: 1, endYear: 2027, endMonth: 12, monthlyIncome: A
});
s.ok('1988년 시작도 유한하고 양수', isFinite(oldest.monthly) && oldest.monthly > 0);
s.ok('가장 오래된 구간이 가장 유리하다', oldest.replacementRate > oldMix.replacementRate);

s.section('제도 시행 이전은 1988년으로 당겨진다');
const early = C.nationalPension({
  birthYear: 1960, startYear: 1970, startMonth: 1, endYear: 2000, endMonth: 12, monthlyIncome: A
});
s.check('1988년부터 계산', early.rows[0].year, 1988);

s.section('본인부담 보험료 누계와 회수 기간');
const paid = pension(40, 3000000);
// 2026~2033년은 요율이 매년 오르고 2034년부터 13% 고정
let expect = 0;
for (let y = 2026; y <= 2065; y++) {
  const rate = y >= 2033 ? 130 : 90 + 5 * (y - 2025);
  expect += 3000000 * rate / 1000 / 2 * 12;
}
s.check('본인부담 누계', paid.paidSelf, Math.floor(expect));
s.ok('회수 기간이 양수', paid.breakEvenMonths > 0);
s.check('회수 개월 = 누계 ÷ 월연금 (올림)', paid.breakEvenMonths,
  Math.ceil(paid.paidSelf / paid.monthly));

s.section('입력 방어 — 어떤 값을 넣어도 유한하고 음수가 아니다');
const junk = [
  {},
  { monthlyIncome: -5000000, birthYear: 1990, startYear: 2026, endYear: 2065 },
  { monthlyIncome: NaN, birthYear: 1990, startYear: 2026, endYear: 2065 },
  { monthlyIncome: Infinity, birthYear: 1990, startYear: 2026, endYear: 2065 },
  { monthlyIncome: 1e308, birthYear: 2000, startYear: 2026, endYear: 2065 },
  { monthlyIncome: '3,500,000', birthYear: '1990', startYear: '2026', endYear: '2065' },
  { monthlyIncome: 3000000, birthYear: 1990, startYear: 2050, endYear: 2020 },
  { monthlyIncome: 3000000, birthYear: 1990, startYear: 1900, endYear: 2500 },
  { monthlyIncome: 3000000, birthYear: 0, startYear: 0, endYear: 0 },
  { monthlyIncome: 3000000, birthYear: 1990, startYear: 2026, endYear: 2065, claimAge: -99 },
  { monthlyIncome: 3000000, birthYear: 1990, startYear: 2026, endYear: 2065, claimAge: 9999 },
  { monthlyIncome: 3000000, birthYear: 1990, startYear: 2026, startMonth: 99, endYear: 2065, endMonth: -3 }
];
for (let i = 0; i < junk.length; i++) {
  const o = C.nationalPension(junk[i]);
  s.ok('입력 ' + (i + 1) + ' 유한·비음수',
    isFinite(o.monthly) && o.monthly >= 0 &&
    isFinite(o.paidSelf) && o.paidSelf >= 0 &&
    isFinite(o.months) && o.months >= 0);
}
s.check('가입월수 상한 600개월', C.nationalPension({
  monthlyIncome: 3000000, birthYear: 1990, startYear: 1900, endYear: 2500
}).months, 600);
s.check('콤마 문자열도 파싱', C.nationalPension({
  monthlyIncome: '3,500,000', birthYear: '1990', startYear: '2026', endYear: '2065'
}).bValue, 3500000);

s.section('결과는 원 단위 정수');
for (const y of [10, 20, 30, 40]) {
  const o = pension(y, 3333333);
  s.ok(y + '년 정수', Number.isInteger(o.monthly) && Number.isInteger(o.paidSelf));
}

module.exports = s.done();

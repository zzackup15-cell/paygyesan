'use strict';

/* 연봉 구간별 실수령액표.
 *
 * 새로운 산식이 없다. netPay 를 구간마다 부르는 것이 전부다.
 * 그래서 검증의 중심도 하나다.
 *
 *   표의 각 행이 netPay 를 직접 부른 값과 정확히 같아야 한다.
 *
 * 조합·파생 계산기의 위험은 산식이 틀리는 게 아니라 원본과 따로 노는 것이다.
 * 표에 적힌 실수령액이 계산기가 내놓는 값과 다르면 둘 다 못 믿게 된다.
 *
 * 두 번째 중심은 '직전 구간 대비 증가분' 이다. 이 표가 존재하는 이유이고,
 * 표시가 아니라 계산이라 검증이 필요하다.
 */

const { loadCalc, createSuite } = require('./_assert');
const C = loadCalc();
const s = createSuite('실수령액표');

const EXEMPT = 200000;
const SEG = [{ from: 20000000, to: 150000000, step: 1000000 }];
const rows = C.netPayTable(SEG, EXEMPT, 1, 0);

s.section('표의 형태');
s.check('행 수 = (1.5억 - 2천만) / 100만 + 1', rows.length, (150000000 - 20000000) / 1000000 + 1);
s.check('첫 행 연봉 2,000만', rows[0].annual, 20000000);
s.check('마지막 행 연봉 1억 5,000만', rows[rows.length - 1].annual, 150000000);
s.check('간격 100만원', rows[1].annual - rows[0].annual, 1000000);
s.ok('연봉이 단조 증가', rows.every((r, i) => i === 0 || r.annual > rows[i - 1].annual));

s.section('★ 표의 각 행이 netPay 와 같은가');
for (const annual of [20000000, 30000000, 45000000, 50000000, 70000000, 100000000, 150000000]) {
  const row = rows.find((r) => r.annual === annual);
  const direct = C.netPay(annual / 12, EXEMPT, 1, 0);
  s.check('연봉 ' + annual / 10000 + '만 월 실수령', row.monthlyNet, direct.net);
  s.check('  월 세전', row.monthlyGross, direct.gross);
  s.check('  공제액', row.deduction, direct.deduction);
}
// 전 구간 대조. 한 행이라도 어긋나면 표 전체를 못 믿는다.
let mismatch = 0;
for (const r of rows) {
  if (C.netPay(r.annual / 12, EXEMPT, 1, 0).net !== r.monthlyNet) mismatch++;
}
s.check('전 구간 ' + rows.length + '행 대조 불일치', mismatch, 0);

s.section('파생 값');
const mid = rows.find((r) => r.annual === 50000000);
s.check('연 실수령 = 월 × 12', mid.annualNet, mid.monthlyNet * 12);
s.check('공제율 = 공제액 / 세전', Math.round(mid.deductionRate * 10000),
  Math.round(mid.deduction / mid.monthlyGross * 10000), 1);
s.ok('공제율이 0과 1 사이', mid.deductionRate > 0 && mid.deductionRate < 1);
s.ok('실수령이 세전보다 작다', mid.monthlyNet < mid.monthlyGross);

s.section('★ 직전 구간 대비 증가분');
s.check('첫 행은 0', rows[0].deltaNet, 0);
for (let i = 1; i < rows.length; i++) {
  if (i > 5 && i % 25 !== 0) continue; // 표본만
  s.check('행 ' + i + ' 증가분 = 현재 - 직전',
    rows[i].deltaNet, rows[i].monthlyNet - rows[i - 1].monthlyNet);
}
// 연봉이 100만원 올라도 실수령은 100만원/12 만큼 오르지 않는다
const raise = 1000000 / 12;
for (const annual of [30000000, 50000000, 80000000]) {
  const r = rows.find((x) => x.annual === annual);
  s.ok('연봉 ' + annual / 10000 + '만: 증가분이 인상분보다 작다', r.deltaNet < raise);
  s.ok('  그래도 증가는 한다', r.deltaNet > 0);
}
// 연봉이 높을수록 인상분에서 남는 비율이 줄어든다 (누진세)
const keep = (annual) => rows.find((r) => r.annual === annual).deltaNet / raise;
s.ok('3,000만 구간이 8,000만 구간보다 많이 남는다', keep(30000000) > keep(80000000));
s.ok('5,000만 구간이 그 사이', keep(30000000) > keep(50000000) && keep(50000000) > keep(80000000));

s.section('공제율은 연봉이 오를수록 높아진다');
let prevRate = 0;
for (const annual of [20000000, 40000000, 60000000, 80000000, 100000000, 150000000]) {
  const r = rows.find((x) => x.annual === annual);
  s.ok('연봉 ' + annual / 10000 + '만 공제율 상승', r.deductionRate > prevRate);
  prevRate = r.deductionRate;
}

s.section('공제 조건이 반영되는가');
const famRows = C.netPayTable(SEG, EXEMPT, 4, 2);
const plain = rows.find((r) => r.annual === 50000000);
const withFam = famRows.find((r) => r.annual === 50000000);
s.ok('부양가족·자녀가 있으면 실수령이 많다', withFam.monthlyNet > plain.monthlyNet);
s.ok('세전은 같다', withFam.monthlyGross === plain.monthlyGross);
const exemptRows = C.netPayTable(SEG, 500000, 1, 0);
s.ok('비과세가 크면 실수령이 많다',
  exemptRows.find((r) => r.annual === 50000000).monthlyNet > plain.monthlyNet);

s.section('여러 구간 이어붙이기');
const multi = C.netPayTable([
  { from: 20000000, to: 30000000, step: 5000000 },
  { from: 35000000, to: 50000000, step: 5000000 }
], EXEMPT, 1, 0);
s.check('행 수', multi.length, 3 + 4);
s.check('구간이 이어진다', multi[3].annual, 35000000);
s.check('구간 경계에서도 증가분이 이어진다',
  multi[3].deltaNet, multi[3].monthlyNet - multi[2].monthlyNet);
// 경계가 겹치면 중복을 건너뛴다
const dup = C.netPayTable([
  { from: 20000000, to: 30000000, step: 10000000 },
  { from: 30000000, to: 40000000, step: 10000000 }
], EXEMPT, 1, 0);
s.check('겹친 연봉은 한 번만', dup.filter((r) => r.annual === 30000000).length, 1);

s.section('입력 방어');
s.check('구간 없음', C.netPayTable([], EXEMPT, 1, 0).length, 0);
s.check('null', C.netPayTable(null, EXEMPT, 1, 0).length, 0);
s.check('step 0 은 무한루프 대신 빈 결과', C.netPayTable([{ from: 1, to: 100, step: 0 }], EXEMPT, 1, 0).length, 0);
s.check('step 음수', C.netPayTable([{ from: 1, to: 100, step: -5 }], EXEMPT, 1, 0).length, 0);
s.check('to < from', C.netPayTable([{ from: 100, to: 1, step: 1 }], EXEMPT, 1, 0).length, 0);
s.check('행 수 상한', C.netPayTable([{ from: 0, to: 100000000000, step: 1000 }], EXEMPT, 1, 0).length,
  C.TABLE_MAX_ROWS);
s.check('빈 객체', C.netPayTable([{}], EXEMPT, 1, 0).length, 0);
const junkRows = C.netPayTable([{ from: NaN, to: Infinity, step: 1000000 }], EXEMPT, 1, 0);
s.ok('NaN·Infinity 도 유한한 결과',
  junkRows.every((r) => isFinite(r.monthlyNet) && r.monthlyNet >= 0 && isFinite(r.deltaNet)));

s.section('모든 값이 유한하고 음수가 아니다');
s.ok('전 구간',
  rows.every((r) => isFinite(r.monthlyNet) && r.monthlyNet > 0 &&
    isFinite(r.monthlyGross) && r.monthlyGross > 0 &&
    isFinite(r.annualNet) && r.annualNet > 0 &&
    isFinite(r.deduction) && r.deduction >= 0 &&
    isFinite(r.deltaNet) && r.deltaNet >= 0));
// 표는 netPay 의 뷰이므로 반올림하지 않는다. 행 안에서 셈이 맞아야 한다.
s.ok('행 안에서 세전 - 공제 = 실수령',
  rows.every((r) => Math.abs(r.monthlyGross - r.deduction - r.monthlyNet) < 0.0001));

module.exports = s.done();

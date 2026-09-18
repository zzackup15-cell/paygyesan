'use strict';

/* 실수령액으로 세전 급여 역산.
 *
 * 검증의 중심은 '왕복' 이다.
 *
 *   세전 → 실수령 → 역산 → 그 세전의 실수령 이 원래 실수령과 같아야 한다.
 *
 * 역산된 세전액이 원래 세전액과 '같아야' 한다고 검증하면 안 된다. 간이세액표가
 * 계단 함수라 같은 실수령이 나오는 세전 구간이 몇 천 원 폭으로 존재하기
 * 때문이다. 세법의 성질이지 오차가 아니다. 그래서 세전이 아니라 실수령이
 * 돌아오는지를 본다.
 */

const { loadCalc, createSuite } = require('./_assert');
const C = loadCalc();
const s = createSuite('실수령 역산');

const EXEMPT = 200000; // 식대 비과세 기본값

s.section('★ 목표 실수령액을 정확히 맞히는가');
for (const target of [1800000, 2000000, 2500000, 3000000, 3500000, 4000000, 5000000, 7000000]) {
  const r = C.grossFromNet(target, EXEMPT, 1, 0);
  s.check('실수령 ' + target.toLocaleString() + ' 역산', r.net, target);
  s.ok('  오차 0원', r.exact === true);
}

s.section('★ 왕복 — 세전 → 실수령 → 역산 → 실수령');
for (const gross of [2200000, 3000000, 4500000, 6000000, 9000000]) {
  const net = C.netPay(gross, EXEMPT, 1, 0).net;
  const back = C.grossFromNet(net, EXEMPT, 1, 0);
  s.check('세전 ' + gross.toLocaleString() + ' 왕복', C.netPay(back.gross, EXEMPT, 1, 0).net, net);
  // 역산된 세전은 같은 실수령이 나오는 구간의 아래쪽 끝이라 원래보다 작거나 같다
  s.ok('  역산 세전 ≤ 원래 세전', back.gross <= gross);
  s.ok('  차이가 2만원 미만', gross - back.gross < 20000);
}

s.section('같은 실수령이 나오는 세전 구간(spread)');
for (const gross of [3000000, 4500000, 6000000]) {
  const net = C.netPay(gross, EXEMPT, 1, 0).net;
  const r = C.grossFromNet(net, EXEMPT, 1, 0);
  s.ok('세전 ' + gross.toLocaleString() + ' 구간 폭이 음수가 아니다', r.spread >= 0);
  s.check('  구간 = grossMax - gross', r.spread, r.grossMax - r.gross);
  // 구간의 양 끝이 같은 실수령을 내야 한다
  s.check('  구간 아래끝 실수령', C.netPay(r.gross, EXEMPT, 1, 0).net, net);
  s.check('  구간 위끝 실수령', C.netPay(r.grossMax, EXEMPT, 1, 0).net, net);
  // 구간 바로 위는 달라야 한다 (진짜 끝인지)
  s.ok('  구간 위끝 +10원은 달라진다',
    C.netPay(r.grossMax + 10, EXEMPT, 1, 0).net !== net || r.spread >= 20000);
}

s.section('연봉 = 월 세전 × 12');
const base = C.grossFromNet(3000000, EXEMPT, 1, 0);
s.check('연봉', base.annual, base.gross * 12);
s.check('연봉 상단', base.annualMax, base.grossMax * 12);
s.ok('연봉이 실수령 연환산보다 크다', base.annual > 3000000 * 12);

s.section('공제 조건이 역산에 반영되는가');
// 부양가족이 많을수록 세금이 줄어 같은 실수령에 필요한 세전이 낮아진다
let prev = Infinity;
for (const fam of [1, 2, 3, 4]) {
  const r = C.grossFromNet(3000000, EXEMPT, fam, 0);
  s.ok('가족 ' + fam + '명 세전이 더 낮다', r.gross < prev);
  prev = r.gross;
}
// 자녀 세액공제도 같은 방향
s.ok('자녀가 있으면 세전이 더 낮다',
  C.grossFromNet(3000000, EXEMPT, 2, 1).gross < C.grossFromNet(3000000, EXEMPT, 2, 0).gross);
// 비과세가 크면 세금이 줄어 세전도 낮아진다
s.ok('비과세가 크면 세전이 더 낮다',
  C.grossFromNet(3000000, 500000, 1, 0).gross < C.grossFromNet(3000000, 0, 1, 0).gross);

s.section('단조성 — 실수령이 크면 세전도 크다');
let last = 0;
for (const target of [1500000, 2000000, 2500000, 3000000, 4000000, 6000000, 9000000]) {
  const r = C.grossFromNet(target, EXEMPT, 1, 0);
  s.ok('실수령 ' + target.toLocaleString() + ' → 세전 증가', r.gross > last);
  last = r.gross;
}

s.section('세전은 항상 실수령보다 크다');
for (const target of [1000000, 2000000, 3500000, 5000000, 8000000]) {
  const r = C.grossFromNet(target, EXEMPT, 1, 0);
  s.ok(target.toLocaleString() + ' 세전 > 실수령', r.gross > target);
}

s.section('입력 방어 — 어떤 값을 넣어도 유한하고 음수가 아니다');
const junk = [0, -5000000, NaN, Infinity, -Infinity, 1e308, '3,000,000', null, undefined, '', 'abc'];
for (let i = 0; i < junk.length; i++) {
  const r = C.grossFromNet(junk[i], EXEMPT, 1, 0);
  s.ok('입력 ' + (i + 1) + ' 유한·비음수',
    isFinite(r.gross) && r.gross >= 0 &&
    isFinite(r.annual) && r.annual >= 0 &&
    isFinite(r.net) && r.net >= 0 &&
    isFinite(r.spread) && r.spread >= 0);
}
s.check('0원은 0', C.grossFromNet(0, EXEMPT, 1, 0).gross, 0);
s.check('음수는 0', C.grossFromNet(-5000000, EXEMPT, 1, 0).gross, 0);
s.check('콤마 문자열 파싱',
  C.grossFromNet('3,000,000', EXEMPT, 1, 0).gross, C.grossFromNet(3000000, EXEMPT, 1, 0).gross);
s.ok('상한을 넘지 않는다', C.grossFromNet(1e308, EXEMPT, 1, 0).gross <= C.MAX_AMOUNT);

s.section('결과는 원 단위 정수');
for (const target of [2345678, 3141592, 4987654]) {
  const r = C.grossFromNet(target, EXEMPT, 1, 0);
  s.ok(target.toLocaleString() + ' 정수',
    Number.isInteger(r.gross) && Number.isInteger(r.annual) &&
    Number.isInteger(r.net) && Number.isInteger(r.spread));
}

s.section('netPay 와 어긋나지 않는다');
// 역산 결과를 netPay 에 다시 넣었을 때 모든 공제 항목이 성립해야 한다
const check = C.grossFromNet(3500000, EXEMPT, 2, 1);
const detail = C.netPay(check.gross, EXEMPT, 2, 1);
s.check('실수령 일치', detail.net, check.net);
s.check('실수령 = 세전 - 공제계', detail.net, detail.gross - detail.deduction);
s.check('공제계 = 4대보험 + 소득세 + 지방세',
  detail.deduction, detail.insuranceTotal + detail.incomeTax + detail.localTax);

module.exports = s.done();

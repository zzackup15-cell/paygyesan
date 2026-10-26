'use strict';

/* 연봉 백분위 (내 연봉은 상위 몇 %).
 *
 * 국세청 근로소득 백분위 자료를 쓴다. 원자료는 구간별 '인원' 과
 * '총급여 합계' 만 주고 경계 금액이 없다. 그래서 구간 평균을 그 구간
 * 가운데 백분위의 대표값으로 놓고 사이를 잇는다. 결과는 추정치다.
 *
 * 검증의 중심은 둘이다.
 *
 *   하나. 데이터가 국세청 발표와 맞는가. 인원 약 2,108만명, 평균 총급여
 *   약 4,475만원. 이 둘이 어긋나면 CSV 를 잘못 읽었거나 단위가 틀린 것이다.
 *
 *   둘. 왕복이 성립하는가. 상위 N% 의 연봉을 구해 다시 백분위를 물으면
 *   N 이 돌아와야 한다.
 */

const path = require('path');
const { loadCalc, createSuite, ROOT } = require('./_assert');

global.INCOME_TABLE = require(path.join(ROOT, 'public', 'assets', 'income-table.js'));
const C = loadCalc();
const s = createSuite('연봉 백분위');

const T = global.INCOME_TABLE;

s.section('★ 데이터가 국세청 발표와 맞는가');
s.check('귀속연도', T.year, 2024);
s.check('구간 수 109', T.bands.length, 109);
// 국세청 '23년 발표: 신고 인원 2,085만명, 평균 총급여 4,332만원.
// '24년 귀속은 그보다 조금 크되 크게 벗어나면 안 된다.
s.ok('인원 2,050만~2,200만명', T.people > 20500000 && T.people < 22000000);
s.check('인원 21,078,535명', T.people, 21078535);
s.ok('평균 총급여 4,300만~4,700만원', T.averagePay > 43000000 && T.averagePay < 47000000);
s.check('평균 44,749,680원', T.averagePay, 44749680);

s.section('구간의 형태');
s.check('첫 구간은 상위 0.05% (0~0.1% 의 가운데)', T.bands[0][0], 0.05);
s.check('마지막 구간은 상위 99.5%', T.bands[T.bands.length - 1][0], 99.5);
s.ok('백분위가 단조 증가', T.bands.every((b, i) => i === 0 || b[0] > T.bands[i - 1][0]));
s.ok('구간 평균이 단조 감소', T.bands.every((b, i) => i === 0 || b[1] < T.bands[i - 1][1]));
s.ok('모두 양수', T.bands.every((b) => b[0] > 0 && b[1] > 0));

s.section('연봉이 크면 상위 백분위가 작아진다');
let prev = 100;
for (const annual of [20000000, 30000000, 40000000, 50000000, 70000000, 100000000, 200000000]) {
  const r = C.incomePercentile(annual);
  s.ok('연봉 ' + annual / 10000 + '만 → 상위 ' + r.percentile.toFixed(1) + '%', r.percentile < prev);
  prev = r.percentile;
}

s.section('★ 왕복 — 상위 N% 의 연봉을 다시 물으면 N 이 나온다');
for (const pct of [1, 5, 10, 20, 30, 40, 50, 60, 70, 80, 90]) {
  const pay = C.incomeAtPercentile(pct);
  const back = C.incomePercentile(pay).percentile;
  s.check('상위 ' + pct + '% 왕복', Math.round(back * 10) / 10, pct, 0.15);
  s.ok('  그 지점 연봉이 양수', pay > 0);
}

s.section('평균과 중위');
const mid = C.incomePercentile(50000000);
s.check('중위 = 상위 50% 지점', mid.median, C.incomeAtPercentile(50));
s.ok('중위가 평균보다 낮다', mid.median < T.averagePay);
s.ok('중위 3,000만~3,700만원', mid.median > 30000000 && mid.median < 37000000);
// 평균과 같은 연봉이면 평균 대비 100%
const atAvg = C.incomePercentile(T.averagePay);
s.check('평균 연봉의 평균 대비 비율', Math.round(atAvg.vsAverage * 100), 100);
s.ok('평균 연봉은 상위 30~40% 대', atAvg.percentile > 30 && atAvg.percentile < 40);

s.section('등수');
const r50 = C.incomePercentile(50000000);
s.check('등수 = 인원 × 백분위', r50.rank, Math.round(T.people * r50.percentile / 100));
s.ok('등수가 인원을 넘지 않는다', r50.rank <= T.people);
s.ok('등수가 양수', r50.rank > 0);
s.check('인원이 데이터와 같다', r50.people, T.people);
s.check('귀속연도가 데이터와 같다', r50.year, T.year);

s.section('경계');
// 자료의 최상위 구간 평균보다 높으면 최상위로 고정
const top = T.bands[0][1];
s.check('최상위 구간 평균', C.incomePercentile(top).percentile, T.bands[0][0]);
s.check('그보다 높아도 같은 값', C.incomePercentile(top * 10).percentile, T.bands[0][0]);
// 최하위도 마찬가지
const bottom = T.bands[T.bands.length - 1][1];
s.check('최하위 구간 평균', C.incomePercentile(bottom).percentile, T.bands[T.bands.length - 1][0]);
s.check('그보다 낮아도 같은 값', C.incomePercentile(1).percentile, T.bands[T.bands.length - 1][0]);

s.section('역방향 경계');
s.check('0% 이하', C.incomeAtPercentile(0.01), T.bands[0][1]);
s.check('100% 이상', C.incomeAtPercentile(100), T.bands[T.bands.length - 1][1]);
s.check('0 은 0', C.incomeAtPercentile(0), 0);
s.check('음수는 0', C.incomeAtPercentile(-5), 0);

s.section('입력 방어 — 어떤 값을 넣어도 유한하고 음수가 아니다');
const junk = [0, -50000000, NaN, Infinity, -Infinity, 1e308, '50,000,000', null, undefined, '', 'abc'];
for (let i = 0; i < junk.length; i++) {
  const r = C.incomePercentile(junk[i]);
  s.ok('입력 ' + (i + 1) + ' 유한·비음수',
    isFinite(r.percentile) && r.percentile >= 0 && r.percentile <= 100 &&
    isFinite(r.rank) && r.rank >= 0 &&
    isFinite(r.vsAverage) && r.vsAverage >= 0);
}
s.check('0원은 백분위 0', C.incomePercentile(0).percentile, 0);
s.check('음수는 백분위 0', C.incomePercentile(-50000000).percentile, 0);
s.check('콤마 문자열 파싱',
  C.incomePercentile('50,000,000').percentile, C.incomePercentile(50000000).percentile);
s.ok('데이터가 있다고 표시', C.incomePercentile(50000000).hasData === true);

s.section('대표 사례 (국세청 2024년 귀속 기준)');
const cases = [
  [30000000, 50, 65],
  [50000000, 25, 35],
  [70000000, 14, 21],
  [100000000, 5, 10]
];
for (const [annual, lo, hi] of cases) {
  const p = C.incomePercentile(annual).percentile;
  s.ok('연봉 ' + annual / 10000 + '만 → 상위 ' + p.toFixed(1) + '% (' + lo + '~' + hi + '% 범위)',
    p > lo && p < hi);
}

module.exports = s.done();

'use strict';

/* 취미 추천 (홈 /, 예전 /chwimi).
 *
 * 법령 계산이 아니라 규칙 기반 추천이다. 그래서 '정답 금액' 대신 규칙이
 * 지켜지는지를 본다. 중심 검증은 셋이다(기획서 5절).
 *
 *   하나. 결정성. 같은 답이면 순서까지 완전히 같다. 공유 링크로 들어온
 *   사람이 보낸 사람과 다른 결과를 보면 이 페이지는 고장이다.
 *
 *   둘. 극단 프로필이 상식에 맞는다. 매우 활동적·실외·혼자에게 뜨개질이
 *   나오면 점수 식이나 자료 둘 중 하나가 틀린 것이다.
 *
 *   셋. 예산 필터. 5만원이라고 답한 사람에게 가장 싸게 해도 5만원이 넘는
 *   취미를 추천하지 않는다.
 *
 * 비용은 추정치라 값 자체를 맞출 수는 없다. 대신 형식(만원 단위 정수,
 * 하한 ≤ 상한)과 근거 메모가 빠지지 않았는지를 본다.
 */

const path = require('path');
const { loadCalc, createSuite, ROOT } = require('./_assert');

const TABLE = require(path.join(ROOT, 'public', 'assets', 'hobby-table.js'));
global.HOBBY_TABLE = TABLE;
const C = loadCalc();
const s = createSuite('취미 추천');

const ATTRS = ['active', 'social', 'indoor', 'time', 'entry'];
// 기획서 4절의 가중치를 여기에 따로 적는다. calc.js 의 상수를 그대로 가져다
// 기댓값을 만들면 상수가 바뀌어도 테스트가 따라 바뀌어 아무것도 못 잡는다.
const W = { active: 1.5, social: 1.0, indoor: 1.0, time: 0.8, entry: 0.7 };

const oneDecimal = (v) => typeof v === 'number' && v >= 0 && v <= 1 && Math.round(v * 10) === v * 10;
const ids = (list) => list.map((r) => r.hobby.id).join(',');

// 극단 프로필. 나머지 질문(시간·빈도·배움)은 가운데 보기로 둔다.
const MID = { q_time: 'b', q_routine: 'b', q_learning: 'b', q_budget: 'd' };
const ACTIVE_OUT_SOLO = Object.assign({}, MID, { q_energy: 'c', q_people: 'a', q_place: 'c', q_goal: 'a' });
const STILL_IN_SOLO = Object.assign({}, MID, { q_energy: 'a', q_people: 'a', q_place: 'a', q_goal: 'd' });

/* ── 데이터 ─────────────────────────────────────────────────────────── */

s.section('데이터 무결성');
s.check('version', TABLE.version, 1);
s.ok('updated 형식 YYYY-MM', /^\d{4}-\d{2}$/.test(TABLE.updated));
s.check('분류 6개', TABLE.categories.length, 6);
const catIds = TABLE.categories.map((c) => c.id);
s.ok('분류 id 고유', new Set(catIds).size === catIds.length);
s.ok('분류 이름 있음', TABLE.categories.every((c) => typeof c.name === 'string' && c.name.length > 0));

const H = TABLE.hobbies;
s.ok('취미 45~55개 (' + H.length + '개)', H.length >= 45 && H.length <= 55);
const hobbyIds = H.map((h) => h.id);
s.ok('취미 id 고유', new Set(hobbyIds).size === hobbyIds.length);
s.ok('취미 id 형식 (영문 소문자·하이픈)', hobbyIds.every((id) => /^[a-z]+(-[a-z]+)*$/.test(id)));
s.ok('취미 이름 있음·고유',
  H.every((h) => typeof h.name === 'string' && h.name.length > 0) &&
  new Set(H.map((h) => h.name)).size === H.length);
s.ok('분류가 모두 유효', H.every((h) => catIds.indexOf(h.category) !== -1));

const perCat = {};
for (const c of catIds) perCat[c] = H.filter((h) => h.category === c).length;
const counts = Object.values(perCat);
s.ok('분류마다 7개 이상 (' + catIds.map((c) => c + ' ' + perCat[c]).join(', ') + ')',
  counts.every((n) => n >= 7));
s.ok('분류 간 개수 차이 2 이하 (고르게)', Math.max(...counts) - Math.min(...counts) <= 2);

for (const a of ATTRS) {
  const bad = H.filter((h) => !oneDecimal(h[a])).map((h) => h.id);
  s.ok('속성 ' + a + ' 0~1·소수 1자리' + (bad.length ? ' (' + bad.join(',') + ')' : ''), bad.length === 0);
}

const costBad = H.filter((h) => !(Number.isInteger(h.costMin) && Number.isInteger(h.costMax) &&
  h.costMin >= 0 && h.costMax >= 0)).map((h) => h.id);
s.ok('비용이 0 이상 정수' + (costBad.length ? ' (' + costBad.join(',') + ')' : ''), costBad.length === 0);
const roundBad = H.filter((h) => h.costMin % 10000 !== 0 || h.costMax % 10000 !== 0).map((h) => h.id);
s.ok('비용이 만원 단위' + (roundBad.length ? ' (' + roundBad.join(',') + ')' : ''), roundBad.length === 0);
const orderBad = H.filter((h) => h.costMin > h.costMax).map((h) => h.id);
s.ok('costMin ≤ costMax' + (orderBad.length ? ' (' + orderBad.join(',') + ')' : ''), orderBad.length === 0);
// 추정치의 근거가 메모뿐이므로, 메모 없는 숫자는 근거 없는 숫자다
const noteBad = H.filter((h) => typeof h.costNote !== 'string' || h.costNote.length < 15).map((h) => h.id);
s.ok('모든 취미에 비용 메모' + (noteBad.length ? ' (' + noteBad.join(',') + ')' : ''), noteBad.length === 0);
// 상식선 경계. 숫자를 과장하면 여기서 걸린다. 가장 비싼 취미도 월 150만원 이하.
s.ok('월 비용 상한 150만원 이하', H.every((h) => h.costMax <= 1500000));
s.ok('돈이 거의 안 드는 취미가 있다 (costMin 0원)', H.some((h) => h.costMin === 0));
s.ok('분류마다 5만원 안쪽으로 시작할 수 있는 취미가 있다',
  catIds.every((c) => H.some((h) => h.category === c && h.costMin <= 50000)));

/* ── 질문 ─────────────────────────────────────────────────────────── */

s.section('질문');
const Q = TABLE.questions;
s.check('질문 8개', Q.length, 8);
s.ok('질문 id 고유', new Set(Q.map((q) => q.id)).size === Q.length);
s.ok('질문 id 형식 q_*', Q.every((q) => /^q_[a-z]+$/.test(q.id)));
s.ok('질문 문구 있음', Q.every((q) => typeof q.text === 'string' && q.text.length > 0));
s.ok('보기 3~4개', Q.every((q) => q.options.length >= 3 && q.options.length <= 4));
s.ok('질문마다 보기 id 고유', Q.every((q) => new Set(q.options.map((o) => o.id)).size === q.options.length));
s.ok('보기 문구 있음', Q.every((q) => q.options.every((o) => typeof o.text === 'string' && o.text.length > 0)));

const budgetQs = Q.filter((q) => q.options.some((o) => 'budget' in o));
s.check('예산 질문은 하나', budgetQs.length, 1);
const BQ = budgetQs[0];
s.ok('예산 질문의 보기는 모두 budget 을 준다', BQ.options.every((o) => 'budget' in o && !o.set));
s.ok('예산 금액은 만원 단위 양의 정수 또는 null', BQ.options.every((o) =>
  o.budget === null || (Number.isInteger(o.budget) && o.budget > 0 && o.budget % 10000 === 0)));
s.ok('"제한 없음" 보기(null) 가 있다', BQ.options.some((o) => o.budget === null));
s.ok('5만원 보기가 있다', BQ.options.some((o) => o.budget === 50000));
const budgets = BQ.options.filter((o) => o.budget !== null).map((o) => o.budget);
s.ok('예산 보기가 오름차순', budgets.every((b, i) => i === 0 || b > budgets[i - 1]));

const others = Q.filter((q) => q !== BQ);
s.ok('예산 외 질문의 보기는 모두 set 을 준다',
  others.every((q) => q.options.every((o) => o.set && Object.keys(o.set).length > 0)));
s.ok('set 의 키는 다섯 속성 중 하나', others.every((q) => q.options.every((o) =>
  Object.keys(o.set).every((k) => ATTRS.indexOf(k) !== -1))));
s.ok('set 의 값은 0~1·소수 1자리', others.every((q) => q.options.every((o) =>
  Object.keys(o.set).every((k) => oneDecimal(o.set[k])))));
for (const a of ATTRS) {
  const by = others.filter((q) => q.options.some((o) => a in o.set)).map((q) => q.id);
  s.ok('속성 ' + a + ' 을 정하는 질문 (' + by.join(', ') + ')', by.length >= 1);
}

/* ── 프로필 ───────────────────────────────────────────────────────── */

s.section('프로필 — 답이 없으면 가운데');
const empty = C.hobbyProfile({});
for (const a of ATTRS) s.check('빈 답 ' + a + ' = 0.5', empty[a], 0.5);
s.check('빈 답 예산 null', empty.budget, null);
s.check('빈 답 answered 0', empty.answered, 0);

s.section('프로필 — 값과 평균');
const one = C.hobbyProfile({ q_energy: 'c' });
s.check('q_energy c → active 0.9', one.active, 0.9);
s.check('다른 속성은 그대로 0.5', one.social, 0.5);
s.check('answered 1', one.answered, 1);
// 같은 속성을 두 질문이 정하면 평균
s.check('active 0.1 과 0.9 의 평균 = 0.5', C.hobbyProfile({ q_energy: 'a', q_goal: 'a' }).active, 0.5);
s.check('active 0.4 와 0.9 의 평균 = 0.65', C.hobbyProfile({ q_energy: 'b', q_goal: 'a' }).active, 0.65);
s.check('time 0.1 과 0.9 의 평균 = 0.5', C.hobbyProfile({ q_time: 'a', q_routine: 'c' }).time, 0.5);
// 한 보기가 두 속성을 정하는 경우
const rest = C.hobbyProfile({ q_goal: 'd', q_learning: 'c' });
s.check('q_goal d → active 0.1', rest.active, 0.1);
s.check('entry 0.1 과 0.9 의 평균 = 0.5', rest.entry, 0.5);
// 부동소수를 누적하면 0.30000000000000004 같은 꼬리가 남는다
s.check('time 0.1·0.5 평균 = 0.3 정확히', C.hobbyProfile({ q_time: 'a', q_routine: 'b' }).time, 0.3);
s.check('entry 0.1·0.5 평균 = 0.3 정확히', C.hobbyProfile(STILL_IN_SOLO).entry, 0.3);

s.section('프로필 — 예산');
s.check('5만원', C.hobbyProfile({ q_budget: 'a' }).budget, 50000);
s.check('15만원', C.hobbyProfile({ q_budget: 'b' }).budget, 150000);
s.check('30만원', C.hobbyProfile({ q_budget: 'c' }).budget, 300000);
s.check('정해 두지 않았다 → null', C.hobbyProfile({ q_budget: 'd' }).budget, null);
s.check('예산 답도 answered 에 센다', C.hobbyProfile({ q_budget: 'd' }).answered, 1);
s.check('8개 모두 답하면 answered 8', C.hobbyProfile(ACTIVE_OUT_SOLO).answered, 8);

/* ── 입력 방어 ────────────────────────────────────────────────────── */

s.section('입력 방어 — 이상한 답');
const neutral = (p) => ATTRS.every((a) => p[a] === 0.5) && p.budget === null && p.answered === 0;
const junkAnswers = [null, undefined, 0, 42, NaN, '', 'q_energy=c', [], ['c'], true, () => 1];
junkAnswers.forEach((j, i) => s.ok('답 객체 이상값 ' + (i + 1) + ' → 빈 프로필', neutral(C.hobbyProfile(j))));
s.ok('없는 질문 id 는 무시', neutral(C.hobbyProfile({ q_nope: 'a', energy: 'c' })));
s.ok('없는 보기 id 는 무시', neutral(C.hobbyProfile({ q_energy: 'z', q_budget: 'e' })));
s.ok('보기 id 대소문자 구분 (C ≠ c)', neutral(C.hobbyProfile({ q_energy: 'C' })));
s.ok('문자열이 아닌 보기 값은 무시',
  neutral(C.hobbyProfile({ q_energy: 3, q_people: null, q_place: ['a'], q_time: { id: 'a' } })));
// 해시에서 온 키가 프로토타입 속성을 건드리면 안 된다
const proto = JSON.parse('{"__proto__": {"q_energy": "c"}, "constructor": "a", "toString": "b"}');
s.ok('__proto__·constructor 키는 무시', neutral(C.hobbyProfile(proto)));
const inherited = Object.create({ q_energy: 'c' });
s.ok('상속된 키는 답으로 보지 않는다', neutral(C.hobbyProfile(inherited)));
const mixed = C.hobbyProfile({ q_energy: 'c', q_people: 'z', q_bogus: 'a' });
s.ok('유효한 답만 센다', mixed.answered === 1 && mixed.active === 0.9 && mixed.social === 0.5);

s.section('입력 방어 — 이상한 답으로도 순위가 나온다');
for (const j of [null, undefined, 'abc', { q_energy: 'z' }]) {
  const r = C.hobbyRecommend(j, 2500000);
  s.ok('답 ' + JSON.stringify(j) + ' → 전체 순위·추천 3개',
    r.ranked.length === H.length && r.top.length === 3 &&
    r.ranked.every((x) => isFinite(x.score) && x.score >= 0 && x.score <= 1));
}

/* ── 점수 규칙 ────────────────────────────────────────────────────── */

s.section('점수 규칙 — 계약서 식과 같다');
// 기댓값을 테스트 안에서 따로 계산한다
function expectScore(p, h) {
  let sum = 0;
  let ws = 0;
  for (const a of ATTRS) { sum += W[a] * (p[a] - h[a]) ** 2; ws += W[a]; }
  return 1 - Math.sqrt(sum) / Math.sqrt(ws);
}
for (const [label, ans] of [['활동 프로필', ACTIVE_OUT_SOLO], ['정적 프로필', STILL_IN_SOLO], ['빈 답', {}]]) {
  const r = C.hobbyRecommend(ans);
  const worst = Math.max(...r.ranked.map((x) => Math.abs(x.score - expectScore(r.profile, x.hobby))));
  s.ok(label + ': 모든 취미의 점수가 식과 일치 (오차 ' + worst.toExponential(1) + ')', worst <= 5e-7);
}
s.ok('가중치 상수가 계약서와 같다', ATTRS.every((a) => C.HOBBY_WEIGHTS[a] === W[a]));
s.check('속성 순서', C.HOBBY_ATTRS.join(','), ATTRS.join(','));

s.section('점수 규칙 — 작은 표로 확인');
// 전역 자료를 잠시 바꿔 경계를 본다. 끝나면 반드시 되돌린다.
function withTable(table, fn) {
  const saved = global.HOBBY_TABLE;
  global.HOBBY_TABLE = table;
  try { return fn(); } finally { global.HOBBY_TABLE = saved; }
}
const mk = (id, v, costMin, costMax) => ({ id, name: id, category: 'life',
  active: v, social: v, indoor: v, time: v, entry: v, costMin, costMax, costNote: '시험용' });
const tiny = { questions: [], hobbies: [mk('zeta', 0.5, 0, 0), mk('alpha', 0.5, 0, 0),
  mk('mid', 0.5, 10000, 30000), mk('far', 1.0, 0, 0), mk('farther', 0.0, 0, 0)] };
withTable(tiny, () => {
  const r = C.hobbyRecommend({}, 0);
  s.check('프로필과 같은 취미는 score 1', r.ranked[0].score, 1);
  s.check('모든 속성 차이 0.5 → score 0.5', r.ranked.find((x) => x.hobby.id === 'far').score, 0.5);
  s.check('동점이면 id 사전순 (alpha → mid → zeta)', ids(r.top), 'alpha,mid,zeta');
  s.check('동점 뒤쪽도 id 순 (far → farther)', ids(r.ranked.slice(3)), 'far,farther');
});
// 빈 답의 프로필은 0.5 라 최대 차이가 0.5 다. 0 과 1 의 끝을 보려면 질문이 필요하다.
withTable({ questions: [{ id: 'q_x', text: 'x', options: [{ id: 'a', text: 'a',
  set: { active: 0, social: 0, indoor: 0, time: 0, entry: 0 } }] }], hobbies: [mk('one', 1.0, 0, 0)] }, () => {
  s.check('모든 속성이 정반대면 score 0', C.hobbyRecommend({ q_x: 'a' }).ranked[0].score, 0);
});

s.section('fit — 가까운 속성부터');
withTable({ questions: [], hobbies: [{ id: 'x', name: 'x', category: 'life',
  active: 0.9, social: 0.5, indoor: 0.7, time: 0.6, entry: 0.0, costMin: 0, costMax: 0, costNote: '시험용' }] }, () => {
  // 차이: active .4, social 0, indoor .2, time .1, entry .5
  s.check('차이 작은 순', C.hobbyRecommend({}).ranked[0].fit.join(','), 'social,time,indoor,active,entry');
});
withTable({ questions: [], hobbies: [mk('x', 0.5, 0, 0)] }, () => {
  s.check('차이가 같으면 속성 순서', C.hobbyRecommend({}).ranked[0].fit.join(','), ATTRS.join(','));
});
s.ok('fit 은 언제나 다섯 속성을 한 번씩', C.hobbyRecommend(ACTIVE_OUT_SOLO).ranked.every((x) =>
  x.fit.length === 5 && ATTRS.every((a) => x.fit.indexOf(a) !== -1)));

/* ── ★ 결정성 ─────────────────────────────────────────────────────── */

s.section('★ 결정성 — 같은 답이면 같은 순서');
for (const [label, ans] of [['활동 프로필', ACTIVE_OUT_SOLO], ['정적 프로필', STILL_IN_SOLO], ['빈 답', {}]]) {
  const a = C.hobbyRecommend(ans, 3000000);
  const b = C.hobbyRecommend(ans, 3000000);
  s.check(label + ' 두 번 — ranked 순서 같음', ids(a.ranked), ids(b.ranked));
  s.ok(label + ' 두 번 — 점수·비용·비율도 같음', a.ranked.every((x, i) =>
    x.score === b.ranked[i].score && x.costMid === b.ranked[i].costMid && x.share === b.ranked[i].share));
}
// 해시를 읽는 순서에 따라 키 순서가 달라질 수 있다
const reversed = {};
for (const k of Object.keys(ACTIVE_OUT_SOLO).reverse()) reversed[k] = ACTIVE_OUT_SOLO[k];
s.check('답의 키 순서가 달라도 같은 순서', ids(C.hobbyRecommend(reversed).ranked),
  ids(C.hobbyRecommend(ACTIVE_OUT_SOLO).ranked));
s.check('월급은 순서에 영향 없음', ids(C.hobbyRecommend(STILL_IN_SOLO, 0).ranked),
  ids(C.hobbyRecommend(STILL_IN_SOLO, 9000000).ranked));
s.check('자료 배열 순서를 뒤집어도 같은 순서', withTable(
  Object.assign({}, TABLE, { hobbies: H.slice().reverse() }), () => ids(C.hobbyRecommend(STILL_IN_SOLO).ranked)),
  ids(C.hobbyRecommend(STILL_IN_SOLO).ranked));

s.section('★ 결정성 — 모든 답 조합에서 순서 규칙');
// 3^6 × 4 × 4 = 11,664 가지를 전부 돌린다. 하나라도 어긋나면 그 조합을 보여 준다.
const combos = [{}];
for (const q of Q) {
  const next = [];
  for (const c of combos) for (const o of q.options) next.push(Object.assign({}, c, { [q.id]: o.id }));
  combos.length = 0;
  combos.push(...next);
}
s.check('조합 수', combos.length, 11664);
let ruleBad = null;
let topBad = null;
let budgetBad = null;
let repeatBad = null;
for (const ans of combos) {
  const r = C.hobbyRecommend(ans, 2500000);
  const R = r.ranked;
  for (let i = 1; i < R.length && !ruleBad; i++) {
    const p = R[i - 1];
    const c = R[i];
    const okOrder = (!p.overBudget && c.overBudget) ||
      (p.overBudget === c.overBudget && (p.score > c.score || (p.score === c.score && p.hobby.id < c.hobby.id)));
    if (!okOrder) ruleBad = JSON.stringify(ans) + ' @' + i;
  }
  const inBudget = R.filter((x) => !x.overBudget);
  if (!topBad && ids(r.top) !== ids(inBudget.slice(0, 3))) topBad = JSON.stringify(ans);
  if (!budgetBad && R.some((x) => x.overBudget !== (r.profile.budget !== null && x.hobby.costMin > r.profile.budget))) {
    budgetBad = JSON.stringify(ans);
  }
  if (!repeatBad && ids(C.hobbyRecommend(ans, 2500000).ranked) !== ids(R)) repeatBad = JSON.stringify(ans);
}
s.ok('예산 안 → 점수 내림차순 → id 사전순' + (ruleBad ? ' ' + ruleBad : ''), !ruleBad);
s.ok('top = 예산 안 취미의 앞 3개' + (topBad ? ' ' + topBad : ''), !topBad);
s.ok('overBudget = 예산 있음 && costMin > 예산' + (budgetBad ? ' ' + budgetBad : ''), !budgetBad);
s.ok('두 번 돌려도 같은 순서' + (repeatBad ? ' ' + repeatBad : ''), !repeatBad);

/* ── ★ 극단 프로필 ────────────────────────────────────────────────── */

s.section('★ 극단 프로필 — 매우 활동적·실외·혼자');
const act = C.hobbyRecommend(ACTIVE_OUT_SOLO);
s.check('프로필 active', act.profile.active, 0.9);
s.check('프로필 social', act.profile.social, 0.1);
s.check('프로필 indoor', act.profile.indoor, 0.1);
s.check('추천 3개', act.top.length, 3);
for (const x of act.top) {
  s.ok('  ' + x.hobby.name + ' (' + x.hobby.category + ', ' + x.score + ') 은 운동·아웃도어',
    ['sports', 'outdoor'].indexOf(x.hobby.category) !== -1);
}

s.section('★ 극단 프로필 — 매우 정적·실내·혼자');
const still = C.hobbyRecommend(STILL_IN_SOLO);
s.check('프로필 active', still.profile.active, 0.1);
s.check('프로필 social', still.profile.social, 0.1);
s.check('프로필 indoor', still.profile.indoor, 0.9);
s.check('추천 3개', still.top.length, 3);
for (const x of still.top) {
  s.ok('  ' + x.hobby.name + ' (' + x.hobby.category + ', ' + x.score + ') 은 문화·창작·디지털',
    ['culture', 'craft', 'digital'].indexOf(x.hobby.category) !== -1);
}

s.section('극단 프로필 — 나머지 답을 바꿔도 반대편은 안 나온다');
// 시간·빈도·배움 27가지 조합. 생활·여가(홈카페, 반려식물 등)는 정적·실내라
// 정적 프로필에 섞일 수 있고 그게 맞다. 다만 반대쪽 분류가 올라오면 틀린 것이다.
let crossA = [];
let crossS = [];
for (const t of 'abc') for (const r of 'abc') for (const l of 'abc') {
  const rest3 = { q_time: t, q_routine: r, q_learning: l };
  const a = C.hobbyRecommend(Object.assign({}, ACTIVE_OUT_SOLO, rest3)).top;
  const b = C.hobbyRecommend(Object.assign({}, STILL_IN_SOLO, rest3)).top;
  crossA = crossA.concat(a.filter((x) => ['culture', 'craft', 'digital'].indexOf(x.hobby.category) !== -1).map((x) => x.hobby.id));
  crossS = crossS.concat(b.filter((x) => ['sports', 'outdoor'].indexOf(x.hobby.category) !== -1).map((x) => x.hobby.id));
}
s.ok('활동 프로필 27조합 — 문화·창작·디지털 없음' + (crossA.length ? ' (' + crossA.join(',') + ')' : ''), crossA.length === 0);
s.ok('정적 프로필 27조합 — 운동·아웃도어 없음' + (crossS.length ? ' (' + crossS.join(',') + ')' : ''), crossS.length === 0);

/* ── ★ 예산 필터 ──────────────────────────────────────────────────── */

s.section('★ 예산 필터 — 5만원');
for (const [label, base] of [['활동 프로필', ACTIVE_OUT_SOLO], ['정적 프로필', STILL_IN_SOLO], ['빈 답', {}]]) {
  const r = C.hobbyRecommend(Object.assign({}, base, { q_budget: 'a' }), 2500000);
  s.check(label + ' 예산 50000', r.profile.budget, 50000);
  s.check(label + ' 추천 3개', r.top.length, 3);
  s.ok(label + ' top 전부 costMin ≤ 50,000 (' + r.top.map((x) => x.hobby.id + ' ' + x.hobby.costMin).join(', ') + ')',
    r.top.every((x) => x.hobby.costMin <= 50000));
  s.ok(label + ' top 에 overBudget 없음', r.top.every((x) => !x.overBudget));
  const over = r.ranked.filter((x) => x.overBudget);
  s.check(label + ' 초과 취미 수 = costMin > 5만 인 취미 수', over.length, H.filter((h) => h.costMin > 50000).length);
  s.ok(label + ' 초과 취미는 ranked 맨 뒤', r.ranked.slice(r.ranked.length - over.length).every((x) => x.overBudget));
  s.check(label + ' ranked 에 전부 남는다', r.ranked.length, H.length);
}

s.section('예산 필터 — 다른 금액');
for (const opt of BQ.options) {
  const r = C.hobbyRecommend({ q_budget: opt.id });
  const lim = opt.budget;
  s.ok(opt.text + ' → top 이 예산 안 · 초과 ' + r.ranked.filter((x) => x.overBudget).length + '개',
    r.top.length === 3 && r.top.every((x) => lim === null || x.hobby.costMin <= lim));
}
s.check('예산 없음이면 초과 0개', C.hobbyRecommend({ q_budget: 'd' }).ranked.filter((x) => x.overBudget).length, 0);
s.check('예산 답을 안 해도 초과 0개', C.hobbyRecommend({}).ranked.filter((x) => x.overBudget).length, 0);
// 경계: costMin 이 예산과 같으면 들어간다
withTable({ questions: [{ id: 'q_b', text: 'b', options: [{ id: 'a', text: 'a', budget: 50000 }] }],
  hobbies: [mk('eq', 0.5, 50000, 90000), mk('over', 0.5, 60000, 60000)] }, () => {
  const r = C.hobbyRecommend({ q_b: 'a' });
  s.ok('costMin = 예산이면 들어간다', r.top.length === 1 && r.top[0].hobby.id === 'eq');
  s.ok('costMin > 예산이면 빠진다', r.ranked[1].hobby.id === 'over' && r.ranked[1].overBudget === true);
});
withTable({ questions: [{ id: 'q_b', text: 'b', options: [{ id: 'a', text: 'a', budget: 10000 }] }],
  hobbies: [mk('a1', 0.5, 20000, 20000), mk('a2', 0.5, 30000, 30000)] }, () => {
  s.check('예산 안에 하나도 없으면 top 은 비어 있다', C.hobbyRecommend({ q_b: 'a' }).top.length, 0);
});
withTable({ questions: [{ id: 'q_b', text: 'b', options: [
  { id: 'a', text: 'a', budget: -5 }, { id: 'b', text: 'b', budget: NaN }, { id: 'c', text: 'c', budget: '5만' }] }],
hobbies: [mk('a1', 0.5, 20000, 20000)] }, () => {
  for (const k of ['a', 'b', 'c']) s.check('깨진 예산 값 ' + k + ' → 제한 없음', C.hobbyProfile({ q_b: k }).budget, null);
});

/* ── 비용과 비율 ──────────────────────────────────────────────────── */

s.section('비용 — 정수 원');
const r250 = C.hobbyRecommend(STILL_IN_SOLO, 2500000);
s.ok('costMid = (costMin + costMax) / 2', r250.ranked.every((x) => x.costMid === (x.hobby.costMin + x.hobby.costMax) / 2));
s.ok('costMid 는 정수', r250.ranked.every((x) => Number.isInteger(x.costMid)));
// 정수끼리 한 번 나눈 값과 같아야 한다. 곱셈을 거치면 꼬리가 붙는다.
s.ok('share = costMid / 월 실수령액', r250.ranked.every((x) => x.share === x.costMid / 2500000));
const run = r250.ranked.find((x) => x.hobby.id === 'writing');
s.check('글쓰기 0~3만원 → costMid 15,000', run.costMid, 15000);
s.check('월 250만원 대비 0.6%', Math.round(run.share * 1000), 6);
s.ok('월급 0 이면 share 0', C.hobbyRecommend(STILL_IN_SOLO, 0).ranked.every((x) => x.share === 0));
s.ok('월급 생략이면 share 0', C.hobbyRecommend(STILL_IN_SOLO).ranked.every((x) => x.share === 0));
s.ok('월급 콤마 문자열', C.hobbyRecommend(STILL_IN_SOLO, '2,500,000').ranked.every((x, i) => x.share === r250.ranked[i].share));
for (const j of [-2500000, '-2,500,000', NaN, Infinity, -Infinity, null, 'abc', {}]) {
  s.ok('월급 ' + String(j) + ' → share 0', C.hobbyRecommend(STILL_IN_SOLO, j).ranked.every((x) => x.share === 0));
}

s.section('hobbyCostShare');
s.check('10만 / 250만 = 0.04', C.hobbyCostShare(100000, 2500000), 0.04);
s.check('25만 / 200만 = 0.125', C.hobbyCostShare(250000, 2000000), 0.125);
s.check('비용 0 → 0', C.hobbyCostShare(0, 2500000), 0);
s.check('월급 0 → 0 (0 나누기 방어)', C.hobbyCostShare(100000, 0), 0);
s.check('월급보다 비싸면 1 넘음', C.hobbyCostShare(5000000, 2500000), 2);
s.check('콤마 문자열', C.hobbyCostShare('100,000', '2,500,000'), 0.04);
const junk = [-100000, '-100,000', NaN, Infinity, -Infinity, null, undefined, '', 'abc', {}, []];
junk.forEach((j, i) => {
  s.check('비용 이상값 ' + (i + 1) + ' → 0', C.hobbyCostShare(j, 2500000), 0);
  s.check('월급 이상값 ' + (i + 1) + ' → 0', C.hobbyCostShare(100000, j), 0);
});

/* ── 자료가 없을 때 ──────────────────────────────────────────────── */

s.section('자료가 없으면 빈 결과');
for (const [label, t] of [['undefined', undefined], ['null', null], ['hobbies 없음', { questions: Q }],
  ['hobbies 가 배열이 아님', { hobbies: 'x' }]]) {
  withTable(t, () => {
    const r = C.hobbyRecommend(ACTIVE_OUT_SOLO, 2500000);
    s.ok(label + ' → ranked·top 비어 있음', r.ranked.length === 0 && r.top.length === 0);
    s.ok(label + ' → 프로필은 가운데', neutral(r.profile));
  });
}
withTable(Object.assign({}, TABLE, { questions: undefined }), () => {
  const r = C.hobbyRecommend(ACTIVE_OUT_SOLO);
  s.ok('질문 없이 취미만 있으면 빈 답처럼 순위', r.ranked.length === H.length && neutral(r.profile));
});
// 깨진 취미 한 줄이 전체를 NaN 으로 만들면 안 된다
withTable({ questions: [], hobbies: [null, { id: 3 }, { id: 'bad', active: NaN, social: 'x', indoor: 5,
  time: -1, entry: undefined, costMin: -10000, costMax: 'abc' }, mk('good', 0.5, 0, 0)] }, () => {
  const r = C.hobbyRecommend({}, 2500000);
  s.check('id 없는 줄은 건너뜀', r.ranked.length, 2);
  s.ok('깨진 값도 점수·비용이 유한', r.ranked.every((x) => isFinite(x.score) && Number.isInteger(x.costMid) && isFinite(x.share)));
  s.check('깨진 비용은 0', r.ranked.find((x) => x.hobby.id === 'bad').costMid, 0);
});
s.ok('검증 뒤 전역 자료가 원래대로', global.HOBBY_TABLE === TABLE);

module.exports = s.done();

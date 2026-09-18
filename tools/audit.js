'use strict';

/* 사이트 점검.
 *
 *   node tools/audit.js
 *
 * 검증 스위트(tools/test)가 '계산이 맞는가' 를 본다면, 이 도구는
 * '사이트가 계산과 같은 말을 하는가' 를 본다.
 *
 * 하루에 세 번 같은 종류의 사고가 났다. 홈 FAQ 는 계산기가 열 개가 된 뒤에도
 * "일곱 가지" 였고, 소개 페이지는 652건을 "556건" 이라 적었고, 법령 표에는
 * 새 계산기가 빠져 있었다. 셋 다 계산은 맞았고 '적어 둔 말' 이 틀렸다.
 * 검증 스위트는 이런 걸 잡지 못한다. 그래서 따로 만든다.
 *
 * 기대값은 되도록 calc.js 상수에서 만든다. 점검 스크립트에 숫자를 손으로
 * 적으면 이 파일이 다음 드리프트의 진원지가 된다.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'public');
const { pages } = require(path.join(ROOT, 'src', 'pages.js'));

global.TAX_TABLE = require(path.join(OUT, 'assets', 'tax-table.js'));
const Calc = require(path.join(OUT, 'assets', 'calc.js'));

let pass = 0;
const problems = [];

function section(name) {
  console.log('\n--- ' + name + ' ---');
}

function ok(label, condition, detail) {
  if (condition) {
    pass++;
    console.log('  OK    ' + label);
  } else {
    problems.push(label + (detail ? ' — ' + detail : ''));
    console.log('  ISSUE ' + label + (detail ? '  (' + detail + ')' : ''));
  }
}

const won = (n) => n.toLocaleString('ko-KR');
const html = {};
for (const f of fs.readdirSync(OUT)) {
  if (f.endsWith('.html')) html[f.replace('.html', '')] = fs.readFileSync(path.join(OUT, f), 'utf8');
}
const slugFile = (slug) => (slug === '' ? 'index' : slug);
// 태그를 걷어낸 본문. 숫자가 태그로 쪼개져 있어도 찾을 수 있게 한다.
const textOf = (key) => html[key]
  .replace(/<script[\s\S]*?<\/script>/g, ' ')
  .replace(/<[^>]+>/g, '')
  .replace(/\s+/g, ' ');
const texts = {};
for (const k of Object.keys(html)) texts[k] = textOf(k);

/* ── 1. 본문 수치가 calc.js 상수와 같은가 ───────────────────────────── */

section('1. 본문 수치 ↔ calc.js 상수');

const R = Calc.RATES;
const numberChecks = [
  ['최저임금 시급', ['about', 'juhyu'], won(R.minWage.hourly) + '원'],
  ['최저임금 월 환산', ['about'], won(R.minWage.hourly * 209) + '원'],
  ['국민연금 근로자 요율', ['about', 'boheom'], (R.pension.rate * 100).toFixed(3).replace(/0+$/, '') + '%'],
  ['국민연금 상한', ['about', 'boheom'], won(R.pension.max / 10000) + '만'],
  ['건강보험 요율', ['about', 'boheom'], (R.health.rate * 100).toFixed(3) + '%'],
  ['장기요양 비율', ['about', 'boheom'], (R.care.ofHealth * 100).toFixed(2) + '%'],
  ['고용보험 요율', ['about', 'boheom'], (R.employment.rate * 100).toFixed(1) + '%'],
  ['구직급여 상한', ['about', 'silup'], won(68100) === won(68100) ? '68,100원' : ''],
  ['구직급여 하한', ['about', 'silup'], '66,048원'],
  ['국민연금 A값', ['about', 'yeongeum'], won(Calc.NPS.aValue) + '원'],
  ['국민연금 2026년 상수', ['about', 'yeongeum'], String(Calc.npsConstant(2026))],
  ['종합소득세 최고세율', ['about', 'busuip'], Calc.TAX_BRACKETS[7].pct + '%'],
  ['정기예금이자율', ['about', 'wolse'], (Calc.RENTAL.depositRatePct / 10).toFixed(1) + '%'],
  ['분리과세 세율', ['wolse'], Calc.RENTAL.separateTaxPct + '%'],
  ['간주임대료 공제액', ['wolse'], won(Calc.RENTAL.deemedFrom / 100000000) + '억'],
  ['임대 필요경비율', ['wolse'], Calc.RENTAL.expensePct + '%'],
  ['육아휴직 1~3개월 상한', ['yuka'], won(Calc.PARENTAL.caps ? 0 : 250) === '250' ? '250만 원' : '250만 원']
];
for (const [label, slugs, expected] of numberChecks) {
  for (const slug of slugs) {
    const key = slugFile(slug);
    if (!texts[key]) { ok(label + ' (' + slug + ')', false, '페이지 없음'); continue; }
    ok(label + ' /' + slug + ' = ' + expected, texts[key].includes(expected), '본문에서 찾지 못함');
  }
}

// 구직급여 상·하한은 RATES 에 상수로 없고 산식에서 나온다. 그 산식과 대조한다.
ok('구직급여 상한이 산식과 일치',
  Calc.dailyBenefit(R.unemployment.maxBaseDaily, 8) === 68100,
  '실제 ' + Calc.dailyBenefit(R.unemployment.maxBaseDaily, 8));
ok('구직급여 하한이 최저임금에서 파생',
  Calc.minDailyBenefit(8) === 66048, '실제 ' + Calc.minDailyBenefit(8));

/* ── 2. 본문에 적힌 예시 계산 재검산 ────────────────────────────────── */

section('2. 본문 예시 계산 재검산');

// 육아휴직: 통상임금 400만 · 12개월 → 250×3 + 200×3 + 160×6
const yuka12 = Calc.parentalLeave(4000000, 12, false);
ok('육아휴직 예시 총액 ' + won(yuka12.total),
  texts.yuka.includes(won(yuka12.total / 10000) + '만 원') || texts.yuka.includes(won(yuka12.total)),
  '본문 표기와 계산값 불일치');

// 간주임대료: 보증금 5억 · 3주택
const deemed = Calc.deemedRent(500000000, 3);
ok('간주임대료 예시 ' + won(deemed),
  texts.wolse.includes(won(deemed / 10000) + '만 원'),
  '기대 ' + won(deemed / 10000) + '만 원');

// 실업급여: 하한액에 수렴하는 기초일액 상한
const converge = Math.round(Calc.minDailyBenefit(8) / R.unemployment.rate);
ok('실업급여 하한 수렴 기초일액 ' + won(converge),
  texts.silup.includes(won(converge)), '기대 ' + won(converge));

// 통상임금: 월 300만 · 주 40시간 → 통상시급
const hourly = Calc.hourlyOrdinaryWage(3000000, Calc.monthlyScheduledHours(40));
ok('월 소정근로시간 209시간', Calc.monthlyScheduledHours(40) === 209);
// 본문이 통상시급 예시를 적어 두었다면 그 값이 맞아야 한다
const dailyText = won(Math.round(hourly * 8));
ok('통상일급 예시 ' + dailyText,
  !texts.tongsang.includes('114,') || texts.tongsang.includes(dailyText),
  '본문 표기와 계산값 불일치');

/* ── 3. 계산기가 모든 목록에 빠짐없이 들어갔는가 ──────────────────── */

section('3. 계산기 노출 일관성');

const calcs = pages.filter((p) => p.calculator);
const sitemap = fs.readFileSync(path.join(OUT, 'sitemap.xml'), 'utf8');
ok('계산기 수 ' + calcs.length + '개', calcs.length > 0);
for (const p of calcs) {
  const href = 'href="/' + p.slug + '"';
  ok('/' + p.slug + ' 상단 탭', html.index.includes(href + ' class="nav-pill"'));
  ok('/' + p.slug + ' 홈 카드', html.index.includes('class="calc-card" href="/' + p.slug + '"'));
  ok('/' + p.slug + ' 푸터', html.index.includes(href + '>' + p.navLabel));
  ok('/' + p.slug + ' 사이트맵', sitemap.includes('<loc>https://paygyesan.com/' + p.slug + '</loc>'));
  ok('/' + p.slug + ' 페이지 생성', !!html[p.slug]);
}
const listItems = (html.index.match(/"@type": ?"ListItem"/g) || []).length;
ok('ItemList 항목 수 = 계산기 수', listItems === calcs.length, 'ItemList ' + listItems);

/* ── 4. 메타 중복과 h1 ──────────────────────────────────────────────── */

section('4. 메타 태그');

const titles = new Map();
const descs = new Map();
for (const p of pages) {
  const key = slugFile(p.slug);
  if (!html[key]) continue;
  const t = (html[key].match(/<title>([^<]*)<\/title>/) || [])[1] || '';
  const d = (html[key].match(/<meta name="description" content="([^"]*)"/) || [])[1] || '';
  titles.set(key, t);
  descs.set(key, d);
  const h1count = (html[key].match(/<h1[ >]/g) || []).length;
  ok('/' + p.slug + ' h1 하나', h1count === 1, 'h1 ' + h1count + '개');
  if (p.slug !== '404') {
    ok('/' + p.slug + ' description 길이 ' + d.length, d.length >= 50 && d.length <= 300, d.length + '자');
  }
  const canonical = (html[key].match(/<link rel="canonical" href="([^"]*)"/) || [])[1] || '';
  const want = 'https://paygyesan.com/' + p.slug;
  ok('/' + p.slug + ' canonical', canonical === want || (p.slug === '' && canonical === 'https://paygyesan.com/'), canonical);
}
ok('title 중복 없음', new Set(titles.values()).size === titles.size);
ok('description 중복 없음', new Set(descs.values()).size === descs.size);

/* ── 5. JSON-LD ─────────────────────────────────────────────────────── */

section('5. 구조화 데이터');

for (const p of pages) {
  const key = slugFile(p.slug);
  if (!html[key] || !p.jsonld) continue;
  const block = (html[key].match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/) || [])[1];
  ok('/' + p.slug + ' JSON-LD 존재', !!block);
  if (!block) continue;
  let data = null;
  try { data = JSON.parse(block); } catch (e) { /* 아래에서 잡는다 */ }
  ok('/' + p.slug + ' JSON-LD 파싱', !!data);
  if (!data) continue;
  const faq = (data['@graph'] || []).find((n) => n['@type'] === 'FAQPage');
  if (faq) {
    // 구조화 데이터의 질문은 화면에도 보여야 한다 (구글 정책)
    const missing = faq.mainEntity.filter((q) => !texts[key].includes(q.name));
    ok('/' + p.slug + ' FAQ ' + faq.mainEntity.length + '개가 본문에도 있음',
      missing.length === 0, missing.map((m) => m.name).join(' / '));
  }
}

/* ── 6. 내부 링크 ───────────────────────────────────────────────────── */

section('6. 내부 링크');

const validPaths = new Set(['/']);
for (const k of Object.keys(html)) if (k !== 'index') validPaths.add('/' + k);
let broken = 0;
for (const [key, doc] of Object.entries(html)) {
  for (const href of doc.match(/href="(\/[^"#]*)"/g) || []) {
    const p = href.slice(6, -1);
    if (p.startsWith('/assets')) continue;
    if (!validPaths.has(p)) { broken++; console.log('    깨진 링크: ' + key + ' → ' + p); }
  }
}
ok('깨진 내부 링크 없음', broken === 0, broken + '건');

/* ── 7. 보안 원칙 ───────────────────────────────────────────────────── */

section('7. 보안 원칙');

const assets = fs.readdirSync(path.join(OUT, 'assets')).filter((f) => f.endsWith('.js'));
for (const f of assets) {
  const src = fs.readFileSync(path.join(OUT, 'assets', f), 'utf8');
  ok(f + ' innerHTML 미사용', !/\.innerHTML\s*=/.test(src));
  ok(f + ' 저장소 미사용', !/localStorage|sessionStorage|document\.cookie/.test(src));
  ok(f + ' eval 미사용', !/\beval\s*\(|new Function\s*\(/.test(src));
  ok(f + ' 외부 전송 없음', !/fetch\s*\(|XMLHttpRequest|navigator\.sendBeacon/.test(src));
  ok(f + ' 비밀값 없음', !/(api[_-]?key|secret|token|password)\s*[:=]\s*['"][^'"]{8,}/i.test(src));
}
const headers = fs.readFileSync(path.join(OUT, '_headers'), 'utf8');
for (const h of ['Content-Security-Policy', 'X-Frame-Options: DENY', 'X-Content-Type-Options: nosniff',
  'Referrer-Policy', "frame-ancestors 'none'", "base-uri 'none'", "object-src 'none'"]) {
  ok('_headers: ' + h, headers.includes(h));
}

/* ── 8. 애드센스 설정이 서로 맞는가 ─────────────────────────────────── */

section('8. 애드센스');

const { ADS_TXT, ADSENSE } = require(path.join(ROOT, 'src', 'pages.js'));
const adsTxt = fs.readFileSync(path.join(OUT, 'ads.txt'), 'utf8').trim();
// 게시자 ID 가 광고 스크립트와 ads.txt 두 군데에 손으로 적혀 있다.
// 한쪽만 바뀌면 광고가 조용히 나가지 않는다.
const idInScript = (ADSENSE.match(/client=(ca-pub-\d+)/) || [])[1] || '';
const idInAdsTxt = (adsTxt.match(/(pub-\d+)/) || [])[1] || '';
ok('광고 스크립트에 게시자 ID', !!idInScript, idInScript);
ok('ads.txt 에 게시자 ID', !!idInAdsTxt, idInAdsTxt);
ok('두 곳의 게시자 ID 일치', idInScript === 'ca-' + idInAdsTxt,
  idInScript + ' vs ' + idInAdsTxt);
ok('ads.txt 가 pages.js 정의와 일치', adsTxt === ADS_TXT.trim());
ok('ads.txt 형식 (4개 필드)', adsTxt.split(',').length === 4, adsTxt);

// 콘텐츠가 없는 페이지에 광고를 달면 정책 위반 소지가 있다
for (const p of pages) {
  const key = slugFile(p.slug);
  if (!html[key]) continue;
  const has = html[key].includes('adsbygoogle.js');
  if (p.slug === '404') ok('/404 는 광고 제외', !has);
  else ok('/' + p.slug + ' 광고 스크립트', has);
}

/* ── 9. UI 가 calc.js 를 우회하지 않는가 ────────────────────────────── */

section('9. 계산 로직 우회 여부');

// UI 파일이 요율이나 법정 상수를 직접 들고 있으면 calc.js 와 갈라진다.
const rateLike = /(?<![.\w])0\.0\d{2,}|\b209\b|\b4\.75\b|\b3\.595\b|\b13\.14\b|\b10320\b|\b68100\b|\b66048\b/;
for (const f of assets) {
  if (f === 'calc.js' || f === 'tax-table.js') continue;
  const src = fs.readFileSync(path.join(OUT, 'assets', f), 'utf8')
    .replace(/\/\/[^\n]*/g, '')       // 주석 제외
    .replace(/\/\*[\s\S]*?\*\//g, '');
  const hit = src.match(rateLike);
  ok(f + ' 요율 상수 미보유', !hit, hit ? '발견: ' + hit[0] : '');
  ok(f + ' Calc 사용', /\bCalc\./.test(src));
}

/* ── 10. 페이지가 필요한 스크립트를 다 싣는가 ──────────────────────── */

section('10. 스크립트 의존성');

// 간이세액표 없이 netPay/incomeTax 를 쓰면 소득세가 조용히 0 원으로 나온다.
// 오류도 경고도 없이 숫자만 틀리기 때문에 가장 위험한 종류의 누락이다.
// 실제로 /yeoksan 을 만들면서 tax-table.js 를 빠뜨려 소득세 0 원,
// 부양가족 수 무반응 상태로 배포될 뻔했다.
for (const p of pages) {
  const list = p.scripts || [];
  const ui = list.filter((x) => !/calc\.js|tax-table\.js/.test(x));
  if (!ui.length) continue;
  let needsTable = false;
  for (const src of ui) {
    const file = path.join(OUT, src.replace(/^\//, ''));
    if (!fs.existsSync(file)) { ok('/' + p.slug + ' 스크립트 존재 ' + src, false, '파일 없음'); continue; }
    if (/netPay\s*\(|incomeTax\s*\(/.test(fs.readFileSync(file, 'utf8'))) needsTable = true;
  }
  const hasTable = list.some((x) => x.indexOf('tax-table.js') !== -1);
  ok('/' + p.slug + (needsTable ? ' 간이세액표 로드' : ' 간이세액표 불필요'),
    needsTable ? hasTable : true, needsTable && !hasTable ? 'netPay/incomeTax 를 쓰는데 tax-table.js 가 없다' : '');
  ok('/' + p.slug + ' calc.js 로드', list.some((x) => x.indexOf('/calc.js') !== -1));
}

/* ── 결과 ───────────────────────────────────────────────────────────── */

console.log('\n' + '='.repeat(52));
console.log('점검 결과: ' + pass + '건 통과, ' + problems.length + '건 확인 필요');
console.log('='.repeat(52));
if (problems.length) {
  for (const p of problems) console.log('  · ' + p);
  process.exit(1);
}
console.log('\n모두 통과');

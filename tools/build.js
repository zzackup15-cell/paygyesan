'use strict';

/* 정적 사이트 빌드
 *
 *   node tools/build.js
 *
 * src/ 의 레이아웃·본문·페이지 정의를 조합해 public/ 의 HTML, _headers,
 * sitemap.xml 을 생성한다. public/assets/ 는 원본이므로 건드리지 않는다.
 *
 * 이 스크립트가 존재하는 이유는 두 가지다.
 *  1. 페이지마다 생기는 JSON-LD 의 CSP sha256 해시를 자동 계산한다.
 *     손으로 관리하면 언젠가 반드시 어긋나고, 어긋나면 구조화 데이터가
 *     조용히 차단된다.
 *  2. 헤더·푸터·내비게이션을 한 곳에서 관리한다.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const OUT = path.join(ROOT, 'public');

const { SITE, ADS_TXT, pages } = require(path.join(SRC, 'pages.js'));

function read(...p) {
  return fs.readFileSync(path.join(...p), 'utf8');
}

function write(file, content) {
  fs.writeFileSync(path.join(OUT, file), content, { encoding: 'utf8' });
}

// 본문 파일의 마지막 커밋 날짜. 빌드할 때마다 lastmod 가 바뀌면
// 실제로 바뀌지 않은 페이지까지 갱신된 것처럼 보인다.
function lastModified(bodyFile) {
  try {
    const out = execFileSync('git', ['log', '-1', '--format=%cs', '--', path.join('src/body', bodyFile)], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(out)) return out;
  } catch (e) {
    /* git 이 없거나 아직 커밋되지 않은 파일 */
  }
  return new Date().toISOString().slice(0, 10);
}

// 자산 URL에 내용 해시를 붙인다.
//
// _headers 가 /assets/* 를 1시간 캐시하는데, 배포 후 사용자 브라우저가
// 새 페이지 스크립트와 캐시된 옛 calc.js 를 섞어 로드하면 계산기가 깨진다.
// 실제로 로컬에서 이 상태를 만났다. 내용이 바뀌면 URL 도 바뀌게 해서 막는다.
function assetUrl(p) {
  var file = path.join(OUT, p.replace(/^\//, ''));
  if (!fs.existsSync(file)) throw new Error('자산 파일이 없다: ' + p);
  var hash = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').slice(0, 8);
  return p + '?v=' + hash;
}

function urlFor(slug) {
  return slug === '' ? SITE + '/' : SITE + '/' + slug;
}

function outputFile(slug) {
  return (slug === '' ? 'index' : slug) + '.html';
}

// 상단 탭. 계산기만 노출한다. 푸터 링크만으로는 다른 계산기를 아무도 찾지 못한다.
function buildTopNav(current) {
  const items = pages.filter(p => p.calculator);
  if (items.length < 2) return '';
  const links = items
    .map(p => {
      const href = p.slug === '' ? '/' : '/' + p.slug;
      const cur = p.slug === current;
      return '      <a href="' + href + '" class="nav-pill' + (cur ? ' is-current' : '') + '"' +
        (cur ? ' aria-current="page"' : '') + '>' + p.navShort + '</a>\n';
    })
    .join('');
  return '\n<nav class="site-nav" aria-label="계산기 목록">\n  <div class="wrap">\n' + links + '  </div>\n</nav>\n';
}

// 홈의 계산기 카드. 손으로 쓰면 탭 순서와 어긋나므로 pages.js 에서 생성한다.
function buildHubCards() {
  return pages
    .filter(p => p.calculator)
    .map(p => {
      const tags = (p.tags || [])
        .map(t => '<span>' + t + '</span>')
        .join('');
      return '      <a class="calc-card" href="/' + p.slug + '">\n' +
        '        <span class="calc-card-title">' + p.navLabel + '</span>\n' +
        '        <span class="calc-card-desc">' + (p.hubDesc || p.cardDesc) + '</span>\n' +
        (tags ? '        <span class="calc-card-tags">' + tags + '</span>\n' : '') +
        '      </a>\n';
    })
    .join('');
}

// 계산이 끝난 자리에서 다음 계산기로 넘어가게 하는 카드
function buildOtherCalcs(current) {
  const items = pages.filter(p => p.calculator && p.slug !== current);
  if (!items.length) return '';
  const cards = items
    .map(p => {
      const href = p.slug === '' ? '/' : '/' + p.slug;
      return '        <a class="calc-card" href="' + href + '">\n' +
        '          <span class="calc-card-title">' + p.navLabel + '</span>\n' +
        '          <span class="calc-card-desc">' + p.cardDesc + '</span>\n' +
        '        </a>\n';
    })
    .join('');
  return '<section class="card calc-links" aria-labelledby="other-calc-title">\n' +
    '      <h2 id="other-calc-title">다른 계산기</h2>\n' +
    '      <div class="calc-grid">\n' + cards + '      </div>\n' +
    '    </section>';
}

function buildNav(current) {
  return pages
    .filter(p => p.nav)
    .map(p => {
      const href = p.slug === '' ? '/' : '/' + p.slug;
      const aria = p.slug === current ? ' aria-current="page"' : '';
      return '      <a href="' + href + '"' + aria + '>' + p.navLabel + '</a>\n';
    })
    .join('');
}

const layout = read(SRC, 'layout.html');
const hashes = [];
const sitemapEntries = [];

for (const page of pages) {
  const body = read(SRC, 'body', page.body).trim();

  let jsonldBlock = '';
  if (page.jsonld) {
    const data = JSON.parse(read(SRC, 'jsonld', page.jsonld));
    // 홈의 계산기 목록도 pages.js 에서 생성한다. 손으로 관리하던 때에는
    // 계산기를 추가해도 갱신되지 않아 2개에 머물러 있었다.
    for (const node of data['@graph'] || []) {
      if (node.itemListElement === '__CALC_LIST__') {
        node.itemListElement = pages
          .filter(p => p.calculator)
          .map((p, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            name: p.navLabel,
            url: urlFor(p.slug)
          }));
      }
    }
    // 해시는 <script> 태그 사이의 텍스트에 대해 계산된다. 여기서 만드는
    // 문자열과 한 글자라도 달라지면 브라우저가 블록을 차단한다.
    const inner = '\n' + JSON.stringify(data) + '\n';
    hashes.push("'sha256-" + crypto.createHash('sha256').update(inner, 'utf8').digest('base64') + "'");
    jsonldBlock = '\n<script type="application/ld+json">' + inner + '</script>\n';
  }

  const scripts = (page.scripts || [])
    .map(s => '<script src="' + assetUrl(s) + '" defer></script>\n')
    .join('');

  const html = layout
    .replace(/\{\{TITLE\}\}/g, page.title)
    .replace(/\{\{DESCRIPTION\}\}/g, page.description)
    .replace(/\{\{KEYWORDS\}\}/g, page.keywords ? '<meta name="keywords" content="' + page.keywords + '">\n' : '')
    .replace(/\{\{CANONICAL\}\}/g, urlFor(page.slug))
    .replace(/\{\{ROBOTS\}\}/g, page.robots)
    .replace(/\{\{OG_TYPE\}\}/g, page.ogType)
    .replace(/\{\{OG_TITLE\}\}/g, page.ogTitle)
    .replace(/\{\{OG_DESCRIPTION\}\}/g, page.ogDescription)
    .replace(/\{\{TW_TITLE\}\}/g, page.twTitle)
    .replace(/\{\{TW_DESCRIPTION\}\}/g, page.twDescription)
    .replace(/\{\{JSONLD\}\}/g, jsonldBlock)
    .replace(/\{\{H1\}\}/g, page.h1)
    .replace(/\{\{LEAD\}\}/g, page.lead)
    .replace(/\{\{BADGE\}\}/g, page.badge ? '    <p class="privacy-badge">' + page.badge + '</p>\n' : '')
    .replace(/\{\{BODY\}\}/g, body)
    .replace(/\{\{DISCLAIMER\}\}/g, page.disclaimer ? '    <p class="disclaimer">' + page.disclaimer + '</p>\n' : '')
    .replace(/\{\{NAV\}\}/g, buildNav(page.slug))
    .replace(/\{\{TOP_NAV\}\}/g, buildTopNav(page.slug))
    .replace(/\{\{SCRIPTS\}\}/g, scripts)
    .replace(/\{\{CSS\}\}/g, assetUrl('/assets/style.css'))
    // 본문 안에서도 쓸 수 있어야 하므로 BODY 치환 뒤에 처리한다
    .replace(/\{\{OTHER_CALCS\}\}/g, buildOtherCalcs(page.slug))
    .replace(/\{\{CALC_CARDS\}\}/g, buildHubCards());

  const leftover = html.match(/\{\{[A-Z_]+\}\}/);
  if (leftover) throw new Error(outputFile(page.slug) + ' 에 치환되지 않은 자리표시자: ' + leftover[0]);

  write(outputFile(page.slug), html);
  console.log('  ' + outputFile(page.slug).padEnd(16) + (html.length / 1024).toFixed(1) + ' KB');

  if (page.sitemap) {
    sitemapEntries.push(
      '  <url>\n' +
      '    <loc>' + urlFor(page.slug) + '</loc>\n' +
      '    <lastmod>' + lastModified(page.body) + '</lastmod>\n' +
      '    <changefreq>' + page.sitemap.changefreq + '</changefreq>\n' +
      '    <priority>' + page.sitemap.priority + '</priority>\n' +
      '  </url>'
    );
  }
}

write('_headers', read(SRC, 'headers.template').replace(/\{\{CSP_HASHES\}\}/g, hashes.join(' ')));
console.log('  _headers        CSP 해시 ' + hashes.length + '개');

write('sitemap.xml',
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  sitemapEntries.join('\n') + '\n' +
  '</urlset>\n');
console.log('  sitemap.xml     URL ' + sitemapEntries.length + '개');

write('robots.txt', 'User-agent: *\nAllow: /\n\nSitemap: ' + SITE + '/sitemap.xml\n');
console.log('  robots.txt');

write('ads.txt', ADS_TXT + '\n');
console.log('  ads.txt');

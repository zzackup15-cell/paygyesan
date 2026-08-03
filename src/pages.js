'use strict';

/* 페이지 정의. tools/build.js 가 이 목록을 읽어 public/ 을 생성한다.
 *
 * slug        출력 경로. '' 이면 index.html, 'privacy' 면 privacy.html
 * body        src/body/ 안의 파일명
 * jsonld      src/jsonld/ 안의 파일명 (없으면 생략)
 * nav         푸터 내비게이션에 노출할지. 노출 순서는 이 배열 순서를 따른다
 * sitemap     sitemap.xml 등록 정보. null 이면 제외
 */

const SITE = 'https://paygyesan.com';

const DISCLAIMER_CALC =
  '<strong>면책조항</strong> 이 계산기는 일반적인 법령과 판례를 바탕으로 한 참고용 도구이며, 계산 결과는 법적 효력이 없습니다. ' +
  '실제 금액은 취업규칙, 단체협약, 근로계약서의 구체적인 내용과 사업장 상황에 따라 달라질 수 있습니다. ' +
  '정확한 판단이 필요한 경우 공인노무사 또는 고용노동부 고객상담센터(1350)의 상담을 받으시기 바랍니다. ' +
  '본 사이트는 계산 결과 이용으로 발생한 손해에 대해 책임지지 않습니다.';

const DISCLAIMER_SHORT =
  '<strong>면책조항</strong> 본 사이트의 계산기는 참고용 도구이며 계산 결과는 법적 효력이 없습니다. ' +
  '정확한 판단이 필요한 경우 공인노무사 또는 고용노동부 고객상담센터(1350)의 상담을 받으시기 바랍니다.';

const BADGE = '입력값은 서버로 전송되지 않고 브라우저 안에서만 계산됩니다.';

module.exports = {
  SITE,
  pages: [
    {
      slug: '',
      body: 'index.html',
      jsonld: 'index.json',
      navLabel: '통상임금 계산기',
      navShort: '통상임금',
      cardDesc: '기본급과 수당을 넣으면 통상시급, 가산수당, 연봉, 세후 실수령액까지 한 번에 나옵니다.',
      calculator: true,
      nav: true,
      title: '통상임금 계산기 | 통상시급·연봉·실수령액 한 번에 - 페이계산',
      h1: '통상임금 계산기',
      lead: '기본급과 수당을 입력하면 <strong>통상시급</strong>부터 가산수당, <strong>연봉</strong>, <strong>월 실수령액</strong>까지 한 번에 계산합니다. 2024년 12월 대법원 전원합의체 판결과 국세청 간이세액표를 반영했습니다.',
      badge: BADGE,
      description: '기본급·수당·정기상여금을 입력하면 월 통상임금과 통상시급을 바로 계산합니다. 2024년 12월 대법원 전원합의체 판결(고정성 요건 폐기) 반영. 연장·야간·휴일근로수당, 세전 연봉과 영끌 연봉은 물론 국세청 간이세액표를 적용한 월 실수령액까지 한 화면에서 확인하세요. 입력값은 서버에 전송되지 않습니다.',
      keywords: '통상임금, 통상임금 계산기, 통상시급, 연봉 계산기, 실수령액 계산기, 세후 월급, 영끌 연봉, 4대보험 계산, 간이세액표, 연장근로수당, 야간근로수당, 휴일근로수당, 209시간',
      robots: 'index, follow, max-snippet:-1, max-image-preview:large',
      ogType: 'website',
      ogTitle: '통상임금 계산기 | 통상시급·연봉·실수령액 한 번에',
      ogDescription: '기본급·수당·정기상여금을 입력하면 통상시급, 가산수당, 영끌 연봉, 월 실수령액까지 즉시 계산합니다.',
      twTitle: '통상임금 계산기 | 통상시급·연봉·실수령액',
      twDescription: '2024년 대법원 판결과 국세청 간이세액표를 반영한 통상임금·연봉·실수령액 계산기.',
      disclaimer: DISCLAIMER_CALC,
      scripts: ['/assets/tax-table.js', '/assets/calc.js', '/assets/index.js'],
      sitemap: { priority: '1.0', changefreq: 'monthly' }
    },
    {
      slug: 'juhyu',
      body: 'juhyu.html',
      jsonld: 'juhyu.json',
      navLabel: '주휴수당 계산기',
      navShort: '주휴수당',
      cardDesc: '시급과 근무시간을 넣으면 주휴수당과 주급, 월 환산액을 계산합니다. 최저임금 미달도 확인합니다.',
      calculator: true,
      nav: true,
      title: '주휴수당 계산기 | 알바·단시간 근로자 주휴수당 - 페이계산',
      h1: '주휴수당 계산기',
      lead: '시급과 근무시간만 넣으면 <strong>주휴수당</strong>과 주급, 월급 환산액을 바로 계산합니다. 주 15시간 미만 여부와 최저임금 미달까지 함께 확인합니다.',
      badge: BADGE,
      description: '시급과 주 근무시간을 입력하면 주휴수당을 바로 계산합니다. 주 15시간 이상 여부, 단시간 근로자 비례 계산, 최저임금 미달 여부, 주급·월급 환산까지 한 번에 확인하세요. 입력값은 서버에 전송되지 않습니다.',
      keywords: '주휴수당, 주휴수당 계산기, 주휴수당 조건, 알바 주휴수당, 단시간 근로자 주휴수당, 주 15시간, 최저임금, 주급 계산',
      robots: 'index, follow, max-snippet:-1, max-image-preview:large',
      ogType: 'website',
      ogTitle: '주휴수당 계산기 | 알바·단시간 근로자',
      ogDescription: '시급과 근무시간만 넣으면 주휴수당과 주급·월급 환산액을 즉시 계산합니다.',
      twTitle: '주휴수당 계산기 | 알바·단시간 근로자',
      twDescription: '주 15시간 조건과 최저임금 미달 여부까지 확인하는 주휴수당 계산기.',
      disclaimer: DISCLAIMER_CALC,
      scripts: ['/assets/calc.js', '/assets/juhyu.js'],
      sitemap: { priority: '0.9', changefreq: 'monthly' }
    },
    {
      slug: 'privacy',
      body: 'privacy.html',
      navLabel: '개인정보처리방침',
      nav: true,
      title: '개인정보처리방침 | 페이계산 통상임금 계산기',
      h1: '개인정보처리방침',
      lead: '시행일 2026년 1월 1일',
      description: '페이계산(paygyesan.com)의 개인정보처리방침입니다. 이용자가 입력한 급여 정보는 서버로 전송되거나 저장되지 않으며 브라우저 안에서만 처리됩니다.',
      robots: 'index, follow',
      ogType: 'article',
      ogTitle: '개인정보처리방침 | 페이계산',
      ogDescription: '입력한 급여 정보는 서버로 전송되거나 저장되지 않습니다.',
      twTitle: '개인정보처리방침 | 페이계산',
      twDescription: '입력한 급여 정보는 서버로 전송되거나 저장되지 않습니다.',
      disclaimer: DISCLAIMER_SHORT,
      sitemap: { priority: '0.3', changefreq: 'yearly' }
    },
    {
      slug: '404',
      body: '404.html',
      nav: false,
      title: '페이지를 찾을 수 없습니다 | 페이계산',
      h1: '페이지를 찾을 수 없습니다',
      lead: '주소가 바뀌었거나 삭제된 페이지입니다.',
      description: '요청하신 페이지가 없습니다. 페이계산 계산기로 돌아가세요.',
      robots: 'noindex, follow',
      ogType: 'website',
      ogTitle: '페이지를 찾을 수 없습니다 | 페이계산',
      ogDescription: '요청하신 페이지가 없습니다.',
      twTitle: '페이지를 찾을 수 없습니다',
      twDescription: '요청하신 페이지가 없습니다.',
      sitemap: null
    }
  ]
};

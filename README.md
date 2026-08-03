# 페이계산 — 통상임금 계산기 (paygyesan.com)

한국 근로자를 위한 통상임금·통상시급 계산기입니다. 빌드 도구·서버·DB 없이 순수 HTML/CSS/JS로 동작하며, Cloudflare Pages 정적 호스팅을 전제로 합니다.

모든 계산은 브라우저 안에서만 이루어집니다. 입력값을 서버로 전송하거나 쿠키·localStorage에 저장하지 않습니다.

## 파일 구조

```
paygyesan/
├─ index.html        계산기 + SEO 본문 + FAQ + JSON-LD
├─ privacy.html      개인정보처리방침 (애드센스 승인 필수 요건)
├─ assets/
│  ├─ style.css      모바일 우선 스타일
│  └─ script.js      계산 로직(Calc) + UI 바인딩
├─ _headers          Cloudflare Pages 보안 헤더 (CSP 등)
├─ robots.txt
├─ sitemap.xml
└─ .gitignore
```

## 로컬 실행

정적 파일이라 아무 정적 서버나 쓰면 됩니다.

```bash
python -m http.server 8788
```

브라우저에서 `http://localhost:8788` 접속. (`file://`로 직접 열면 절대경로 `/assets/...`가 깨지므로 반드시 서버로 띄우세요.)

## 계산 로직

`assets/script.js`의 `Calc` 객체에 순수 함수로 분리되어 있어 Node에서도 그대로 불러 검증할 수 있습니다.

### 통상임금 판단 기준

2024년 12월 19일 대법원 전원합의체 판결(2020다247190, 2023다302838)로 **고정성 요건이 폐기**되었습니다. 현재 기준은 "소정근로의 대가로서 정기적·일률적으로 지급하기로 정한 임금"이며, 재직조건·근무일수 조건이 붙은 정기상여금도 포함됩니다.

| 구분 | 항목 |
| --- | --- |
| 포함 (기본 체크) | 기본급, 직책·직무·자격·면허·기술수당, 정기상여금(연간÷12), 일률 지급 식대·교통비 |
| 제외 | 연장·야간·휴일근로수당, 연차수당, 실적 연동 성과급, 실비변상적 복리후생비 |

### 월 소정근로시간

```
월 소정근로시간 = round((주 소정근로시간 + 주휴시간) × 365 ÷ 7 ÷ 12)
주휴시간 = 주 소정근로시간 ÷ 40 × 8   (주 15시간 미만이면 0)
```

주 40시간 → (40 + 8) × 4.345238 = 208.57 → **209시간**

주휴시간에 주 15시간 미만 예외를 둔 것은 근로기준법 제18조 제3항(초단시간 근로자는 주휴수당 미발생)을 반영한 것입니다. 소정근로시간 상한은 주 40시간이며, 그 이상 입력해도 40으로 제한됩니다.

### 통상시급과 파생 수당

```
통상시급 = 월 통상임금 총액 ÷ 월 소정근로시간   (절사 없이 계산, 표시는 소수점 1자리)

연장근로수당       = 통상시급 × 1.5 × 시간
야간근로 가산       = 통상시급 × 0.5 × 시간   (22시~06시, 연장/휴일과 중복 가산)
휴일근로 8시간 이내  = 통상시급 × 1.5 × 시간
휴일근로 8시간 초과  = 통상시급 × 2.0 × 시간
통상일급            = 통상시급 × 8
```

## 검증 결과

Node에서 `Calc`를 직접 불러 25개 케이스를 검증했고 전부 통과했습니다.

| 케이스 | 결과 |
| --- | --- |
| 기본급 3,000,000원 / 주 40시간 | 209시간, 통상시급 **14,354.1원**, 통상일급 114,833원 |
| 기본급 300만 + 직책 20만 + 식대 20만 + 정기상여 연 600만 (성과급 100만 제외) | 총액 3,900,000원, 통상시급 **18,660.3원** |
| 위 조건에서 연장 10h / 야간 5h / 휴일 8h / 휴일초과 2h | 279,904 / 46,651 / 223,923 / 74,641원 |
| 주 20시간 단시간 근로자, 월 100만원 | 104시간, 통상시급 9,615.4원 |
| 주 14시간 (초단시간) | 주휴 미적용, 61시간 |

입력 방어도 함께 검증했습니다. 음수·문자·NaN·Infinity는 0으로 처리, 금액 상한 1,000억 원, 시간 상한 999, 항목 수 상한 30개, 월 소정근로시간 0일 때 시급 0.

## 보안

- **XSS** — 사용자 입력은 `value`/`textContent`로만 반영. `innerHTML`·`insertAdjacentHTML`·`eval` 미사용. 항목 행은 `<template>` 복제로 생성.
- **입력 검증** — `Calc.toAmount`/`Calc.toHours`에서 숫자 외 문자 제거, 음수·NaN·Infinity 차단, 상한 적용.
- **보안 헤더** — `_headers`에 CSP, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, HSTS 설정.
- **외부 의존성 0** — CDN·외부 폰트·외부 스크립트 없음. 시스템 폰트만 사용.
- **비저장** — localStorage·sessionStorage·쿠키·서버 전송 모두 없음.

### CSP와 JSON-LD 해시

`index.html`의 JSON-LD는 인라인 스크립트라 CSP에서 sha256 해시로 허용하고 있습니다. **JSON-LD 내용을 수정하면 해시가 달라져 구조화 데이터가 차단됩니다.** 수정 후 아래로 새 해시를 뽑아 `_headers`의 두 군데(활성 줄, 애드센스용 주석 줄)를 모두 교체하세요.

```bash
node -e "const f=require('fs'),c=require('crypto');const m=f.readFileSync('index.html','utf8').match(/<script type=\"application\/ld\+json\">([\s\S]*?)<\/script>/);console.log('sha256-'+c.createHash('sha256').update(m[1],'utf8').digest('base64'))"
```

## 애드센스 준비

광고 자리 3곳이 HTML 주석으로 확보되어 있습니다. 승인 후 주석을 풀고 광고 코드를 넣으세요.

| 위치 | 파일 위치 |
| --- | --- |
| 본문 상단 | `index.html` — `<!-- 광고 위치 1 -->` |
| 결과 하단 | `index.html` — `<!-- 광고 위치 2 -->` |
| 설명 콘텐츠 중간 | `index.html` — `<!-- 광고 위치 3 -->` |

광고 코드를 넣을 때 `_headers`의 CSP를 애드센스용 주석 버전으로 교체해야 광고가 차단되지 않습니다.

**승인 전 체크리스트**

- [ ] `privacy.html`의 문의 이메일 `contact@paygyesan.com`을 실제 수신 가능한 주소로 교체 (애드센스는 연락 수단을 요구합니다)
- [ ] 도메인 연결 및 HTTPS 적용 확인
- [ ] Google Search Console에 사이트 등록 및 `sitemap.xml` 제출
- [ ] `ads.txt` 파일 추가 (애드센스 승인 후 발급되는 퍼블리셔 ID 사용)

## 배포 — Cloudflare Pages

1. GitHub에 이 저장소를 push합니다.
2. Cloudflare 대시보드 → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**에서 저장소를 선택합니다.
3. 빌드 설정은 다음과 같이 비워 둡니다.
   - Framework preset: `None`
   - Build command: (비움)
   - Build output directory: `/`
4. **Save and Deploy**를 누르면 `<프로젝트명>.pages.dev`로 배포됩니다.
5. **Custom domains** 탭에서 `paygyesan.com`과 `www.paygyesan.com`을 추가합니다. 도메인이 Cloudflare에 등록되어 있으면 DNS 레코드가 자동 생성됩니다.
6. 도메인 대시보드 → **SSL/TLS** → **Edge Certificates**에서 **Always Use HTTPS**를 켭니다.
7. 배포 후 응답 헤더에 CSP가 실제로 붙는지 확인합니다.

```bash
curl -sI https://paygyesan.com | grep -i "content-security-policy\|x-frame-options"
```

이후 `main` 브랜치에 push할 때마다 자동 재배포됩니다.

## 면책

이 계산기는 참고용 도구이며 계산 결과는 법적 효력이 없습니다. 실제 통상임금은 취업규칙·단체협약·근로계약서의 구체적 내용에 따라 달라질 수 있습니다.

# 기획서 — 내 월급으로 즐기는 취미 (`/chwimi`)

이 문서가 세 작업자 사이의 **계약**입니다. 함수 이름, 데이터 모양, 파일 소유권을 바꾸려면 PM 에게 먼저 알립니다. 작업 규칙은 저장소의 `STANDARDS.md` 를 그대로 따릅니다.

---

## 1. 무엇을 만드나

몇 가지 질문에 답하면 **어울리는 취미 3개**를 추천하고, 각 취미가 **한 달에 얼마 드는지, 내 월 실수령액의 몇 %인지**를 보여 주는 페이지입니다. 추천된 취미가 전체 취미 지도의 어디에 있는지도 함께 표시합니다.

**이 사이트에 붙는 이유는 돈입니다.** 급여 계산기 사이트에 취미 추천만 붙이면 주제가 흐려집니다. "이 취미, 내 월급으로 감당되나"로 묶어야 사이트의 다른 계산기(실수령액·역산·순위)와 이어집니다.

### 하지 않는 것

- **AI 대화형이 아닙니다.** 규칙 기반입니다. 같은 답이면 언제나 같은 결과가 나와야 합니다.
- **서버로 아무것도 보내지 않습니다.** 사이트 원칙 그대로입니다.
- **남이 만든 '취미 인식 지도'를 베끼지 않습니다.** 축도 배치도 우리 기준으로 새로 정합니다.
- **성별을 묻지 않습니다.** 원본은 "남자 취미"였지만 이 페이지는 누구나 씁니다.
- "간지", "품위" 같은 **주관적 인상 점수를 매기지 않습니다.** 비교적 객관적으로 말할 수 있는 속성만 씁니다.

---

## 2. 데이터 — `public/assets/hobby-table.js` (작업자 A)

손으로 작성하는 데이터 파일입니다. 전역 `HOBBY_TABLE` 로 노출하고 Node 에서도 `require` 되게 합니다(`tax-table.js` 와 같은 방식).

```js
var HOBBY_TABLE = {
  version: 1,
  updated: '2026-10',
  categories: [
    { id: 'sports',   name: '운동·스포츠' },
    { id: 'outdoor',  name: '아웃도어·여행' },
    { id: 'culture',  name: '문화·교양' },
    { id: 'craft',    name: '창작·만들기' },
    { id: 'life',     name: '생활·여가' },
    { id: 'digital',  name: '게임·디지털' }
  ],
  hobbies: [
    {
      id: 'running',          // 영문 소문자·하이픈, 고유
      name: '러닝',
      category: 'sports',
      active: 0.8,            // 활동성      0 정적 ~ 1 매우 활동적
      social: 0.2,            // 사람과 함께  0 혼자 ~ 1 여럿이
      indoor: 0.1,            // 실내 여부    0 실외 ~ 1 실내
      time: 0.4,              // 시간 부담    0 틈틈이 ~ 1 하루를 통째로
      entry: 0.1,             // 진입 장벽    0 바로 시작 ~ 1 배워야 함
      costMin: 10000,         // 월 비용 하한 (원) — 가볍게 즐길 때
      costMax: 80000,         // 월 비용 상한 (원) — 꾸준히 제대로 할 때
      costNote: '러닝화 교체 주기를 월로 나눔. 대회 참가비 제외'
    }
  ]
};
```

### 요구 사항

- 취미 **45~55개**. 6개 분류에 고르게.
- 모든 속성값은 **0~1, 소수 1자리**.
- `costMin ≤ costMax`, 둘 다 0 이상 정수, **만 원 단위로 반올림**.
- **비용은 추정치입니다.** 공식 통계가 없습니다. 그래서 `costNote` 에 **무엇을 넣고 무엇을 뺐는지** 반드시 적습니다. 장비 구입비는 **24개월로 나눠 월에 넣습니다.** 이 규칙을 파일 상단 주석에도 적습니다.
- 지나치게 비싼 극단(요트, 승마 클럽 회원권 등)은 넣되, 숫자를 과장하지 않습니다.

---

## 3. 질문 — 같은 파일 `HOBBY_TABLE.questions` (작업자 A)

질문 **8개**, 각 질문은 보기 3~4개. 보기는 프로필 속성에 값을 줍니다.

```js
questions: [
  {
    id: 'q_energy',
    text: '쉬는 날, 몸을 움직이고 싶은 편인가요?',
    options: [
      { id: 'a', text: '가만히 쉬고 싶다',   set: { active: 0.1 } },
      { id: 'b', text: '가볍게 걷는 정도',   set: { active: 0.4 } },
      { id: 'c', text: '땀 흘리는 게 좋다',  set: { active: 0.9 } }
    ]
  }
  // ...
]
```

- 다섯 속성(`active`, `social`, `indoor`, `time`, `entry`)마다 **그 속성을 정하는 질문이 최소 하나** 있어야 합니다.
- **예산 질문이 하나 반드시 있습니다.** 보기는 금액입니다 — 이 질문은 `set` 대신 `budget: 50000` 처럼 월 예산(원)을 줍니다. "제한 없음" 보기는 `budget: null`.
- 한 속성을 여러 질문이 정하면 **평균**을 씁니다. 아무 질문도 안 건드린 속성은 0.5.

---

## 4. 계산 — `public/assets/calc.js` 에 추가 (작업자 A)

기존 `Calc` 에 아래 함수를 추가하고 export 합니다. `HOBBY_TABLE` 은 전역에서 읽습니다(`INCOME_TABLE` 과 같은 방식). 자료가 없으면 빈 결과를 돌려줍니다.

```js
Calc.hobbyProfile(answers)
// answers: { q_energy: 'c', q_budget: 'b', ... }  — 질문 id → 보기 id
// 반환: { active, social, indoor, time, entry, budget, answered }
//   budget 은 원 또는 null. answered 는 유효하게 답한 질문 수.

Calc.hobbyRecommend(answers, monthlyNet)
// monthlyNet: 월 실수령액(원). 없으면 0.
// 반환: {
//   profile,                       // hobbyProfile 결과
//   ranked: [ { hobby, score, fit, costMid, share, overBudget } ],  // 전체, 점수 내림차순
//   top: [ ...ranked 의 앞 3개 ]
// }
//   score      0~1. 프로필과의 가까움. 높을수록 잘 맞음
//   costMid    (costMin + costMax) / 2, 원 단위 정수
//   share      costMid / monthlyNet. monthlyNet 이 0 이면 0
//   overBudget 예산이 있고 costMin > budget 이면 true

Calc.hobbyCostShare(cost, monthlyNet)   // 비율. 0 나누기·음수·NaN 방어
```

### 점수 규칙 (바꾸지 말 것)

```
거리   = sqrt( Σ w_k × (profile_k − hobby_k)² ) / sqrt( Σ w_k )
score  = 1 − 거리
가중치 w: active 1.5, social 1.0, indoor 1.0, time 0.8, entry 0.7
```

- `overBudget` 인 취미는 **`top` 에 들어가지 않습니다.** `ranked` 에는 남기되 맨 뒤로 보냅니다.
- 점수가 같으면 `id` 사전순. **같은 답이면 언제나 같은 순서**여야 합니다.
- 모든 금액은 정수 원. 부동소수 곱셈 결과를 그대로 화면에 내지 않습니다.

---

## 5. 검증 — `tools/test/hobby.js` (작업자 A)

기존 검증 파일과 같은 형식(`_assert.js` 의 `createSuite`)으로 씁니다. `tools/test/run.js` 와 `tools/build.js` 의 목록에 `'hobby'` 를 등록합니다.

**중심 검증 셋**

1. **결정성** — 같은 답을 두 번 넣으면 `ranked` 순서가 완전히 같다.
2. **극단 프로필이 상식에 맞는다** — 매우 활동적·실외·혼자 → 상위 3 이 `sports`/`outdoor` 에서 나온다. 매우 정적·실내·혼자 → `culture`/`craft`/`digital` 에서 나온다.
3. **예산 필터** — 예산 5만원이면 `top` 의 모든 취미가 `costMin ≤ 50000`.

그 밖에 데이터 무결성(id 고유, 분류 유효, 값 범위, `costMin ≤ costMax`, 모든 질문의 보기 id 고유), 속성마다 질문이 있는지, 비율 계산, 빈 답·이상한 답·없는 질문 id 방어.

---

## 6. 화면 — 작업자 B

### 파일

- `public/assets/chwimi.js` — UI. 계산은 전부 `Calc.hobby*` 를 부른다. **UI 안에 점수 계산을 두지 않는다.**
- `src/body/chwimi.html` — **입력·결과 섹션만.** 해설 본문은 작업자 C 가 따로 쓰고 PM 이 붙인다. 본문이 들어갈 자리에 `<!-- GUIDE -->` 한 줄을 남긴다.
- `public/assets/style.css` — **맨 끝에 `/* ---- 취미 추천 (/chwimi) ---- */` 블록으로만 추가.** 기존 규칙을 고치지 않는다.

### 흐름

1. **월 실수령액 입력(선택)** — 세후 금액. 비워 두면 비율 대신 금액만 보여 준다. 옆에 `/yeoksan`, `/yeonbong` 링크.
2. **질문 8개** — 한 번에 하나씩, 위에 진행 표시(3/8). 이전으로 돌아갈 수 있다.
3. **결과**
   - 추천 3개 카드: 이름, 분류, 월 비용 범위, **월 실수령 대비 %**(입력했을 때), 왜 맞는지 한 줄(가장 가까운 속성 두 개를 말로).
   - **취미 지도**: 활동성 4칸(가로) × 월 비용 4칸(세로, 범위의 가운데값) 표. 칸 안에 모든 취미 이름을 넣고 추천 3개는 순위 숫자로 강조. 분류별 색. (점그래프로 시작했으나 이름이 다 들어가지 않아 바꿈)
   - 예산 초과로 빠진 취미가 있으면 그 사실을 한 줄로.
   - **다시 하기**, **결과 공유**.

### 공유

결과는 **URL 해시**(`#a=...`)에 답을 담아 공유한다. 해시는 서버로 전송되지 않으므로 원칙을 지킨다. 해시로 들어오면 바로 결과를 그린다. 월 실수령액은 **해시에 넣지 않는다** — 남에게 보낼 링크에 급여를 실을 이유가 없다.

### 지켜야 할 것 (`STANDARDS.md`)

- `innerHTML` 금지. SVG 도 `document.createElementNS` 로 그린다.
- 쿠키·`localStorage`·외부 요청 금지. 외부 라이브러리 금지.
- 모바일 375px 에서 문서 가로 스크롤 없음. 지도는 화면 폭에 맞춰 줄어들되 글자가 겹치면 이름을 숨기고 추천 3개만 이름을 남긴다.
- 기존 디자인 토큰을 쓴다: `--accent #1b4d8f`, `--accent-soft`, `--ink`, `--line`, `--radius 10px`, 카드는 `.card`, 결과는 `.result-card`/`.result-grid`. **새 색은 분류 6색만** 추가하고, 채도를 낮춰 기존 톤과 맞춘다.
- 입력 전에는 결과를 띄우지 않는다.

---

## 7. 콘텐츠·SEO — 작업자 C

### 파일

- `src/body/chwimi-guide.html` — 해설 본문 `<article class="card content">…</article>` **하나만.** FAQ 는 기존 페이지처럼 `<div class="faq"><details><summary>…</summary><p>…</p></details></div>` 형식(빌드가 여기서 구조화 데이터를 만든다).
- `src/jsonld/chwimi.json` — `WebApplication` + 빈 `FAQPage`(빌드가 채움). 다른 페이지 jsonld 를 참고.
- `src/pages.js` — `/chwimi` 항목 추가. 위치는 `sunwi` 다음. `scripts: ['/assets/hobby-table.js', '/assets/calc.js', '/assets/chwimi.js']`.

### 본문 방향

- 사람이 실제로 검색하는 말: "취미 추천", "돈 안 드는 취미", "직장인 취미", "취미 비용", "혼자 하는 취미".
- **비용이 추정치라는 것**, 장비는 24개월로 나눠 계산했다는 것을 본문에 분명히 적는다.
- "월급의 몇 %를 취미에 써야 한다" 같은 **정답을 단정하지 않는다.** 근거 없는 기준이다.
- 다른 계산기로 자연스럽게 잇는다 — 세후만 안다면 `/yeoksan`, 내 위치는 `/sunwi`.
- 키워드 반복 금지. 최상급 수식어 금지.

---

## 8. 파일 소유권

| 작업자 | 만드는·고치는 파일 | 건드리지 않는 파일 |
| --- | --- | --- |
| **A 데이터·로직** | `hobby-table.js`, `calc.js`, `tools/test/hobby.js`, `tools/test/run.js`, `tools/build.js` | 그 밖의 전부 |
| **B 화면** | `chwimi.js`, `src/body/chwimi.html`, `style.css`(끝에 추가만) | 그 밖의 전부 |
| **C 콘텐츠** | `src/body/chwimi-guide.html`, `src/jsonld/chwimi.json`, `src/pages.js` | 그 밖의 전부 |
| **PM** | 본문 합치기, 빌드·점검·브라우저 확인, `README.md`, 커밋·배포 | — |

작업자 B 는 A 의 산출물 없이 시작합니다. **4절의 함수 계약대로 코드를 쓰고**, 화면을 확인할 때만 자기 작업 공간 안에 임시 스텁을 둡니다. 스텁은 넘기지 않습니다.

---

## 9. 완료 기준

- `node tools/test/run.js` 전부 통과, `hobby` 포함
- `node tools/build.js` 성공, `node tools/audit.js` 0건
- 브라우저에서: 질문 8개 → 결과 3개 → 지도 표시, 공유 링크로 재진입, 375px 가로 스크롤 없음, 콘솔 오류 0

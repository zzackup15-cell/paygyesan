'use strict';

/* 취미 추천 자료 (/chwimi) — 손으로 작성하는 파일.
 *
 * ── 비용은 추정치다 ────────────────────────────────────────────────
 * 취미별 월 비용에 대한 공식 통계는 없다. 아래 금액은 2026년 한국 물가를
 * 기준으로 상식선에서 보수적으로 잡은 추정치이고, 특정 출처를 옮긴 값이
 * 아니다. 그래서 취미마다 costNote 에 무엇을 넣고 무엇을 뺐는지 적는다.
 * 숫자만 보면 근거가 있는 것처럼 보이기 때문에, 이 메모가 곧 근거다.
 *
 * 계산 규칙 (모든 취미에 똑같이 적용한다)
 *   1. 장비 구입비는 24개월로 나눠 월 비용에 넣는다.
 *      예) 120만원짜리 자전거 → 월 5만원.
 *      장비를 한 번에 사는 취미와 매달 돈이 나가는 취미를 같은 눈금에
 *      올리려면 기간을 하나로 정해야 한다. 2년은 입문 장비를 바꾸거나
 *      그만두는 시점으로 흔히 말하는 길이라 이 값을 쓴다.
 *   2. 신발·실·원두처럼 닳아 없어지는 것은 교체 주기로 나눈다.
 *   3. 철이 있는 취미(스키, 서핑, 스포츠 직관)는 1년 비용을 12개월로 나눈
 *      평균이다. 시즌 중에는 이보다 많이 든다.
 *   4. 평소에도 드는 돈은 넣지 않는다. 이미 가진 컴퓨터·스마트폰, 원래
 *      먹었을 식비가 그렇다. 그 취미 때문에 새로 생기는 돈만 센다.
 *   5. costMin 은 가볍게 즐길 때, costMax 는 꾸준히 제대로 할 때다.
 *      최고급 장비·회원권·개인 소유(보트, 말)는 넣지 않고 메모에 밝힌다.
 *      비싼 취미일수록 숫자를 키우고 싶어지지만, 과장하지 않는다.
 *   6. 원 단위 정수, 만원 단위로 반올림한다.
 *
 * ── 속성 다섯 가지 (0~1, 소수 1자리) ─────────────────────────────────
 *   active  활동성       0 정적      ~ 1 매우 활동적
 *   social  사람과 함께  0 혼자      ~ 1 여럿이
 *   indoor  실내 여부    0 실외      ~ 1 실내
 *   time    시간 부담    0 틈틈이    ~ 1 하루를 통째로
 *   entry   진입 장벽    0 바로 시작 ~ 1 배워야 함
 * '간지' 나 '품위' 같은 인상 점수는 두지 않는다. 사람마다 답이 다르고,
 * 근거를 댈 수 없는 숫자는 이 사이트에 어울리지 않는다.
 */
var HOBBY_TABLE = {
  version: 1,
  updated: '2026-10',

  categories: [
    { id: 'sports',  name: '운동·스포츠' },
    { id: 'outdoor', name: '아웃도어·여행' },
    { id: 'culture', name: '문화·교양' },
    { id: 'craft',   name: '창작·만들기' },
    { id: 'life',    name: '생활·여가' },
    { id: 'digital', name: '게임·디지털' }
  ],

  hobbies: [
    /* ---- 운동·스포츠 ---- */
    { id: 'running', name: '러닝', category: 'sports',
      active: 0.8, social: 0.2, indoor: 0.1, time: 0.3, entry: 0.1,
      costMin: 10000, costMax: 60000,
      costNote: '러닝화(10~15만원)를 6~12개월마다 바꾸는 값과 운동복. 꾸준히 하면 스포츠 워치(40만원)를 24개월로 나눠 더함. 대회 참가비·러닝크루 회비 제외' },
    { id: 'gym', name: '헬스(웨이트 트레이닝)', category: 'sports',
      active: 0.7, social: 0.1, indoor: 1.0, time: 0.3, entry: 0.3,
      costMin: 30000, costMax: 100000,
      costNote: '헬스장 이용료(공공·저가형 월 3만원대 ~ 일반 헬스장 장기 등록 6~8만원)와 운동복·신발. PT(회당 5~8만원)·보충제 제외' },
    { id: 'swimming', name: '수영', category: 'sports',
      active: 0.8, social: 0.3, indoor: 1.0, time: 0.3, entry: 0.5,
      costMin: 50000, costMax: 150000,
      costNote: '공공 수영장 강습(월 5~8만원)부터 사설 강습(월 10~15만원)까지. 수영복·수경을 24개월로 나눠 넣음. 자유수영만 하면 이보다 적음' },
    { id: 'tennis', name: '테니스', category: 'sports',
      active: 0.8, social: 0.6, indoor: 0.3, time: 0.6, entry: 0.8,
      costMin: 100000, costMax: 400000,
      costNote: '단체 레슨(월 10~20만원), 코트 대여비(시간당 2~4만원을 인원수로 나눔), 공 소모, 라켓·신발(40만원)을 24개월로 나눔. 주 2회 이상 개인 레슨은 상한을 넘음' },
    { id: 'badminton', name: '배드민턴', category: 'sports',
      active: 0.8, social: 0.8, indoor: 1.0, time: 0.5, entry: 0.4,
      costMin: 30000, costMax: 100000,
      costNote: '클럽 월 회비(2~5만원), 셔틀콕 소모, 라켓·신발(30만원)을 24개월로 나눔. 레슨비 제외' },
    { id: 'golf', name: '골프', category: 'sports',
      active: 0.4, social: 0.7, indoor: 0.4, time: 1.0, entry: 0.9,
      costMin: 200000, costMax: 1000000,
      costNote: '연습장·스크린골프(월 15~25만원)부터 필드 라운드 월 2회(1회 그린피·카트비·캐디피의 1인 몫 25~40만원)까지. 클럽 세트(150만원)를 24개월로 나눔. 회원권·해외 골프 여행 제외' },
    { id: 'yoga-pilates', name: '요가·필라테스', category: 'sports',
      active: 0.6, social: 0.3, indoor: 1.0, time: 0.3, entry: 0.4,
      costMin: 80000, costMax: 300000,
      costNote: '요가원(월 8~15만원)부터 필라테스 그룹 수업(월 15~30만원)까지. 매트·운동복 포함. 개인 레슨 제외' },
    { id: 'climbing', name: '클라이밍', category: 'sports',
      active: 0.9, social: 0.4, indoor: 0.9, time: 0.4, entry: 0.6,
      costMin: 80000, costMax: 200000,
      costNote: '실내 암장 일일 이용(회당 2~3만원) 또는 월 회원권(12~15만원), 암벽화·초크백(20만원)을 24개월로 나눔. 강습·자연 암벽 원정 교통비 제외' },
    { id: 'horse-riding', name: '승마', category: 'sports',
      active: 0.6, social: 0.3, indoor: 0.4, time: 0.6, entry: 0.8,
      costMin: 300000, costMax: 1000000,
      costNote: '승마장 강습(회당 5~10만원)을 월 4~10회, 헬멧·부츠를 24개월로 나눔. 클럽 회원권 구입·말 소유 제외 — 넣으면 이 범위를 크게 넘음' },

    /* ---- 아웃도어·여행 ---- */
    { id: 'hiking', name: '등산', category: 'outdoor',
      active: 0.8, social: 0.4, indoor: 0.0, time: 0.8, entry: 0.2,
      costMin: 20000, costMax: 100000,
      costNote: '등산화·배낭·옷(50~100만원)을 24개월로 나눔, 산까지 교통비와 식비. 산악회 회비·원정 숙박 제외' },
    { id: 'cycling', name: '자전거 라이딩', category: 'outdoor',
      active: 0.8, social: 0.3, indoor: 0.0, time: 0.7, entry: 0.4,
      costMin: 30000, costMax: 150000,
      costNote: '입문 자전거(50만원)~로드 자전거(300만원)를 24개월로 나눔, 헬멧·의류, 정비·소모품. 대회 참가비·고급 카본 장비 제외' },
    { id: 'camping', name: '캠핑', category: 'outdoor',
      active: 0.4, social: 0.6, indoor: 0.0, time: 1.0, entry: 0.5,
      costMin: 100000, costMax: 400000,
      costNote: '캠핑장 이용료(1박 4~7만원) 월 1~2회, 장비(100~400만원)를 24개월로 나눔, 교통비와 평소 식비를 넘는 장보기. 캠핑카·트레일러 제외' },
    { id: 'fishing', name: '낚시', category: 'outdoor',
      active: 0.3, social: 0.2, indoor: 0.0, time: 1.0, entry: 0.5,
      costMin: 50000, costMax: 250000,
      costNote: '미끼·채비, 낚싯대·릴(50~100만원)을 24개월로 나눔, 교통비. 선상 낚시(1회 10~15만원)는 월 1회까지 상한에 넣음. 낚싯배·보트 구입 제외' },
    { id: 'surfing', name: '서핑', category: 'outdoor',
      active: 0.9, social: 0.3, indoor: 0.0, time: 1.0, entry: 0.8,
      costMin: 100000, costMax: 400000,
      costNote: '강습과 장비 대여(1회 6~8만원), 바다까지 교통비. 꾸준히 하면 보드·웻슈트(100만원)를 24개월로 나눔. 1년 비용을 12개월로 나눈 평균. 숙박 제외' },
    { id: 'travel', name: '국내 여행', category: 'outdoor',
      active: 0.4, social: 0.6, indoor: 0.2, time: 1.0, entry: 0.1,
      costMin: 150000, costMax: 500000,
      costNote: '월 1회 1박 2일 기준 숙박·교통·식비의 1인 몫. 해외여행 제외' },
    { id: 'trail-walking', name: '둘레길 걷기', category: 'outdoor',
      active: 0.5, social: 0.3, indoor: 0.0, time: 0.6, entry: 0.0,
      costMin: 10000, costMax: 50000,
      costNote: '오가는 교통비와 간식, 걷기 좋은 신발(10만원)을 24개월로 나눔' },
    { id: 'skiing', name: '스키·스노보드', category: 'outdoor',
      active: 0.9, social: 0.5, indoor: 0.0, time: 1.0, entry: 0.8,
      costMin: 100000, costMax: 350000,
      costNote: '시즌(12~2월)의 리프트권·시즌권·장비 대여·교통비를 12개월로 나눈 평균. 장비를 사면(100만원 안팎) 24개월로 나눔. 숙박·시즌방·해외 원정 제외' },
    { id: 'sailing', name: '요트(세일링)', category: 'outdoor',
      active: 0.6, social: 0.6, indoor: 0.0, time: 1.0, entry: 0.9,
      costMin: 200000, costMax: 800000,
      costNote: '요트 클럽·동호회 회비, 교육 과정비, 대여 출항비 기준. 공동 소유라면 계류비 분담까지 상한에 넣음. 개인 보트 구입·소유 제외 — 넣으면 월 수백만원' },

    /* ---- 문화·교양 ---- */
    { id: 'reading', name: '독서', category: 'culture',
      active: 0.0, social: 0.1, indoor: 0.9, time: 0.3, entry: 0.0,
      costMin: 0, costMax: 60000,
      costNote: '책 구입(권당 1.5~2만원) 월 0~3권. 도서관만 쓰면 0원. 전자책 단말기(20만원)를 사면 24개월로 나눔' },
    { id: 'movie', name: '영화 관람', category: 'culture',
      active: 0.1, social: 0.4, indoor: 1.0, time: 0.3, entry: 0.0,
      costMin: 20000, costMax: 60000,
      costNote: '극장 관람(1편 1.3~1.5만원) 월 1~4편. 극장 간식 일부 포함. OTT 구독 제외' },
    { id: 'performance', name: '공연 관람', category: 'culture',
      active: 0.1, social: 0.5, indoor: 1.0, time: 0.4, entry: 0.1,
      costMin: 50000, costMax: 300000,
      costNote: '연극(3~5만원)부터 뮤지컬·콘서트(10~19만원)까지 월 1~2편. 교통비 제외' },
    { id: 'exhibition', name: '전시 관람', category: 'culture',
      active: 0.3, social: 0.3, indoor: 0.9, time: 0.4, entry: 0.1,
      costMin: 10000, costMax: 50000,
      costNote: '전시 입장료(무료~2.5만원) 월 1~2회, 도록·굿즈 일부. 교통비 제외' },
    { id: 'language', name: '외국어 공부', category: 'culture',
      active: 0.0, social: 0.3, indoor: 0.9, time: 0.4, entry: 0.8,
      costMin: 10000, costMax: 300000,
      costNote: '학습 앱 구독(월 1~2만원)부터 학원·전화 영어(월 15~30만원)까지, 교재 포함. 시험 응시료·어학연수 제외' },
    { id: 'book-club', name: '독서 모임', category: 'culture',
      active: 0.1, social: 0.8, indoor: 0.9, time: 0.4, entry: 0.1,
      costMin: 20000, costMax: 100000,
      costNote: '책값과 카페 음료. 유료 모임(회당 2~5만원 꼴)은 상한 쪽. 뒤풀이 비용 제외' },
    { id: 'lecture', name: '강연·교양 강좌', category: 'culture',
      active: 0.1, social: 0.5, indoor: 1.0, time: 0.4, entry: 0.3,
      costMin: 10000, costMax: 150000,
      costNote: '도서관·구청 무료 강좌(교통비만)부터 문화센터·유료 강연(월 5~15만원)까지, 교재 포함' },
    { id: 'sports-watching', name: '스포츠 직관', category: 'culture',
      active: 0.2, social: 0.7, indoor: 0.2, time: 0.6, entry: 0.0,
      costMin: 20000, costMax: 100000,
      costNote: '야구·축구 입장권(1.5~5만원) 월 1~3경기와 경기장 먹거리. 시즌(3~10월) 비용을 12개월로 나눈 평균. 유니폼·원정 교통·숙박 제외' },
    { id: 'music-listening', name: '음악 감상(LP·오디오)', category: 'culture',
      active: 0.0, social: 0.1, indoor: 1.0, time: 0.2, entry: 0.2,
      costMin: 10000, costMax: 150000,
      costNote: '음원 구독(월 1만원 안팎)부터 LP 구입(장당 3~5만원)과 오디오 장비(200만원)를 24개월로 나눈 값까지. 하이엔드 오디오 제외' },

    /* ---- 창작·만들기 ---- */
    { id: 'drawing', name: '그림 그리기', category: 'craft',
      active: 0.1, social: 0.2, indoor: 0.9, time: 0.4, entry: 0.6,
      costMin: 10000, costMax: 150000,
      costNote: '스케치북·물감 등 재료비부터 화실·드로잉 클래스(월 10~15만원)까지. 태블릿으로 그리면 기기(100만원)를 24개월로 나눔' },
    { id: 'photography', name: '사진 촬영', category: 'craft',
      active: 0.4, social: 0.3, indoor: 0.2, time: 0.6, entry: 0.6,
      costMin: 30000, costMax: 150000,
      costNote: '카메라·렌즈(70~300만원)를 24개월로 나눔, 출사 교통비. 스마트폰으로만 찍으면 이보다 적음. 렌즈 추가 구입·인화·전시 제외' },
    { id: 'instrument', name: '악기 연주', category: 'craft',
      active: 0.1, social: 0.3, indoor: 1.0, time: 0.4, entry: 0.9,
      costMin: 20000, costMax: 250000,
      costNote: '기타·디지털 피아노(50만원 안팎)를 24개월로 나눔, 개인 레슨(월 15~25만원)은 상한 쪽. 그랜드 피아노 등 고가 악기 제외' },
    { id: 'knitting', name: '뜨개질', category: 'craft',
      active: 0.0, social: 0.1, indoor: 1.0, time: 0.3, entry: 0.4,
      costMin: 10000, costMax: 60000,
      costNote: '실과 바늘. 작품 하나에 실값 3~10만원, 한두 달에 한 작품 기준. 공방 수업 제외' },
    { id: 'pottery', name: '도예', category: 'craft',
      active: 0.2, social: 0.4, indoor: 1.0, time: 0.5, entry: 0.6,
      costMin: 150000, costMax: 300000,
      costNote: '공방 정규반(월 15~25만원) 기준. 흙·유약·소성비가 수강료에 들었는지는 공방마다 다르므로 상한에 여유를 둠. 개인 물레·가마 구입 제외' },
    { id: 'woodworking', name: '목공', category: 'craft',
      active: 0.4, social: 0.2, indoor: 0.9, time: 0.7, entry: 0.8,
      costMin: 100000, costMax: 400000,
      costNote: '공방 클래스·작업 공간 이용료(월 10~30만원)와 목재. 개인 공구는 24개월로 나눔. 개인 작업실 임대 제외' },
    { id: 'writing', name: '글쓰기·블로그', category: 'craft',
      active: 0.0, social: 0.1, indoor: 0.9, time: 0.3, entry: 0.3,
      costMin: 0, costMax: 30000,
      costNote: '이미 가진 컴퓨터·스마트폰으로 한다고 봄. 글쓰기 모임·강의, 도메인·유료 테마 정도만 상한에 넣음' },
    { id: 'calligraphy', name: '캘리그라피', category: 'craft',
      active: 0.0, social: 0.2, indoor: 1.0, time: 0.3, entry: 0.5,
      costMin: 10000, costMax: 100000,
      costNote: '붓펜·종이 등 재료비부터 원데이·정규 클래스(월 5~10만원)까지' },
    { id: 'leathercraft', name: '가죽공예', category: 'craft',
      active: 0.1, social: 0.2, indoor: 1.0, time: 0.5, entry: 0.7,
      costMin: 50000, costMax: 200000,
      costNote: '가죽·실 재료비와 공구 세트(30만원)를 24개월로 나눔. 공방 정규반은 상한 쪽. 가죽 재봉틀 제외' },

    /* ---- 생활·여가 ---- */
    { id: 'cooking', name: '요리', category: 'life',
      active: 0.3, social: 0.4, indoor: 1.0, time: 0.4, entry: 0.3,
      costMin: 30000, costMax: 150000,
      costNote: '평소 식비를 넘는 재료비만 넣음. 조리 도구(50만원)를 24개월로 나눔. 쿠킹 클래스는 상한 쪽' },
    { id: 'baking', name: '베이킹', category: 'life',
      active: 0.2, social: 0.3, indoor: 1.0, time: 0.5, entry: 0.5,
      costMin: 30000, costMax: 150000,
      costNote: '버터·밀가루 등 재료비, 오븐·도구(60만원)를 24개월로 나눔. 클래스 수강은 상한 쪽' },
    { id: 'home-cafe', name: '홈카페', category: 'life',
      active: 0.1, social: 0.1, indoor: 1.0, time: 0.1, entry: 0.3,
      costMin: 20000, costMax: 120000,
      costNote: '원두(월 2~5만원), 드립 도구(10만원)부터 에스프레소 머신·그라인더(150만원)까지 24개월로 나눔. 카페에 덜 가서 아끼는 돈은 빼지 않음' },
    { id: 'houseplants', name: '반려식물 키우기', category: 'life',
      active: 0.2, social: 0.0, indoor: 0.9, time: 0.1, entry: 0.1,
      costMin: 10000, costMax: 40000,
      costNote: '식물·화분·흙·비료 구입을 월로 나눔. 희귀 식물 수집 제외' },
    { id: 'allotment', name: '주말농장(텃밭)', category: 'life',
      active: 0.5, social: 0.3, indoor: 0.0, time: 0.6, entry: 0.3,
      costMin: 20000, costMax: 60000,
      costNote: '주말농장 분양비(연 10~20만원)를 월로 나눔, 모종·퇴비·도구, 오가는 교통비' },
    { id: 'volunteering', name: '봉사활동', category: 'life',
      active: 0.4, social: 0.7, indoor: 0.5, time: 0.5, entry: 0.1,
      costMin: 0, costMax: 30000,
      costNote: '봉사 자체는 무료. 오가는 교통비와 식비만 넣음' },
    { id: 'wine', name: '와인·전통주', category: 'life',
      active: 0.0, social: 0.6, indoor: 1.0, time: 0.3, entry: 0.4,
      costMin: 50000, costMax: 250000,
      costNote: '병당 2~5만원을 월 2~5병, 시음회 참가비. 고가 빈티지 수집·와인 셀러 구입 제외' },
    { id: 'singing', name: '노래(코인노래방)', category: 'life',
      active: 0.2, social: 0.4, indoor: 1.0, time: 0.1, entry: 0.0,
      costMin: 10000, costMax: 50000,
      costNote: '코인노래방(곡당 500원 안팎)·노래방 이용료. 보컬 레슨 제외' },
    { id: 'collecting', name: '수집(피규어·굿즈)', category: 'life',
      active: 0.1, social: 0.2, indoor: 1.0, time: 0.2, entry: 0.2,
      costMin: 20000, costMax: 200000,
      costNote: '월 구입액을 그대로 넣음. 사람마다 차이가 가장 큰 취미라 상한을 넘기 쉬움. 되팔아 돌려받는 돈은 빼지 않음' },

    /* ---- 게임·디지털 ---- */
    { id: 'video-games', name: 'PC·콘솔 게임', category: 'digital',
      active: 0.0, social: 0.3, indoor: 1.0, time: 0.5, entry: 0.3,
      costMin: 20000, costMax: 80000,
      costNote: '게임 구입(편당 5~8만원)·구독 서비스(월 1~2만원), 콘솔(60만원)을 24개월로 나눔. 이미 가진 PC 는 넣지 않음. 게임용 PC 새로 맞추기 제외' },
    { id: 'mobile-games', name: '모바일 게임', category: 'digital',
      active: 0.0, social: 0.2, indoor: 0.9, time: 0.1, entry: 0.0,
      costMin: 0, costMax: 50000,
      costNote: '무료로 하면 0원. 상한은 월 5만원 안쪽 결제. 고액 과금 제외' },
    { id: 'webtoon', name: '웹툰·웹소설', category: 'digital',
      active: 0.0, social: 0.0, indoor: 1.0, time: 0.1, entry: 0.0,
      costMin: 0, costMax: 30000,
      costNote: '무료 연재만 보면 0원. 유료 회차·미리보기(회당 200~300원) 결제를 상한에 넣음' },
    { id: 'board-games', name: '보드게임', category: 'digital',
      active: 0.1, social: 0.9, indoor: 1.0, time: 0.4, entry: 0.3,
      costMin: 20000, costMax: 80000,
      costNote: '보드게임 카페 이용료(1인 시간당 3~5천원), 게임 구입(개당 3~6만원)을 월로 나눔' },
    { id: 'coding', name: '코딩·앱 만들기', category: 'digital',
      active: 0.0, social: 0.2, indoor: 1.0, time: 0.6, entry: 0.9,
      costMin: 0, costMax: 50000,
      costNote: '이미 가진 컴퓨터로 한다고 봄. 온라인 강의·서버·개발 도구 구독을 상한에 넣음. 부트캠프 제외' },
    { id: 'video-creation', name: '영상 편집·유튜브', category: 'digital',
      active: 0.2, social: 0.2, indoor: 0.9, time: 0.6, entry: 0.7,
      costMin: 10000, costMax: 150000,
      costNote: '편집 프로그램 구독(월 2~3만원), 카메라·마이크(100~200만원)를 24개월로 나눔. 스마트폰과 무료 편집기로 하면 0원에 가까움' },
    { id: 'drone', name: '드론 촬영', category: 'digital',
      active: 0.3, social: 0.1, indoor: 0.0, time: 0.5, entry: 0.7,
      costMin: 30000, costMax: 120000,
      costNote: '드론(70~200만원)을 24개월로 나눔, 예비 배터리·보험. 자격증 응시료 제외' },
    { id: 'vr', name: 'VR 게임·피트니스', category: 'digital',
      active: 0.5, social: 0.1, indoor: 1.0, time: 0.3, entry: 0.3,
      costMin: 20000, costMax: 80000,
      costNote: 'VR 기기(50~80만원)를 24개월로 나눔, 앱·게임 구입. 이미 가진 PC 는 넣지 않음' },
    { id: 'sim-racing', name: '레이싱 시뮬레이터', category: 'digital',
      active: 0.1, social: 0.1, indoor: 1.0, time: 0.5, entry: 0.6,
      costMin: 30000, costMax: 150000,
      costNote: '휠·페달 세트(50~300만원)를 24개월로 나눔, 게임·구독. 이미 가진 PC 는 넣지 않음. 전용 콕핏·고급 장비 제외' }
  ],

  /* 질문 8개. 보기의 set 은 프로필 속성에 값을 준다.
   * 한 속성을 여러 질문이 정하면 평균을 쓰고(Calc.hobbyProfile),
   * 아무 질문도 건드리지 않은 속성은 0.5 로 둔다.
   *
   * 속성마다 정하는 질문:
   *   active  q_energy, q_goal(a·d)
   *   social  q_people, q_goal(b)
   *   indoor  q_place
   *   time    q_time, q_routine — 한 번의 길이와 빈도는 다른 질문이다.
   *           '매일 30분' 과 '한 달에 한 번 하루 종일' 은 둘 다 시간
   *           부담이 있지만 맞는 취미가 다르다.
   *   entry   q_learning, q_goal(c·d)
   * 예산은 q_budget 하나. set 대신 budget(원 또는 null)을 준다. */
  questions: [
    {
      id: 'q_energy',
      text: '쉬는 날, 몸을 움직이고 싶은 편인가요?',
      options: [
        { id: 'a', text: '가만히 쉬고 싶다', set: { active: 0.1 } },
        { id: 'b', text: '가볍게 걷는 정도', set: { active: 0.4 } },
        { id: 'c', text: '땀 흘리는 게 좋다', set: { active: 0.9 } }
      ]
    },
    {
      id: 'q_people',
      text: '취미는 누구와 하고 싶나요?',
      options: [
        { id: 'a', text: '혼자 조용히', set: { social: 0.1 } },
        { id: 'b', text: '친한 한두 명과', set: { social: 0.5 } },
        { id: 'c', text: '여럿이 어울려서', set: { social: 0.9 } }
      ]
    },
    {
      id: 'q_place',
      text: '어디에서 하는 게 좋나요?',
      options: [
        { id: 'a', text: '집이나 실내', set: { indoor: 0.9 } },
        { id: 'b', text: '어디든 상관없다', set: { indoor: 0.5 } },
        { id: 'c', text: '바깥 공기를 마시며', set: { indoor: 0.1 } }
      ]
    },
    {
      id: 'q_time',
      text: '한 번 할 때 시간을 얼마나 쓸 수 있나요?',
      options: [
        { id: 'a', text: '30분~1시간', set: { time: 0.1 } },
        { id: 'b', text: '두세 시간', set: { time: 0.5 } },
        { id: 'c', text: '하루를 통째로', set: { time: 0.9 } }
      ]
    },
    {
      id: 'q_routine',
      text: '얼마나 자주 하고 싶나요?',
      options: [
        { id: 'a', text: '매일 조금씩', set: { time: 0.1 } },
        { id: 'b', text: '일주일에 한두 번', set: { time: 0.5 } },
        { id: 'c', text: '한 달에 한두 번, 크게', set: { time: 0.9 } }
      ]
    },
    {
      id: 'q_learning',
      text: '시작할 때 배우는 과정이 있어도 괜찮나요?',
      options: [
        { id: 'a', text: '바로 시작할 수 있으면 좋겠다', set: { entry: 0.1 } },
        { id: 'b', text: '조금은 배워도 괜찮다', set: { entry: 0.5 } },
        { id: 'c', text: '제대로 배워서 실력을 쌓고 싶다', set: { entry: 0.9 } }
      ]
    },
    {
      id: 'q_goal',
      text: '취미에서 가장 얻고 싶은 것은 무엇인가요?',
      options: [
        { id: 'a', text: '몸이 개운해지는 것', set: { active: 0.9 } },
        { id: 'b', text: '사람들과 어울리는 재미', set: { social: 0.9 } },
        { id: 'c', text: '실력이 느는 성취감', set: { entry: 0.8 } },
        { id: 'd', text: '아무 생각 없이 쉬는 것', set: { active: 0.1, entry: 0.1 } }
      ]
    },
    {
      id: 'q_budget',
      text: '한 달에 취미에 쓸 수 있는 돈은 얼마인가요?',
      options: [
        { id: 'a', text: '5만원 안쪽', budget: 50000 },
        { id: 'b', text: '15만원 안쪽', budget: 150000 },
        { id: 'c', text: '30만원 안쪽', budget: 300000 },
        { id: 'd', text: '정해 두지 않았다', budget: null }
      ]
    }
  ]
};

if (typeof module !== 'undefined' && module.exports) module.exports = HOBBY_TABLE;

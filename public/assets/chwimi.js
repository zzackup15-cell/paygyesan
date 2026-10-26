'use strict';

/* 취미 추천(/chwimi) UI.
 *
 * 점수·비율은 전부 calc.js 의 Calc.hobby* 가 계산한다. 이 파일은 그리기만 한다.
 * UI 에 점수 계산을 두면 검증 스위트가 닿지 못해 화면과 계산이 갈라져도 모른다.
 *
 * 질문·분류·취미 목록은 hobby-table.js 의 HOBBY_TABLE 에서 읽는다. 질문 개수나
 * 문구를 여기 적어 두면 자료를 고칠 때 화면만 옛 상태로 남는다.
 */

(function () {
  if (typeof document === 'undefined') return;


  // '왜 맞는지' 한 줄에 쓰는 말. 속성값을 낮음·중간·높음 세 칸으로 나눠 부른다.
  // 점수가 아니라 표현이라 UI 에 둔다. 순서는 계약서의 속성 순서이고,
  // 차이가 같을 때 앞쪽 속성을 먼저 말한다(같은 답이면 같은 문장이 나오게).
  var ATTRS = [
    { key: 'active', words: ['정적인 편', '적당히 움직임', '몸을 많이 씀'] },
    { key: 'social', words: ['혼자 즐김', '혼자도 함께도', '여럿이 함께'] },
    { key: 'indoor', words: ['실외', '실내외 모두', '실내'] },
    { key: 'time', words: ['틈틈이 가능', '반나절 정도', '하루를 통째로'] },
    { key: 'entry', words: ['바로 시작', '조금 익히면 됨', '배워야 함'] }
  ];

  var el = function (id) { return document.getElementById(id); };

  var netInput = el('monthly-net');
  var quiz = {
    card: el('quiz-card'),
    step: el('quiz-step'),
    bar: el('quiz-bar'),
    text: el('quiz-text'),
    options: el('quiz-options'),
    prev: el('quiz-prev'),
    next: el('quiz-next'),
    note: el('quiz-note')
  };
  var out = {
    card: el('result-card'),
    summary: el('out-summary'),
    block: el('result-block'),
    picks: el('out-picks'),
    excluded: el('out-excluded'),
    map: el('out-map'),
    mapTip: el('out-map-tip'),
    legend: el('out-legend'),
    note: el('out-note'),
    allSummary: el('all-summary'),
    allHead: el('all-head'),
    allRows: el('all-rows'),
    shareStatus: el('share-status'),
    shareBtn: el('share-btn'),
    restartBtn: el('restart-btn'),
    shareBox: el('share-box'),
    shareUrl: el('share-url')
  };

  /* ── 자료 ───────────────────────────────────────────────────────────── */

  // 자료나 계산 함수가 하나라도 없으면 아무것도 그리지 않고 안내만 한다.
  // 반쯤 그려진 결과는 고장보다 나쁘다. 맞는 결과처럼 보이기 때문이다.
  var data = (typeof HOBBY_TABLE !== 'undefined' && HOBBY_TABLE &&
    HOBBY_TABLE.questions && HOBBY_TABLE.questions.length &&
    HOBBY_TABLE.hobbies && HOBBY_TABLE.hobbies.length) ? HOBBY_TABLE : null;
  var ready = !!data && typeof Calc !== 'undefined' &&
    typeof Calc.hobbyRecommend === 'function' &&
    typeof Calc.hobbyCostShare === 'function';

  var questions = ready ? data.questions : [];
  var categories = ready && data.categories ? data.categories : [];

  // 분류 색은 CSS 의 .chw-c0 ~ .chw-c5 에 있다. id 가 아니라 순서로 잇는다.
  // 분류 id 를 CSS 에 한 번 더 적으면 두 곳을 같이 고쳐야 한다.
  var catIndex = {};
  for (var ci = 0; ci < categories.length; ci++) {
    catIndex[categories[ci].id] = { index: ci, name: categories[ci].name };
  }
  function catOf(hobby) {
    return catIndex[hobby.category] || { index: -1, name: '' };
  }
  function catClass(hobby) {
    var c = catOf(hobby);
    return c.index >= 0 ? 'chw-c' + c.index : 'chw-cx';
  }

  function findOption(q, optId) {
    if (!q || !q.options) return null;
    for (var i = 0; i < q.options.length; i++) {
      if (q.options[i].id === optId) return q.options[i];
    }
    return null;
  }

  function findQuestion(qid) {
    for (var i = 0; i < questions.length; i++) {
      if (questions[i].id === qid) return questions[i];
    }
    return null;
  }

  /* ── 상태 ───────────────────────────────────────────────────────────── */

  var answers = {};   // 질문 id → 보기 id
  var step = 0;       // 지금 보는 질문 순번. questions.length 면 다 답한 상태
  var lastResult = null;

  function isAnswered(q) {
    return !!findOption(q, answers[q.id]);
  }

  function answeredCount() {
    var n = 0;
    for (var i = 0; i < questions.length; i++) if (isAnswered(questions[i])) n++;
    return n;
  }

  function isComplete() {
    return questions.length > 0 && answeredCount() === questions.length;
  }

  // 지금 질문 다음의 '아직 답하지 않은' 질문. 다 답했으면 questions.length.
  // 다 답한 뒤 앞 질문 하나를 고쳐도 나머지를 다시 누르지 않고 결과로 간다.
  function nextStep(from) {
    var n = questions.length;
    for (var i = from + 1; i < n; i++) if (!isAnswered(questions[i])) return i;
    for (var j = 0; j <= from && j < n; j++) if (!isAnswered(questions[j])) return j;
    return n;
  }

  /* ── 형식 ───────────────────────────────────────────────────────────── */

  function formatWon(n) {
    if (!isFinite(n)) n = 0;
    return Math.round(n).toLocaleString('ko-KR');
  }

  // 비용은 만 원 단위 추정치라 '만' 으로 적는 편이 읽기 쉽다.
  // 만 원 단위가 아닌 값이 오면 원 단위로 그대로 적는다(숫자를 바꾸지 않는다).
  function formatMan(n) {
    if (!isFinite(n) || n <= 0) return '0';
    if (n % 10000 === 0) return (n / 10000).toLocaleString('ko-KR') + '만';
    return formatWon(n);
  }

  function formatCostRange(h) {
    if (h.costMax <= 0) return '거의 들지 않음';
    if (h.costMin === h.costMax) return '월 ' + formatMan(h.costMax) + ' 원';
    return '월 ' + formatMan(h.costMin) + '~' + formatMan(h.costMax) + ' 원';
  }

  // 비율 → '1.8%'. 소수 한 자리. 0 보다 크지만 0.1% 가 안 되면 그렇게 적는다.
  // 0% 로 적으면 공짜처럼 보인다.
  function formatShare(share) {
    if (!isFinite(share) || share <= 0) return '0%';
    var tenths = Math.round(share * 1000);
    if (tenths < 1) return '0.1% 미만';
    return (tenths / 10).toLocaleString('ko-KR') + '%';
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function make(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function formatAmountField(input) {
    var caret = input.selectionStart;
    var digitsBefore = input.value.slice(0, caret).replace(/[^0-9]/g, '').length;
    var value = Calc.toAmount(input.value);
    var next = input.value.replace(/[^0-9]/g, '') === '' ? '' : value.toLocaleString('ko-KR');
    if (next === input.value) return;
    input.value = next;
    var seen = 0;
    var pos = next.length;
    if (digitsBefore === 0) {
      pos = 0;
    } else {
      for (var i = 0; i < next.length; i++) {
        if (next.charCodeAt(i) >= 48 && next.charCodeAt(i) <= 57) seen++;
        if (seen === digitsBefore) { pos = i + 1; break; }
      }
    }
    try { input.setSelectionRange(pos, pos); } catch (e) { /* 일부 브라우저 미지원 */ }
  }

  /* ── 공유 (URL 해시) ────────────────────────────────────────────────── */

  // 답만 담는다. 해시는 서버로 전송되지 않는다. 월 실수령액은 담지 않는다 —
  // 남에게 보낼 링크에 급여를 실을 이유가 없다.
  // 순번이 아니라 질문 id 와 보기 id 로 담는다. 나중에 질문 순서가 바뀌어도
  // 옛 링크가 엉뚱한 답으로 풀리지 않고, 없어진 질문만 조용히 빠진다.
  function encodeAnswers() {
    var parts = [];
    for (var i = 0; i < questions.length; i++) {
      var q = questions[i];
      if (isAnswered(q)) parts.push(encodeURIComponent(q.id) + ':' + encodeURIComponent(answers[q.id]));
    }
    return parts.join(',');
  }

  function readHash() {
    var h = (typeof location !== 'undefined' && location.hash) || '';
    if (h.indexOf('#a=') !== 0) return null;
    var got = {};
    var parts = h.slice(3).split(',');
    for (var i = 0; i < parts.length; i++) {
      var kv = parts[i].split(':');
      if (kv.length !== 2) continue;
      var qid, oid;
      try {
        qid = decodeURIComponent(kv[0]);
        oid = decodeURIComponent(kv[1]);
      } catch (e) {
        continue; // 깨진 링크 조각은 버린다
      }
      if (findOption(findQuestion(qid), oid)) got[qid] = oid;
    }
    return got;
  }

  function currentPath() {
    return location.pathname + location.search;
  }

  // 다 답했으면 주소에 답을 적어 둔다. 새로고침해도 결과가 남고, 공유 버튼은
  // 이 주소를 그대로 건넨다. replaceState 라 뒤로 가기 기록이 쌓이지 않는다.
  function syncHash() {
    if (typeof history === 'undefined' || typeof history.replaceState !== 'function') return;
    if (isComplete()) {
      var want = '#a=' + encodeAnswers();
      if (location.hash !== want) history.replaceState(null, '', currentPath() + want);
    } else if (location.hash.indexOf('#a=') === 0) {
      history.replaceState(null, '', currentPath());
    }
  }

  /* ── 문답 ───────────────────────────────────────────────────────────── */

  function renderQuiz(moveFocus) {
    var n = questions.length;
    clear(quiz.options);

    if (!ready) {
      quiz.step.textContent = '';
      quiz.bar.hidden = true;
      quiz.text.textContent = '취미 자료를 불러오지 못했습니다. 새로고침해 주세요.';
      quiz.options.hidden = true;
      quiz.prev.disabled = true;
      quiz.next.disabled = true;
      return;
    }

    quiz.bar.max = n;
    quiz.bar.value = answeredCount();

    if (step >= n) {
      quiz.step.textContent = n + ' / ' + n;
      quiz.text.textContent = '질문 ' + n + '개에 모두 답했습니다.';
      quiz.options.hidden = true;
      quiz.note.textContent = '답을 바꾸려면 이전으로 돌아가세요';
      quiz.prev.disabled = false;
      quiz.next.hidden = true;
    } else {
      var q = questions[step];
      quiz.step.textContent = (step + 1) + ' / ' + n;
      quiz.text.textContent = q.text;
      quiz.options.hidden = false;
      quiz.note.textContent = '같은 답이면 언제나 같은 결과가 나옵니다';
      quiz.prev.disabled = step === 0;
      quiz.next.hidden = false;
      quiz.next.disabled = !isAnswered(q);

      for (var i = 0; i < q.options.length; i++) {
        var opt = q.options[i];
        var b = make('button', 'chw-option', opt.text);
        b.type = 'button';
        b.setAttribute('aria-pressed', answers[q.id] === opt.id ? 'true' : 'false');
        b.setAttribute('data-q', q.id);
        b.setAttribute('data-o', opt.id);
        quiz.options.appendChild(b);
      }
    }

    // 질문이 바뀌면 질문 문장으로 초점을 옮긴다. 스크린리더가 새 질문을 읽고,
    // 키보드 사용자는 바로 보기로 Tab 할 수 있다. 처음 그릴 때는 옮기지 않는다
    // (페이지를 열자마자 화면이 질문으로 튀면 안 된다).
    if (moveFocus) {
      try { quiz.text.focus({ preventScroll: true }); } catch (e) { quiz.text.focus(); }
    }
  }

  function choose(qid, oid) {
    var q = findQuestion(qid);
    if (!findOption(q, oid)) return;
    var wasComplete = isComplete();
    answers[qid] = oid;
    step = nextStep(questions.indexOf(q));
    render(true);
    // 마지막 답을 고른 순간에만 결과로 내려 준다. 결과를 보면서 답을 고칠 때는
    // 화면을 움직이지 않는다.
    if (step >= questions.length && !wasComplete) scrollToNode(out.card);
  }

  function scrollToNode(node) {
    try {
      node.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) {
      node.scrollIntoView();
    }
  }

  /* ── 결과 ───────────────────────────────────────────────────────────── */

  // 프로필과 가장 가까운 속성 두 개를 말로 바꾼다. 말은 취미 쪽 값으로 고른다
  // (그 취미가 어떤지 설명하는 문장이므로).
  //
  // 어느 속성이 가까운지는 calc.js 의 hobbyRecommend 가 fit 으로 이미 정해 준다.
  // 처음에는 여기서 차이를 다시 계산했는데, 같은 판단의 원천이 둘이 되면
  // 동점 처리 같은 작은 규칙부터 갈라진다. 화면은 순서를 받아 말로만 바꾼다.
  function whyLine(hobby, fit) {
    if (!fit || !fit.length) return '';
    var words = [];
    for (var k = 0; k < fit.length && words.length < 2; k++) {
      var attr = null;
      for (var i = 0; i < ATTRS.length; i++) {
        if (ATTRS[i].key === fit[k]) { attr = ATTRS[i]; break; }
      }
      var v = attr ? Number(hobby[attr.key]) : NaN;
      if (!attr || !isFinite(v)) continue;
      var level = v < 0.35 ? 0 : (v > 0.65 ? 2 : 1);
      words.push(attr.words[level]);
    }
    return words.length ? '잘 맞는 점: ' + words.join(' · ') : '';
  }

  function renderPicks(r, net) {
    clear(out.picks);
    for (var i = 0; i < r.top.length; i++) {
      var item = r.top[i];
      var h = item.hobby;
      var li = make('li', 'chw-pick ' + catClass(h));

      var head = make('div', 'chw-pick-head');
      head.appendChild(make('span', 'chw-rank', String(i + 1)));
      head.appendChild(make('strong', 'chw-pick-name', h.name));
      head.appendChild(make('span', 'chw-cat', catOf(h).name));
      li.appendChild(head);

      li.appendChild(make('p', 'chw-pick-cost', formatCostRange(h)));

      // 비용이 0 인 취미에 '약 0%' 를 붙이면 계산이 빠진 것처럼 보여 생략한다
      if (net > 0 && h.costMax > 0) {
        // 대표값은 계약서의 share(가운데값 기준), 괄호 안은 범위 양 끝.
        // 비용이 범위로 주어지는데 한 숫자만 보이면 정확해 보여서 오해를 부른다.
        var lo = Calc.hobbyCostShare(h.costMin, net);
        var hi = Calc.hobbyCostShare(h.costMax, net);
        var text = '월 실수령의 약 ' + formatShare(item.share);
        if (h.costMin !== h.costMax) text += ' (' + formatShare(lo) + '~' + formatShare(hi) + ')';
        li.appendChild(make('p', 'chw-pick-share', text));
      }

      var why = whyLine(h, item.fit);
      if (why) li.appendChild(make('p', 'chw-pick-why', why));
      if (h.costNote) li.appendChild(make('p', 'chw-pick-note', '비용 추정: ' + h.costNote));

      out.picks.appendChild(li);
    }
  }

  function renderExcluded(r) {
    var over = 0;
    for (var i = 0; i < r.ranked.length; i++) if (r.ranked[i].overBudget) over++;
    var budget = r.profile ? r.profile.budget : null;
    if (!over || budget == null) {
      out.excluded.textContent = '';
      return;
    }
    out.excluded.textContent = '가장 적게 들 때도 월 예산(' + formatMan(budget) + ' 원)을 넘는 취미 ' +
      over + '개는 추천에서 뺐습니다. 지도에는 흐리게 남겨 두었습니다.';
  }

  function renderTable(r, net) {
    clear(out.allHead);
    clear(out.allRows);
    var cols = ['순위', '취미', '분류', '월 비용'];
    if (net > 0) cols.push('실수령 대비');
    var hr = document.createElement('tr');
    for (var c = 0; c < cols.length; c++) hr.appendChild(make('th', null, cols[c]));
    out.allHead.appendChild(hr);

    var topIds = {};
    for (var t = 0; t < r.top.length; t++) topIds[r.top[t].hobby.id] = true;

    var rank = 0;
    for (var i = 0; i < r.ranked.length; i++) {
      var item = r.ranked[i];
      var h = item.hobby;
      var tr = document.createElement('tr');
      if (topIds[h.id]) tr.className = 'row-highlight';
      var cells = [
        item.overBudget ? '예산 초과' : String(++rank),
        h.name,
        catOf(h).name,
        formatCostRange(h).replace(/^월 /, '')
      ];
      if (net > 0) cells.push(h.costMax > 0 ? '약 ' + formatShare(item.share) : '-');
      for (var k = 0; k < cells.length; k++) tr.appendChild(make('td', null, cells[k]));
      out.allRows.appendChild(tr);
    }
    out.allSummary.textContent = '전체 취미 ' + r.ranked.length + '개 보기';
  }

  function renderLegend(r) {
    clear(out.legend);
    var used = {};
    for (var i = 0; i < r.ranked.length; i++) used[r.ranked[i].hobby.category] = true;
    for (var c = 0; c < categories.length; c++) {
      if (!used[categories[c].id]) continue;
      var li = make('li', 'chw-c' + c);
      li.appendChild(make('span', 'chw-swatch'));
      li.appendChild(document.createTextNode(categories[c].name));
      out.legend.appendChild(li);
    }
    var top = make('li');
    top.appendChild(make('span', 'chw-swatch is-top'));
    top.appendChild(document.createTextNode('추천 (숫자는 순위)'));
    out.legend.appendChild(top);

    var anyOver = false;
    for (var k = 0; k < r.ranked.length; k++) if (r.ranked[k].overBudget) anyOver = true;
    if (anyOver) {
      var over = make('li');
      over.appendChild(make('span', 'chw-swatch is-over'));
      over.appendChild(document.createTextNode('예산 초과'));
      out.legend.appendChild(over);
    }
  }

  function renderResult() {
    lastResult = null;
    if (!ready) {
      out.summary.textContent = '취미 자료를 불러오지 못했습니다. 잠시 뒤 새로고침해 주세요.';
      out.block.hidden = true;
      return;
    }
    if (!isComplete()) {
      out.summary.textContent = '질문에 모두 답하면 어울리는 취미 3개와 한 달 비용을 보여 드립니다.';
      out.block.hidden = true;
      return;
    }

    var net = Calc.toAmount(netInput.value);
    var copy = {};
    for (var k in answers) if (Object.prototype.hasOwnProperty.call(answers, k)) copy[k] = answers[k];
    var r = Calc.hobbyRecommend(copy, net);

    if (!r || !r.ranked || !r.ranked.length) {
      out.summary.textContent = '결과를 계산하지 못했습니다. 다시 하기를 눌러 주세요.';
      out.block.hidden = true;
      return;
    }

    if (!r.top || !r.top.length) {
      out.summary.textContent = '고른 예산 안에 드는 취미가 없습니다. 예산 질문의 답을 넓혀 보세요.';
    } else {
      out.summary.textContent = '전체 취미 ' + r.ranked.length + '개 가운데 답과 가장 가까운 ' + r.top.length + '개입니다. ' +
        (net > 0
          ? '월 실수령액 ' + formatWon(net) + '원 기준 비율을 함께 적었습니다.'
          : '위에 월 실수령액을 넣으면 한 달 비용이 실수령의 몇 %인지도 보여 드립니다.');
    }

    out.block.hidden = false;
    renderPicks(r, net);
    renderExcluded(r);
    renderLegend(r);
    renderTable(r, net);
    out.note.textContent = '비용은 공식 통계가 없어 직접 추정한 값입니다. 가볍게 즐길 때와 꾸준히 제대로 할 때를 범위로 적었고, ' +
      '취미마다 무엇을 넣고 뺐는지 카드에 밝혔습니다.' +
      (net > 0 ? ' 비율은 비용 범위의 가운데값 기준입니다.' : '');

    lastResult = r;
    drawMap(r);
  }

  /* ── 취미 지도 ──────────────────────────────────────────────────────── */

  // 처음엔 점그래프였다. 정적인 취미가 왼쪽에 몰려 이름을 다 달 수 없었고,
  // 이름 없는 점은 무엇인지 알 수 없었다. 칸으로 나누면 모든 이름이 보이고 겹치지 않는다.
  // 칸 경계는 취미 수가 칸마다 고르게 나뉘도록 잡았다(활동성은 0.1 단위 값).
  var MAP_COLS = [
    { name: '거의 안 움직임', max: 0.05 },
    { name: '조금 움직임', max: 0.25 },
    { name: '꽤 움직임', max: 0.55 },
    { name: '땀 흘림', max: Infinity }
  ];
  // 위가 비싼 쪽. 기준은 비용 범위의 가운데값
  var MAP_ROWS = [
    { name: '30만 원 이상', min: 300000 },
    { name: '10만~30만 원', min: 100000 },
    { name: '3만~10만 원', min: 30000 },
    { name: '3만 원 미만', min: -Infinity }
  ];
  var MAP_TIP_DEFAULT = '이름을 누르면 분류와 월 비용 범위가 여기에 나옵니다.';
  var mapTexts = [];

  function mapCol(active) {
    var a = Number(active) || 0;
    for (var i = 0; i < MAP_COLS.length; i++) if (a < MAP_COLS[i].max) return i;
    return MAP_COLS.length - 1;
  }

  function mapRow(mid) {
    for (var i = 0; i < MAP_ROWS.length; i++) if (mid >= MAP_ROWS[i].min) return i;
    return MAP_ROWS.length - 1;
  }

  function drawMap(r) {
    clear(out.map);
    mapTexts = [];
    var topRank = {};
    for (var t = 0; t < r.top.length; t++) topRank[r.top[t].hobby.id] = t + 1;

    // 칸마다 ranked 순서(답과 가까운 순)로 담는다
    var cells = [];
    for (var ri = 0; ri < MAP_ROWS.length; ri++) {
      cells.push([]);
      for (var ci = 0; ci < MAP_COLS.length; ci++) cells[ri].push([]);
    }
    for (var i = 0; i < r.ranked.length; i++) {
      var it = r.ranked[i];
      cells[mapRow(it.costMid)][mapCol(it.hobby.active)].push(it);
    }

    var table = make('table', 'chw-grid-table');
    table.appendChild(make('caption', 'chw-grid-caption',
      '취미 지도. 가로는 활동성, 세로는 월 비용(범위의 가운데값). 추천 취미에는 순위 숫자가 붙어 있습니다.'));
    var thead = document.createElement('thead');
    var hr = document.createElement('tr');
    var corner = make('th', 'chw-grid-corner', '월 비용 ↓ · 활동성 →');
    corner.setAttribute('scope', 'col');
    hr.appendChild(corner);
    for (var hc = 0; hc < MAP_COLS.length; hc++) {
      var th = make('th', null, MAP_COLS[hc].name);
      th.setAttribute('scope', 'col');
      hr.appendChild(th);
    }
    thead.appendChild(hr);
    table.appendChild(thead);

    var tbody = document.createElement('tbody');
    for (var rr = 0; rr < MAP_ROWS.length; rr++) {
      var tr = document.createElement('tr');
      var rh = make('th', null, MAP_ROWS[rr].name);
      rh.setAttribute('scope', 'row');
      tr.appendChild(rh);
      for (var cc = 0; cc < MAP_COLS.length; cc++) {
        var td = document.createElement('td');
        td.setAttribute('data-col', MAP_COLS[cc].name); // 좁은 화면에서 칸 이름으로 쓴다
        var list = cells[rr][cc];
        for (var k = 0; k < list.length; k++) {
          var item = list[k];
          var h = item.hobby;
          var rank = topRank[h.id] || 0;
          var btn = make('button', 'chw-chip ' + catClass(h) + (rank ? ' is-top' : '') + (item.overBudget ? ' is-over' : ''));
          btn.type = 'button';
          btn.setAttribute('data-i', String(mapTexts.length));
          if (rank) btn.appendChild(make('span', 'chw-chip-rank', String(rank)));
          else btn.appendChild(make('span', 'chw-chip-dot'));
          btn.appendChild(document.createTextNode(h.name));
          var text = (rank ? rank + '위 ' : '') + h.name + ' · ' + catOf(h).name + ' · ' + formatCostRange(h) +
            (item.overBudget ? ' · 예산 초과' : '');
          btn.setAttribute('aria-label', text);
          mapTexts.push(text);
          td.appendChild(btn);
        }
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    out.map.appendChild(table);
    if (out.mapTip) out.mapTip.textContent = MAP_TIP_DEFAULT;
  }

  function pickMapChip(ev) {
    var t = ev.target;
    while (t && t !== out.map && !(t.getAttribute && t.getAttribute('data-i'))) t = t.parentNode;
    if (!t || t === out.map || !out.mapTip) return;
    var text = mapTexts[Number(t.getAttribute('data-i'))];
    if (text) out.mapTip.textContent = text;
  }

  /* ── 묶기 ───────────────────────────────────────────────────────────── */

  function render(moveFocus) {
    renderQuiz(moveFocus);
    renderResult();
    if (ready) syncHash();
  }

  function loadFromHash() {
    var got = readHash();
    if (!got) return false;
    var any = false;
    for (var k in got) if (Object.prototype.hasOwnProperty.call(got, k)) any = true;
    if (!any) return false;
    answers = got;
    step = nextStep(-1);
    return true;
  }

  quiz.options.addEventListener('click', function (ev) {
    var t = ev.target;
    while (t && t !== quiz.options && !(t.getAttribute && t.getAttribute('data-q'))) t = t.parentNode;
    if (!t || t === quiz.options) return;
    choose(t.getAttribute('data-q'), t.getAttribute('data-o'));
  });

  quiz.prev.addEventListener('click', function () {
    if (step <= 0) return;
    step = step >= questions.length ? questions.length - 1 : step - 1;
    render(true);
  });

  quiz.next.addEventListener('click', function () {
    if (step >= questions.length || !isAnswered(questions[step])) return;
    step = nextStep(step);
    render(true);
  });

  netInput.addEventListener('input', function () {
    formatAmountField(netInput);
    // 실수령액은 결과의 비율만 바꾼다. 해시에는 넣지 않으므로 syncHash 는 부르지 않는다.
    renderResult();
  });

  out.shareBtn.addEventListener('click', function () {
    if (!isComplete()) return;
    syncHash();
    var url = location.href;
    out.shareUrl.value = url;
    out.shareBox.hidden = false;
    var done = function () {
      out.shareStatus.textContent = '링크를 복사했습니다. 월 실수령액은 담기지 않습니다.';
    };
    var fail = function () {
      out.shareStatus.textContent = '아래 링크를 복사해 보내세요.';
      try { out.shareUrl.focus(); out.shareUrl.select(); } catch (e) { /* 선택 실패는 무시 */ }
    };
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      navigator.clipboard.writeText(url).then(done, fail);
    } else {
      fail();
    }
  });

  out.restartBtn.addEventListener('click', function () {
    answers = {};
    step = 0;
    out.shareBox.hidden = true;
    out.shareStatus.textContent = '';
    render(false);
    scrollToNode(quiz.card);
    try { quiz.text.focus({ preventScroll: true }); } catch (e) { /* 초점 실패는 무시 */ }
  });

  // 다른 공유 링크를 같은 탭 주소창에 붙여 넣으면 hashchange 만 일어난다.
  window.addEventListener('hashchange', function () {
    if (!ready) return;
    if (location.hash === '#a=' + encodeAnswers()) return; // 우리가 적은 주소
    if (loadFromHash()) {
      render(false);
      if (isComplete()) scrollToNode(out.card);
    }
  });

  out.map.addEventListener('click', pickMapChip);

  var fromLink = ready && loadFromHash();
  render(false);
  if (fromLink && isComplete()) {
    out.shareStatus.textContent = '공유받은 답으로 그린 결과입니다. 월 실수령액을 넣으면 내 기준 비율이 보입니다.';
    scrollToNode(out.card);
  }
})();

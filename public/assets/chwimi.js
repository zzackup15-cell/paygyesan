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

  var SVG_NS = 'http://www.w3.org/2000/svg';

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
  var lastMapWidth = 0;

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

  function svg(tag, attrs, text) {
    var node = document.createElementNS(SVG_NS, tag);
    for (var k in attrs) {
      if (Object.prototype.hasOwnProperty.call(attrs, k)) node.setAttribute(k, String(attrs[k]));
    }
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
  function whyLine(hobby, profile) {
    var diffs = [];
    for (var i = 0; i < ATTRS.length; i++) {
      var a = ATTRS[i];
      var hv = Number(hobby[a.key]);
      var pv = Number(profile[a.key]);
      if (!isFinite(hv) || !isFinite(pv)) continue;
      diffs.push({ order: i, gap: Math.abs(hv - pv), attr: a, value: hv });
    }
    diffs.sort(function (x, y) { return x.gap - y.gap || x.order - y.order; });
    var words = [];
    for (var k = 0; k < diffs.length && words.length < 2; k++) {
      var v = diffs[k].value;
      var level = v < 0.35 ? 0 : (v > 0.65 ? 2 : 1);
      words.push(diffs[k].attr.words[level]);
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

      var why = whyLine(h, r.profile || {});
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
      over + '개는 추천에서 뺐습니다. 지도에는 속이 빈 점으로 남겨 두었습니다.';
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
    top.appendChild(document.createTextNode('추천 (세로 막대는 비용 범위)'));
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

  // 세로 눈금 후보. 1·3 을 번갈아 쓰면 로그 눈금이 고르게 벌어진다.
  function tickCandidates() {
    var list = [];
    for (var p = 1000; p <= 1000000000; p *= 10) list.push(p, p * 3);
    return list;
  }

  function logTicks(minV, maxV) {
    var all = tickCandidates();
    var lo = all[0];
    var hi = all[all.length - 1];
    for (var i = 0; i < all.length; i++) if (all[i] <= minV) lo = all[i];
    for (var j = all.length - 1; j >= 0; j--) if (all[j] >= maxV) hi = all[j];
    if (hi <= lo) hi = lo * 10;
    var ticks = [];
    for (var k = 0; k < all.length; k++) if (all[k] >= lo && all[k] <= hi) ticks.push(all[k]);
    return ticks;
  }

  function tickLabel(v) {
    if (v >= 100000000) return (v / 100000000).toLocaleString('ko-KR') + '억';
    if (v >= 10000) return (v / 10000).toLocaleString('ko-KR') + '만';
    return (v / 1000).toLocaleString('ko-KR') + '천';
  }

  // 글자 폭 어림. 한글·한자는 글자 크기만큼, 그 밖은 0.6배.
  // 실제로 재려면(getBBox) 그려진 뒤 레이아웃을 강제해야 하고, 숨겨진 상태에서는
  // 0 이 나온다. 겹침 판정에는 어림으로 충분하다.
  function textWidth(s, fs) {
    var w = 0;
    for (var i = 0; i < s.length; i++) w += s.charCodeAt(i) >= 0x2E80 ? fs : fs * 0.6;
    return w;
  }

  function overlaps(a, b) {
    return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  }

  function drawMap(r) {
    clear(out.map);
    var W = Math.floor(out.map.clientWidth || 0);
    if (W <= 0) W = 600; // 아직 배치 전이면 기본 폭. 크기가 잡히면 resize 에서 다시 그린다
    lastMapWidth = W;

    // 좁은 화면에서는 이름이 서로 덮이므로 추천 3개만 이름을 남긴다.
    var narrow = W < 480;
    var H = Math.round(Math.min(440, Math.max(300, W * 0.66)));
    var dotR = narrow ? 3.5 : 4.5;
    var topR = narrow ? 7 : 8;
    var fs = narrow ? 11 : 11.5;
    var fsTop = narrow ? 12 : 13;

    var ranked = r.ranked;
    var topIds = {};
    for (var t = 0; t < r.top.length; t++) topIds[r.top[t].hobby.id] = t + 1;

    // 세로 범위: 전체 취미의 가운데값과 추천 취미의 범위 양 끝이 모두 들어가게.
    var minPos = Infinity;
    var maxV = 0;
    function see(v) {
      if (!isFinite(v) || v <= 0) return;
      if (v < minPos) minPos = v;
      if (v > maxV) maxV = v;
    }
    for (var i = 0; i < ranked.length; i++) {
      see(ranked[i].costMid);
      if (topIds[ranked[i].hobby.id]) { see(ranked[i].hobby.costMin); see(ranked[i].hobby.costMax); }
    }
    if (!isFinite(minPos)) { minPos = 10000; maxV = 100000; }
    var ticks = logTicks(minPos, maxV);
    var lo = ticks[0];
    var hi = ticks[ticks.length - 1];
    var hasBelow = false;
    for (var b = 0; b < ranked.length; b++) if (!(ranked[b].costMid >= lo)) hasBelow = true;
    var tickTexts = [];
    var tickW = 0;
    for (var tt = 0; tt < ticks.length; tt++) {
      tickTexts.push(tickLabel(ticks[tt]) + (tt === 0 && hasBelow ? ' 이하' : ''));
      tickW = Math.max(tickW, textWidth(tickTexts[tt], fs));
    }

    // 왼쪽 여백은 가장 긴 눈금 글자에 맞춘다. 고정값이면 '1,000만' 같은 눈금이 잘린다.
    var pad = { l: Math.max(30, Math.ceil(tickW) + 9), r: 12, t: 30, b: 42 };
    var pw = W - pad.l - pad.r;
    var ph = H - pad.t - pad.b;
    var lnLo = Math.log(lo);
    var lnSpan = Math.log(hi) - lnLo;

    function clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }
    function sx(a) { return pad.l + clamp01(Number(a) || 0) * pw; }
    // 0원 취미는 로그로 그릴 수 없어 맨 아래 눈금에 붙인다. 그 눈금에 '이하' 를 단다.
    function sy(v) {
      var f = v > lo ? (Math.log(v) - lnLo) / lnSpan : 0;
      return pad.t + ph * (1 - clamp01(f));
    }

    var names = [];
    for (var n = 0; n < r.top.length; n++) names.push(n + 1 + '위 ' + r.top[n].hobby.name);
    var root = svg('svg', {
      width: W,
      height: H,
      viewBox: '0 0 ' + W + ' ' + H,
      role: 'img',
      focusable: 'false',
      'class': 'chw-svg',
      'aria-label': '취미 지도. 가로는 활동성(왼쪽 정적, 오른쪽 활동적), 세로는 월 비용(아래 적음, 위 많음, 로그 눈금). ' +
        '전체 ' + ranked.length + '개 중 추천: ' + names.join(', ') + '.'
    });

    // 눈금과 격자
    for (var g = 0; g < ticks.length; g++) {
      var gy = Math.round(sy(ticks[g])) + 0.5; // 1px 선이 번지지 않게 픽셀 경계에 맞춘다
      root.appendChild(svg('line', { x1: pad.l, x2: W - pad.r, y1: gy, y2: gy, 'class': 'chw-grid' }));
      root.appendChild(svg('text', {
        x: pad.l - 5, y: gy + 4, 'text-anchor': 'end', 'font-size': fs, 'class': 'chw-tick'
      }, tickTexts[g]));
    }
    var midX = sx(0.5);
    root.appendChild(svg('line', { x1: midX, x2: midX, y1: pad.t, y2: pad.t + ph, 'class': 'chw-grid is-mid' }));
    root.appendChild(svg('line', { x1: pad.l, x2: W - pad.r, y1: pad.t + ph, y2: pad.t + ph, 'class': 'chw-axis' }));
    root.appendChild(svg('line', { x1: pad.l, x2: pad.l, y1: pad.t, y2: pad.t + ph, 'class': 'chw-axis' }));

    // 축 이름
    var axisY = pad.t + ph + 16;
    root.appendChild(svg('text', { x: pad.l, y: axisY, 'text-anchor': 'start', 'font-size': fs, 'class': 'chw-tick' }, '정적'));
    root.appendChild(svg('text', { x: W - pad.r, y: axisY, 'text-anchor': 'end', 'font-size': fs, 'class': 'chw-tick' }, '활동적'));
    root.appendChild(svg('text', { x: pad.l + pw / 2, y: H - 6, 'text-anchor': 'middle', 'font-size': fs + 1, 'class': 'chw-axis-title' }, '활동성 →'));
    var yTitle = '↑ 월 비용 (원, 로그 눈금)';
    root.appendChild(svg('text', { x: 2, y: 14, 'text-anchor': 'start', 'font-size': fs + 1, 'class': 'chw-axis-title' }, yTitle));

    // 점 위치. 활동성은 소수 한 자리라 같은 자리에 여러 점이 겹친다.
    // 같은 픽셀에 떨어진 점은 가로로 조금씩 벌린다. 순서는 ranked 순서라 늘 같다.
    var pts = [];
    var groups = {};
    for (var p = 0; p < ranked.length; p++) {
      var it = ranked[p];
      var x = sx(it.hobby.active);
      var y = sy(it.costMid);
      var key = Math.round(x) + ',' + Math.round(y);
      (groups[key] = groups[key] || []).push(pts.length);
      pts.push({ item: it, x: x, y: y, rank: topIds[it.hobby.id] || 0 });
    }
    var step2 = dotR * 2 + 1;
    for (var gk in groups) {
      if (!Object.prototype.hasOwnProperty.call(groups, gk)) continue;
      var grp = groups[gk];
      if (grp.length < 2) continue;
      for (var m = 0; m < grp.length; m++) {
        var pt = pts[grp[m]];
        pt.x = Math.max(pad.l, Math.min(W - pad.r, pt.x + (m - (grp.length - 1) / 2) * step2));
      }
    }

    // 이름 자리. 축 이름 자리는 미리 막아 둔다.
    var placed = [{ x: 0, y: 0, w: textWidth(yTitle, fs + 1) + 8, h: 20 }];
    var bounds = { x: pad.l + 2, y: pad.t - 16, w: pw - 2, h: ph + 14 };
    function inBounds(rc) {
      return rc.x >= bounds.x && rc.y >= bounds.y && rc.x + rc.w <= bounds.x + bounds.w && rc.y + rc.h <= bounds.y + bounds.h;
    }
    function tryLabel(pt, text, size, rr, force) {
      var w = textWidth(text, size);
      var h = size + 2;
      var cands = [
        { x: pt.x + rr + 3, y: pt.y - h / 2, tx: pt.x + rr + 3, ty: pt.y + size * 0.35, a: 'start' },
        { x: pt.x - rr - 3 - w, y: pt.y - h / 2, tx: pt.x - rr - 3, ty: pt.y + size * 0.35, a: 'end' },
        { x: pt.x - w / 2, y: pt.y - rr - 2 - h, tx: pt.x, ty: pt.y - rr - 4, a: 'middle' },
        { x: pt.x - w / 2, y: pt.y + rr + 2, tx: pt.x, ty: pt.y + rr + 2 + size * 0.9, a: 'middle' }
      ];
      for (var c = 0; c < cands.length; c++) {
        var rc = { x: cands[c].x, y: cands[c].y, w: w, h: h };
        if (!inBounds(rc)) continue;
        var hit = false;
        for (var q = 0; q < placed.length; q++) if (overlaps(rc, placed[q])) { hit = true; break; }
        if (hit) continue;
        placed.push(rc);
        return cands[c];
      }
      if (!force) return null;
      // 추천 이름은 반드시 보여야 한다. 자리가 없으면 겹치더라도 화면 안쪽으로 붙인다.
      var fallback = pt.x > pad.l + pw / 2 ? cands[1] : cands[0];
      placed.push({ x: fallback.x, y: fallback.y, w: w, h: h });
      return fallback;
    }

    var tops = [];
    for (var a = 0; a < pts.length; a++) if (pts[a].rank) tops.push(pts[a]);
    tops.sort(function (u, v) { return u.rank - v.rank; });
    // 추천 점 자체도 다른 이름이 덮지 않게 막는다
    for (var tp = 0; tp < tops.length; tp++) {
      placed.push({ x: tops[tp].x - topR, y: tops[tp].y - topR, w: topR * 2, h: topR * 2 });
    }

    var labels = [];
    for (var tl = 0; tl < tops.length; tl++) {
      var spot = tryLabel(tops[tl], tops[tl].item.hobby.name, fsTop, topR, true);
      labels.push({ pt: tops[tl], spot: spot, top: true });
    }
    if (!narrow) {
      for (var o = 0; o < pts.length; o++) {
        if (pts[o].rank) continue;
        var s2 = tryLabel(pts[o], pts[o].item.hobby.name, fs, dotR, false);
        if (s2) labels.push({ pt: pts[o], spot: s2, top: false });
      }
    }

    // 그리기 순서: 일반 점 → 추천 범위 막대 → 추천 점 → 이름. 추천이 맨 위에 온다.
    var dots = svg('g', { 'class': 'chw-dots' });
    for (var d = 0; d < pts.length; d++) {
      if (pts[d].rank) continue;
      var h0 = pts[d].item.hobby;
      var c0 = svg('circle', {
        cx: pts[d].x.toFixed(1),
        cy: pts[d].y.toFixed(1),
        r: dotR,
        'class': 'chw-dot ' + catClass(h0) + (pts[d].item.overBudget ? ' is-over' : '')
      });
      c0.appendChild(svg('title', {}, h0.name + ' · ' + catOf(h0).name + ' · ' + formatCostRange(h0) +
        (pts[d].item.overBudget ? ' · 예산 초과' : '')));
      dots.appendChild(c0);
    }
    root.appendChild(dots);

    for (var e = 0; e < tops.length; e++) {
      var tpt = tops[e];
      var th = tpt.item.hobby;
      var y1 = sy(th.costMin);
      var y2 = sy(th.costMax);
      if (Math.abs(y1 - y2) >= 1) {
        root.appendChild(svg('line', {
          x1: tpt.x.toFixed(1), x2: tpt.x.toFixed(1), y1: y1.toFixed(1), y2: y2.toFixed(1),
          'class': 'chw-range ' + catClass(th)
        }));
      }
    }
    for (var f = 0; f < tops.length; f++) {
      var fp = tops[f];
      var fh = fp.item.hobby;
      var big = svg('circle', {
        cx: fp.x.toFixed(1), cy: fp.y.toFixed(1), r: topR,
        'class': 'chw-dot is-top ' + catClass(fh)
      });
      big.appendChild(svg('title', {}, fp.rank + '위 ' + fh.name + ' · ' + catOf(fh).name + ' · ' + formatCostRange(fh)));
      root.appendChild(big);
      root.appendChild(svg('text', {
        x: fp.x.toFixed(1), y: (fp.y + 3.5).toFixed(1), 'text-anchor': 'middle', 'font-size': 10, 'class': 'chw-rank-num',
        'aria-hidden': 'true'
      }, String(fp.rank)));
    }

    for (var lb = 0; lb < labels.length; lb++) {
      var L = labels[lb];
      root.appendChild(svg('text', {
        x: L.spot.tx.toFixed(1),
        y: L.spot.ty.toFixed(1),
        'text-anchor': L.spot.a,
        'font-size': L.top ? fsTop : fs,
        'class': 'chw-label' + (L.top ? ' is-top' : '')
      }, L.pt.item.hobby.name));
    }

    out.map.appendChild(root);
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

  // 지도는 실제 픽셀 폭으로 그린다. viewBox 로 줄이기만 하면 375px 화면에서
  // 글자가 5px 로 쪼그라든다. 그래서 폭이 바뀌면 다시 그린다.
  var resizeQueued = false;
  window.addEventListener('resize', function () {
    if (resizeQueued || !lastResult) return;
    resizeQueued = true;
    var run = function () {
      resizeQueued = false;
      if (lastResult && !out.block.hidden && Math.floor(out.map.clientWidth) !== lastMapWidth) drawMap(lastResult);
    };
    if (typeof window.requestAnimationFrame === 'function') window.requestAnimationFrame(run);
    else setTimeout(run, 100);
  });

  var fromLink = ready && loadFromHash();
  render(false);
  if (fromLink && isComplete()) {
    out.shareStatus.textContent = '공유받은 답으로 그린 결과입니다. 월 실수령액을 넣으면 내 기준 비율이 보입니다.';
    scrollToNode(out.card);
  }
})();

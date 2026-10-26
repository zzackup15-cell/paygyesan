'use strict';

/* 연봉 순위(백분위) UI. 계산은 calc.js 의 Calc 를 그대로 쓴다. */

(function () {
  if (typeof document === 'undefined') return;

  // 사다리표에 보여 줄 백분위. 위쪽은 촘촘하게, 아래로 갈수록 성기게.
  // 상위 구간일수록 금액 차이가 커서 촘촘히 보여야 의미가 있다.
  var LADDER = [0.1, 0.5, 1, 2, 3, 5, 10, 15, 20, 30, 40, 50, 60, 70, 80, 90];

  var el = function (id) { return document.getElementById(id); };
  var salaryInput = el('my-salary');

  var out = {
    percentile: el('out-percentile'),
    rank: el('out-rank'),
    people: el('out-people'),
    average: el('out-average'),
    median: el('out-median'),
    vs: el('out-vs'),
    note: el('out-note'),
    source: el('source-note'),
    detail: el('detail-block'),
    ladder: el('ladder-rows')
  };

  function formatWon(n) {
    if (!isFinite(n)) n = 0;
    return Math.round(n).toLocaleString('ko-KR');
  }

  // 상위 12.3% 처럼 너무 잘게 쪼개면 정확해 보여서 오해를 부른다.
  // 추정치이므로 자릿수를 위치에 맞게 줄인다.
  function formatPercentile(p) {
    if (p < 1) return Math.round(p * 100) / 100;
    if (p < 10) return Math.round(p * 10) / 10;
    return Math.round(p);
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

  function clearRows(tbody) {
    while (tbody.firstChild) tbody.removeChild(tbody.firstChild);
  }

  function renderLadder(myPct, people) {
    clearRows(out.ladder);

    // 내 위치에 가장 가까운 줄 하나만 표시한다
    var nearest = null;
    var gap = Infinity;
    for (var i = 0; i < LADDER.length; i++) {
      var d = Math.abs(LADDER[i] - myPct);
      if (d < gap) { gap = d; nearest = LADDER[i]; }
    }

    for (var k = 0; k < LADDER.length; k++) {
      var pct = LADDER[k];
      var pay = Calc.incomeAtPercentile(pct);
      var tr = document.createElement('tr');
      if (myPct > 0 && pct === nearest) tr.className = 'row-highlight';

      var cells = [
        '상위 ' + pct + '%',
        formatWon(pay) + '원',
        formatWon(people * pct / 100) + '명',
        myPct > 0 && pct === nearest ? '← 내 위치' : ''
      ];
      for (var c = 0; c < cells.length; c++) {
        var cell = document.createElement(c === 0 ? 'th' : 'td');
        cell.textContent = cells[c];
        tr.appendChild(cell);
      }
      out.ladder.appendChild(tr);
    }
  }

  function render() {
    var annual = Calc.toAmount(salaryInput.value);
    var r = Calc.incomePercentile(annual);

    if (!r.hasData) {
      out.note.textContent = '백분위 자료를 불러오지 못했습니다.';
      out.detail.hidden = true;
      return;
    }

    out.people.textContent = formatWon(r.people);
    out.average.textContent = formatWon(r.average);
    out.median.textContent = formatWon(r.median);
    out.source.textContent = '국세청 근로소득 백분위 자료 · ' + r.year + '년 귀속';

    if (annual <= 0) {
      out.percentile.textContent = '0';
      out.rank.textContent = '0';
      out.vs.textContent = '0';
      out.note.textContent = '연봉을 넣으면 근로소득자 중 내 위치를 보여 드립니다.';
      out.detail.hidden = true;
      return;
    }

    out.percentile.textContent = formatPercentile(r.percentile);
    out.rank.textContent = formatWon(r.rank);
    out.vs.textContent = Math.round(r.vsAverage * 100);
    out.detail.hidden = false;

    var notes = [];
    if (r.percentile < 50) {
      notes.push('근로소득자 ' + formatWon(r.people) + '명 중 상위 ' +
        formatPercentile(r.percentile) + '% 입니다. 절반보다 위입니다.');
    } else {
      notes.push('근로소득자 ' + formatWon(r.people) + '명 중 상위 ' +
        formatPercentile(r.percentile) + '% 입니다.');
    }
    if (annual > r.median && annual < r.average) {
      notes.push('중위 연봉보다는 많고 평균보다는 적습니다. 평균은 아주 높은 소득이 끌어올린 값이라 한가운데가 아닙니다.');
    }
    notes.push('연말정산을 신고한 근로소득자 기준이며 자영업자와 프리랜서는 포함되지 않습니다.');
    notes.push('공개 자료가 구간별 인원과 총급여 합계만 주기 때문에 경계 금액이 아니라 구간 평균으로 추정한 값입니다.');
    out.note.textContent = notes.join(' ');

    renderLadder(r.percentile, r.people);
  }

  salaryInput.addEventListener('input', function () {
    formatAmountField(salaryInput);
    render();
  });

  el('reset-all').addEventListener('click', function () {
    salaryInput.value = '';
    render();
  });

  render();
})();

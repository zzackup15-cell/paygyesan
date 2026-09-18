'use strict';

/* 연봉별 실수령액표 UI. 계산은 calc.js 의 Calc.netPayTable 을 그대로 쓴다. */

(function () {
  if (typeof document === 'undefined') return;

  // 표 범위. 2,000만~1억 5,000만을 100만원 단위로 한 간격으로 훑는다.
  // 구간마다 간격을 달리하면 '증가' 열의 값이 서로 비교되지 않는다.
  var SEGMENTS = [{ from: 20000000, to: 150000000, step: 1000000 }];
  var STEP = 1000000;

  var el = function (id) { return document.getElementById(id); };
  var salaryInput = el('my-salary');
  var exemptInput = el('non-taxable');
  var familySelect = el('family-count');
  var childSelect = el('child-count');

  var out = {
    net: el('out-net'),
    delta: el('out-delta'),
    gross: el('out-gross'),
    deduction: el('out-deduction'),
    rate: el('out-rate'),
    keep: el('out-keep'),
    note: el('out-note'),
    rowCount: el('row-count'),
    tbody: el('table-rows')
  };

  function formatWon(n) {
    if (!isFinite(n)) n = 0;
    return Math.round(n).toLocaleString('ko-KR');
  }

  // 1억 이상은 '10,000만 원' 대신 '1억 원' 으로 읽히게 한다
  function annualLabel(annual) {
    var man = Math.round(annual / 10000);
    if (man < 10000) return man.toLocaleString('ko-KR') + '만';
    var eok = Math.floor(man / 10000);
    var rest = man % 10000;
    return rest === 0 ? eok + '억' : eok + '억 ' + rest.toLocaleString('ko-KR') + '만';
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

  for (var f = 1; f <= Calc.MAX_FAMILY; f++) {
    var fo = document.createElement('option');
    fo.value = String(f);
    fo.textContent = f + '명';
    familySelect.appendChild(fo);
  }
  familySelect.value = '1';
  for (var c = 0; c <= Calc.MAX_CHILDREN; c++) {
    var co = document.createElement('option');
    co.value = String(c);
    co.textContent = c + '명';
    childSelect.appendChild(co);
  }
  childSelect.value = '0';

  // 내 연봉과 가장 가까운 행을 찾는다. 표가 100만원 단위라 정확히
  // 일치하지 않는 연봉이 훨씬 많다.
  function nearestRow(rows, annual) {
    if (!annual) return null;
    var best = null;
    var gap = Infinity;
    for (var i = 0; i < rows.length; i++) {
      var d = Math.abs(rows[i].annual - annual);
      if (d < gap) { gap = d; best = rows[i]; }
    }
    return best;
  }

  function renderTable(rows, mine) {
    while (out.tbody.firstChild) out.tbody.removeChild(out.tbody.firstChild);

    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      var tr = document.createElement('tr');
      if (mine && r.annual === mine.annual) tr.className = 'row-highlight';

      var cells = [
        annualLabel(r.annual),
        formatWon(r.monthlyGross),
        formatWon(r.monthlyNet),
        formatWon(r.annualNet),
        (Math.round(r.deductionRate * 1000) / 10) + '%',
        i === 0 ? '-' : '+' + formatWon(r.deltaNet)
      ];
      for (var k = 0; k < cells.length; k++) {
        var cell = document.createElement(k === 0 ? 'th' : 'td');
        cell.textContent = cells[k];
        tr.appendChild(cell);
      }
      out.tbody.appendChild(tr);
    }
    out.rowCount.textContent = rows.length + '개 구간 · 2026년 요율과 근로소득 간이세액표 기준';
  }

  function clearMine() {
    out.net.textContent = '0';
    out.delta.textContent = '0';
    out.gross.textContent = '0';
    out.deduction.textContent = '0';
    out.rate.textContent = '0';
    out.keep.textContent = '0';
    out.note.textContent = '연봉을 넣으면 표에서 해당 줄을 찾아 보여 드립니다.';
  }

  function render() {
    var exempt = Calc.toAmount(exemptInput.value);
    var family = parseInt(familySelect.value, 10) || 1;
    var children = parseInt(childSelect.value, 10) || 0;
    var rows = Calc.netPayTable(SEGMENTS, exempt, family, children);

    var annual = Calc.toAmount(salaryInput.value);
    var mine = nearestRow(rows, annual);

    renderTable(rows, mine);

    if (!mine) {
      clearMine();
      return;
    }

    out.net.textContent = formatWon(mine.monthlyNet);
    out.delta.textContent = formatWon(mine.deltaNet);
    out.gross.textContent = formatWon(mine.monthlyGross);
    out.deduction.textContent = formatWon(mine.deduction);
    out.rate.textContent = Math.round(mine.deductionRate * 1000) / 10;

    // 연봉 인상분 중 실제로 손에 남는 비율. 이 페이지의 핵심 숫자다.
    var keep = mine.deltaNet * 12 / STEP;
    out.keep.textContent = Math.round(keep * 1000) / 10;

    var notes = [];
    if (mine.annual !== annual) {
      notes.push('표가 100만 원 단위라 가장 가까운 연봉 ' + annualLabel(mine.annual) +
        ' 원 줄을 기준으로 보여 드립니다.');
    }
    notes.push('연봉을 100만 원 올리면 월 실수령액이 ' + formatWon(mine.deltaNet) +
      '원 늘어납니다. 연간으로는 ' + formatWon(mine.deltaNet * 12) +
      '원으로, 인상분의 ' + (Math.round(keep * 1000) / 10) + '% 입니다.');
    notes.push('상여금과 성과급은 반영되지 않았습니다.');
    out.note.textContent = notes.join(' ');
  }

  [salaryInput, exemptInput].forEach(function (input) {
    input.addEventListener('input', function () {
      formatAmountField(input);
      render();
    });
  });
  familySelect.addEventListener('change', render);
  childSelect.addEventListener('change', render);

  el('reset-all').addEventListener('click', function () {
    salaryInput.value = '';
    exemptInput.value = '200,000';
    familySelect.value = '1';
    childSelect.value = '0';
    render();
  });

  render();
})();

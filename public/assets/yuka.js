'use strict';

/* 육아휴직 급여 계산기 UI. 계산은 calc.js 의 Calc 를 그대로 쓴다. */

(function () {
  if (typeof document === 'undefined') return;

  var wageInput = document.getElementById('monthly-ordinary');
  var monthsInput = document.getElementById('leave-months');
  var plusInput = document.getElementById('plus-scheme');

  var out = {
    total: document.getElementById('out-total'),
    months: document.getElementById('out-months'),
    average: document.getElementById('out-average'),
    first: document.getElementById('out-first'),
    tbody: document.getElementById('month-rows'),
    note: document.getElementById('out-note')
  };

  function formatWon(n) {
    if (!isFinite(n)) n = 0;
    return Math.round(n).toLocaleString('ko-KR');
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

  // 표는 매번 다시 그린다. 사용자 입력을 담는 요소가 없어 포커스가 날아갈 일이 없다.
  function renderRows(rows) {
    while (out.tbody.firstChild) out.tbody.removeChild(out.tbody.firstChild);

    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      var tr = document.createElement('tr');

      var td1 = document.createElement('td');
      td1.textContent = r.month + '개월차';
      tr.appendChild(td1);

      var td2 = document.createElement('td');
      td2.textContent = Math.round(r.rate * 100) + '%';
      tr.appendChild(td2);

      var td3 = document.createElement('td');
      td3.textContent = formatWon(r.cap);
      tr.appendChild(td3);

      var td4 = document.createElement('td');
      td4.textContent = formatWon(r.amount);
      tr.appendChild(td4);

      out.tbody.appendChild(tr);
    }
  }

  function render() {
    var wage = Calc.toAmount(wageInput.value);
    var months = Calc.toHours(monthsInput.value);
    var isPlus = plusInput.checked;

    // 통상임금을 아직 넣지 않았는데 하한액(70만원)이 적용되어 금액이 뜨면
    // 입력도 하기 전에 받을 돈이 있는 것처럼 보인다. 빈 상태로 둔다.
    var r = wage > 0
      ? Calc.parentalLeave(wage, months, isPlus)
      : { months: 0, rows: [], total: 0 };

    renderRows(r.rows);

    out.total.textContent = formatWon(r.total);
    out.months.textContent = r.months;
    out.average.textContent = r.months > 0 ? formatWon(r.total / r.months) : '0';
    out.first.textContent = r.rows.length ? formatWon(r.rows[0].amount) : '0';

    var floor = Calc.PARENTAL.floor;
    var hitFloor = r.rows.some(function (row) { return row.amount === floor; });
    var hitCap = r.rows.some(function (row) { return row.amount === row.cap; });

    var notes = [];
    if (hitCap) notes.push('상한액이 적용된 달이 있습니다.');
    if (hitFloor) notes.push('하한액 70만 원이 적용된 달이 있습니다.');
    out.note.textContent = notes.join(' ');
  }

  wageInput.addEventListener('input', function () {
    formatAmountField(wageInput);
    render();
  });
  monthsInput.addEventListener('input', render);
  plusInput.addEventListener('change', render);

  document.getElementById('reset-all').addEventListener('click', function () {
    wageInput.value = '';
    monthsInput.value = '12';
    plusInput.checked = false;
    render();
  });

  render();
})();

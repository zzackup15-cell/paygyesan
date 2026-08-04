'use strict';

/* 4대보험 계산기 UI. 계산은 calc.js 의 Calc 를 그대로 쓴다. */

(function () {
  if (typeof document === 'undefined') return;

  var wageInput = document.getElementById('monthly-wage');
  var sizeSelect = document.getElementById('company-size');
  var accidentInput = document.getElementById('accident-rate');

  var out = {
    employee: document.getElementById('out-employee'),
    employer: document.getElementById('out-employer'),
    laborCost: document.getElementById('out-labor-cost'),
    employeeRate: document.getElementById('out-employee-rate'),
    annualEmployer: document.getElementById('out-annual-employer'),
    tbody: document.getElementById('insurance-rows'),
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

  function clear(el) {
    while (el.firstChild) el.removeChild(el.firstChild);
  }

  function row(cells, cls) {
    var tr = document.createElement('tr');
    if (cls) tr.className = cls;
    for (var i = 0; i < cells.length; i++) {
      var td = document.createElement('td');
      td.textContent = cells[i];
      tr.appendChild(td);
    }
    return tr;
  }

  function render() {
    var wage = Calc.toAmount(wageInput.value);
    var sizeKey = sizeSelect.value;
    var accidentRate = accidentInput.value;

    var emp = Calc.insurance(wage);
    var er = Calc.employerInsurance(wage, { sizeKey: sizeKey, accidentRate: accidentRate });

    clear(out.tbody);

    // 근로자와 사업주 부담을 나란히 놓는 것이 이 페이지의 핵심이다
    var rows = [
      ['국민연금', emp.pension, er.pension],
      ['건강보험', emp.health, er.health],
      ['장기요양', emp.care, er.care],
      ['고용보험 (실업급여)', emp.employment, er.employment],
      ['고용안정·직업능력개발', 0, er.stability],
      ['산재보험', 0, er.accident]
    ];
    for (var i = 0; i < rows.length; i++) {
      var name = rows[i][0];
      var a = rows[i][1];
      var b = rows[i][2];
      out.tbody.appendChild(row([
        name,
        a > 0 ? formatWon(a) : '-',
        b > 0 ? formatWon(b) : '-',
        formatWon(a + b)
      ]));
    }
    out.tbody.appendChild(row([
      '합계',
      formatWon(emp.total),
      formatWon(er.total),
      formatWon(emp.total + er.total)
    ], 'is-current'));

    out.employee.textContent = formatWon(emp.total);
    out.employer.textContent = formatWon(er.total);
    out.laborCost.textContent = formatWon(wage + er.total);
    out.annualEmployer.textContent = formatWon(er.total * 12);
    out.employeeRate.textContent = wage > 0
      ? (emp.total / wage * 100).toLocaleString('ko-KR', { maximumFractionDigits: 1 })
      : '0';

    var notes = ['고용안정·직업능력개발 ' + (Math.round(er.stabilityRate * 1e6) / 1e4) + '% (' + er.stabilityLabel + ')'];
    if (er.accident <= 0) notes.push('산재보험은 업종별 요율이 달라 입력하지 않으면 계산에서 빠집니다.');
    out.note.textContent = notes.join(' · ');
  }

  wageInput.addEventListener('input', function () {
    formatAmountField(wageInput);
    render();
  });
  sizeSelect.addEventListener('change', render);
  accidentInput.addEventListener('input', render);

  document.getElementById('reset-all').addEventListener('click', function () {
    wageInput.value = '';
    sizeSelect.value = 'under150';
    accidentInput.value = '';
    render();
  });

  // 기업 규모 선택지를 calc.js 의 요율 정의에서 생성한다.
  // 요율이 바뀌면 화면 문구도 함께 따라오게 하기 위함이다.
  (function fillSizes() {
    var tiers = Calc.RATES.employment.employerStability;
    clear(sizeSelect);
    for (var i = 0; i < tiers.length; i++) {
      var opt = document.createElement('option');
      opt.value = tiers[i].key;
      opt.textContent = tiers[i].label + ' (' + (Math.round(tiers[i].rate * 1e6) / 1e4) + '%)';
      sizeSelect.appendChild(opt);
    }
  })();

  render();
})();

'use strict';

/* 연봉 실수령액 계산기 UI. 계산은 calc.js 의 Calc 를 그대로 쓴다. */

(function () {
  if (typeof document === 'undefined') return;

  // 연봉별 실수령액 비교표에 쓸 구간 (만원)
  var TABLE_ROWS = [2400, 3000, 3600, 4200, 4800, 5400, 6000, 7000, 8000, 10000];

  var annualInput = document.getElementById('annual-salary');
  var includeSeverance = document.getElementById('include-severance');
  var nonTaxableInput = document.getElementById('non-taxable');
  var familyInput = document.getElementById('family-count');
  var childInput = document.getElementById('child-count');

  var out = {
    monthlyGross: document.getElementById('out-monthly-gross'),
    net: document.getElementById('out-net'),
    netAnnual: document.getElementById('out-net-annual'),
    rate: document.getElementById('out-rate'),
    deduction: document.getElementById('out-deduction'),
    taxable: document.getElementById('out-taxable'),
    divisor: document.getElementById('out-divisor'),
    tbody: document.getElementById('deduct-rows'),
    tableBody: document.getElementById('compare-rows')
  };

  function formatWon(n) {
    if (!isFinite(n)) n = 0;
    return Math.round(n).toLocaleString('ko-KR');
  }

  function readCount(input, min, max) {
    var digits = input.value.replace(/[^0-9]/g, '');
    var n = digits === '' ? min : parseInt(digits, 10);
    if (!isFinite(n)) n = min;
    return Math.min(Math.max(n, min), max);
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

  function row(cells, highlight) {
    var tr = document.createElement('tr');
    if (highlight) tr.className = 'is-current';
    for (var i = 0; i < cells.length; i++) {
      var td = document.createElement('td');
      td.textContent = cells[i];
      tr.appendChild(td);
    }
    return tr;
  }

  function clear(el) {
    while (el.firstChild) el.removeChild(el.firstChild);
  }

  function render() {
    var annual = Calc.toAmount(annualInput.value);
    // 채용공고의 '퇴직금 포함 연봉'은 실제로는 13으로 나눈 금액이 월급이 된다
    var divisor = includeSeverance.checked ? 13 : 12;
    var monthlyGross = annual > 0 ? annual / divisor : 0;

    var family = readCount(familyInput, 1, Calc.MAX_FAMILY);
    var children = readCount(childInput, 0, Calc.MAX_CHILDREN);
    var exempt = Calc.toAmount(nonTaxableInput.value);

    var n = Calc.netPay(monthlyGross, exempt, family, children);

    out.divisor.textContent = divisor + '개월';
    out.monthlyGross.textContent = formatWon(n.gross);
    out.net.textContent = formatWon(n.net);
    out.netAnnual.textContent = formatWon(n.net * 12);
    out.taxable.textContent = formatWon(n.taxable);
    out.deduction.textContent = formatWon(n.deduction);
    out.rate.textContent = n.gross > 0
      ? (n.deduction / n.gross * 100).toLocaleString('ko-KR', { maximumFractionDigits: 1 })
      : '0';

    clear(out.tbody);
    var items = [
      ['국민연금', n.pension],
      ['건강보험', n.health],
      ['장기요양', n.care],
      ['고용보험', n.employment],
      ['소득세', n.incomeTax],
      ['지방소득세', n.localTax]
    ];
    for (var i = 0; i < items.length; i++) {
      out.tbody.appendChild(row([items[i][0], formatWon(items[i][1]) + '원']));
    }
    out.tbody.appendChild(row(['공제 합계', formatWon(n.deduction) + '원'], true));

    // 연봉별 비교표. 입력값과 가장 가까운 행을 표시해 자기 위치를 알 수 있게 한다.
    clear(out.tableBody);
    var mine = Math.round(annual / 10000);
    var nearest = null;
    var gap = Infinity;
    for (var t = 0; t < TABLE_ROWS.length; t++) {
      var d = Math.abs(TABLE_ROWS[t] - mine);
      if (d < gap) { gap = d; nearest = TABLE_ROWS[t]; }
    }
    for (var k = 0; k < TABLE_ROWS.length; k++) {
      var man = TABLE_ROWS[k];
      var g = man * 10000 / 12;
      var r = Calc.netPay(g, exempt, family, children);
      // 1억 이상은 '10,000만 원' 대신 '1억 원'으로 읽히게 한다
      var label = man >= 10000
        ? (man % 10000 === 0 ? (man / 10000) + '억 원'
                             : Math.floor(man / 10000) + '억 ' + (man % 10000).toLocaleString('ko-KR') + '만 원')
        : man.toLocaleString('ko-KR') + '만 원';
      out.tableBody.appendChild(row([
        label,
        formatWon(g) + '원',
        formatWon(r.net) + '원',
        (r.deduction / r.gross * 100).toFixed(1) + '%'
      ], annual > 0 && man === nearest && gap <= 400));
    }
  }

  annualInput.addEventListener('input', function () {
    formatAmountField(annualInput);
    render();
  });
  nonTaxableInput.addEventListener('input', function () {
    formatAmountField(nonTaxableInput);
    render();
  });
  includeSeverance.addEventListener('change', render);
  familyInput.addEventListener('input', render);
  childInput.addEventListener('input', render);
  familyInput.addEventListener('blur', function () {
    familyInput.value = String(readCount(familyInput, 1, Calc.MAX_FAMILY));
    render();
  });
  childInput.addEventListener('blur', function () {
    childInput.value = String(readCount(childInput, 0, Calc.MAX_CHILDREN));
    render();
  });

  document.getElementById('reset-all').addEventListener('click', function () {
    annualInput.value = '';
    includeSeverance.checked = false;
    nonTaxableInput.value = '200,000';
    familyInput.value = '1';
    childInput.value = '0';
    render();
  });

  render();
})();

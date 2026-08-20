'use strict';

/* 월급 외 추가 수익 세금 계산기 UI. 계산은 calc.js 의 Calc 를 그대로 쓴다. */

(function () {
  if (typeof document === 'undefined') return;

  var salaryInput = document.getElementById('annual-salary');
  var familySelect = document.getElementById('family-count');
  var typeSelect = document.getElementById('income-type');
  var revenueInput = document.getElementById('side-revenue');
  var expenseInput = document.getElementById('side-expense');
  var expenseField = document.getElementById('expense-field');

  var out = {
    tax: document.getElementById('out-tax'),
    settle: document.getElementById('out-settle'),
    settleLabel: document.getElementById('settle-label'),
    income: document.getElementById('out-income'),
    marginal: document.getElementById('out-marginal'),
    withheld: document.getElementById('out-withheld'),
    effective: document.getElementById('out-effective'),
    note: document.getElementById('out-note'),
    typeNote: document.getElementById('type-note'),
    breakdown: document.getElementById('breakdown-rows'),
    compare: document.getElementById('compare-rows'),
    healthBlock: document.getElementById('health-block'),
    healthRows: document.getElementById('health-rows')
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

  function clearRows(tbody) {
    while (tbody.firstChild) tbody.removeChild(tbody.firstChild);
  }

  function addRow(tbody, cells, highlight) {
    var tr = document.createElement('tr');
    if (highlight) tr.className = 'row-highlight';
    for (var i = 0; i < cells.length; i++) {
      var cell = document.createElement(i === 0 && cells.length === 2 ? 'th' : 'td');
      cell.textContent = cells[i];
      tr.appendChild(cell);
    }
    tbody.appendChild(tr);
  }

  for (var f = 1; f <= Calc.MAX_FAMILY; f++) {
    var opt = document.createElement('option');
    opt.value = String(f);
    opt.textContent = f + '명';
    familySelect.appendChild(opt);
  }
  familySelect.value = '1';

  function currentOpts(type) {
    return {
      annualSalary: salaryInput.value,
      family: parseInt(familySelect.value, 10) || 1,
      type: type || typeSelect.value,
      sideRevenue: revenueInput.value,
      sideExpense: expenseInput.value
    };
  }

  function renderBreakdown(r) {
    clearRows(out.breakdown);
    addRow(out.breakdown, ['추가 수입', formatWon(r.revenue) + '원']);
    addRow(out.breakdown, [
      r.type === 'other' ? '필요경비 (60% 의제)' : '필요경비',
      '− ' + formatWon(r.expense) + '원'
    ]);
    addRow(out.breakdown, ['소득금액', formatWon(r.incomeAmount) + '원']);
    addRow(out.breakdown, ['소득세', '− ' + formatWon(r.incomeTax) + '원']);
    addRow(out.breakdown, ['지방소득세', '− ' + formatWon(r.localTax) + '원']);
    if (r.healthYear > 0) {
      addRow(out.breakdown, ['건강보험료 (연간)', '− ' + formatWon(r.healthYear) + '원']);
    }
    addRow(out.breakdown, ['실제로 남는 돈', formatWon(r.netIncome) + '원'], true);
  }

  function renderCompare(currentType) {
    clearRows(out.compare);
    var types = [
      { key: 'business', label: '사업소득 (3.3%)' },
      { key: 'other', label: '기타소득 (8.8%)' }
    ];
    for (var i = 0; i < types.length; i++) {
      var r = Calc.sideIncomeTax(currentOpts(types[i].key));
      var settle = r.settlement >= 0
        ? '+' + formatWon(r.settlement) + '원'
        : '−' + formatWon(-r.settlement) + '원';
      addRow(out.compare, [
        types[i].label,
        formatWon(r.incomeAmount) + '원',
        formatWon(r.addedTax) + '원',
        settle
      ], types[i].key === currentType);
    }
  }

  function renderHealth(r) {
    if (r.healthYear <= 0) {
      out.healthBlock.hidden = true;
      clearRows(out.healthRows);
      return;
    }
    out.healthBlock.hidden = false;
    clearRows(out.healthRows);
    var over = r.incomeAmount - Calc.SIDE.healthThreshold;
    addRow(out.healthRows, ['2,000만 원 초과분', formatWon(over) + '원']);
    addRow(out.healthRows, ['소득월액', formatWon(over / 12) + '원']);
    addRow(out.healthRows, ['건강보험료 (월)', formatWon(r.healthMonthly) + '원']);
    addRow(out.healthRows, ['장기요양보험료 (월)', formatWon(r.careMonthly) + '원']);
    addRow(out.healthRows, ['연간 합계', formatWon(r.healthYear) + '원'], true);
  }

  function render() {
    var isOther = typeSelect.value === 'other';
    // 기타소득은 필요경비를 60% 로 의제하므로 실제 경비를 받을 이유가 없다.
    expenseField.hidden = isOther;
    out.typeNote.textContent = isOther
      ? '기타소득금액 300만 원 이하면 분리과세를 선택할 수 있습니다'
      : '사업소득은 금액과 무관하게 5월 종합소득세 신고 대상입니다';

    var revenue = Calc.toAmount(revenueInput.value);
    var salary = Calc.toAmount(salaryInput.value);

    // 수입을 넣기 전에 금액이 뜨면 낼 세금이 확정된 것처럼 보인다. 비워 둔다.
    if (revenue <= 0) {
      out.tax.textContent = '0';
      out.settle.textContent = '0';
      out.settleLabel.textContent = '5월에 더 낼 돈';
      out.income.textContent = '0';
      out.marginal.textContent = '0';
      out.withheld.textContent = '0';
      out.effective.textContent = '0';
      out.note.textContent = '';
      clearRows(out.breakdown);
      clearRows(out.compare);
      out.healthBlock.hidden = true;
      return;
    }

    var r = Calc.sideIncomeTax(currentOpts());

    out.tax.textContent = formatWon(r.addedTax);
    out.income.textContent = formatWon(r.incomeAmount);
    out.marginal.textContent = r.marginalPct;
    out.withheld.textContent = formatWon(r.withheld);
    out.effective.textContent = Math.round(r.effectiveRate * 1000) / 10;

    if (r.settlement >= 0) {
      out.settleLabel.textContent = '5월에 더 낼 돈';
      out.settle.textContent = formatWon(r.settlement);
    } else {
      out.settleLabel.textContent = '5월에 돌려받을 돈';
      out.settle.textContent = formatWon(-r.settlement);
    }

    var notes = [];
    if (salary <= 0) {
      // 연봉을 0 으로 두면 인적공제가 부수입에 걸리지 않아 세금이 과대 추정된다.
      // 이 계산기의 전제는 '연봉 위에 부수입이 얹힌다'는 것이므로 연봉이 있어야 맞다.
      notes.push('연봉을 넣지 않아 부수입만 있는 것으로 계산했습니다. 직장인이라면 연봉을 넣어야 실제 세율이 나옵니다.');
    }
    if (r.canSeparate) {
      notes.push('기타소득금액이 300만 원 이하라 분리과세를 선택할 수 있습니다. 그 경우 원천징수된 '
        + formatWon(r.separateTax) + '원으로 납세의무가 끝나며, 위 금액과 비교해 유리한 쪽을 고르면 됩니다.');
    }
    if (r.settlement < 0) {
      notes.push('원천징수액이 실제 세금보다 많아 5월에 돌려받습니다. 신고하지 않으면 환급도 없습니다.');
    }
    out.note.textContent = notes.join(' ');

    renderBreakdown(r);
    renderCompare(typeSelect.value);
    renderHealth(r);
  }

  salaryInput.addEventListener('input', function () {
    formatAmountField(salaryInput);
    render();
  });
  revenueInput.addEventListener('input', function () {
    formatAmountField(revenueInput);
    render();
  });
  expenseInput.addEventListener('input', function () {
    formatAmountField(expenseInput);
    render();
  });
  familySelect.addEventListener('change', render);
  typeSelect.addEventListener('change', render);

  document.getElementById('reset-all').addEventListener('click', function () {
    salaryInput.value = '';
    revenueInput.value = '';
    expenseInput.value = '';
    familySelect.value = '1';
    typeSelect.value = 'business';
    render();
  });

  render();
})();

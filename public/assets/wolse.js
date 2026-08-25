'use strict';

/* 월세(주택임대소득) 세금 계산기 UI. 계산은 calc.js 의 Calc 를 그대로 쓴다. */

(function () {
  if (typeof document === 'undefined') return;

  var houseSelect = document.getElementById('house-count');
  var rentInput = document.getElementById('monthly-rent');
  var depositInput = document.getElementById('deposit');
  var depositField = document.getElementById('deposit-field');
  var salaryInput = document.getElementById('annual-salary');
  var highValue = document.getElementById('high-value');
  var highValueLabel = document.getElementById('highvalue-label');
  var highValueHint = document.getElementById('highvalue-hint');
  var registered = document.getElementById('registered');

  var out = {
    revenue: document.getElementById('out-revenue'),
    tax: document.getElementById('out-tax'),
    taxLabel: document.getElementById('tax-label'),
    status: document.getElementById('out-status'),
    method: document.getElementById('out-method'),
    expense: document.getElementById('out-expense'),
    net: document.getElementById('out-net'),
    note: document.getElementById('out-note'),
    ruleNote: document.getElementById('rule-note'),
    detail: document.getElementById('detail-block'),
    revenueRows: document.getElementById('revenue-rows'),
    compareRows: document.getElementById('compare-rows')
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

  function currentOpts() {
    return {
      houses: houseSelect.value,
      isHighValue: highValue.checked,
      registered: registered.checked,
      monthlyRent: rentInput.value,
      deposit: depositInput.value,
      annualSalary: salaryInput.value
    };
  }

  function renderRevenue(r) {
    clearRows(out.revenueRows);
    addRow(out.revenueRows, ['연 월세 수입', formatWon(r.yearlyRent) + '원']);
    if (r.deemedRent > 0) {
      addRow(out.revenueRows, ['간주임대료 (보증금)', formatWon(r.deemedRent) + '원']);
    }
    addRow(out.revenueRows, ['총수입금액', formatWon(r.revenue) + '원']);
    addRow(out.revenueRows, [
      '필요경비 (' + (registered.checked ? '60%' : '50%') + ')',
      '− ' + formatWon(r.expense) + '원'
    ]);
    if (r.deduction > 0) {
      addRow(out.revenueRows, ['기본공제', '− ' + formatWon(r.deduction) + '원']);
    }
    addRow(out.revenueRows, ['세금 뺀 실수령', formatWon(r.netIncome) + '원'], true);
  }

  function renderCompare(r) {
    clearRows(out.compareRows);
    addRow(out.compareRows, [
      '분리과세',
      '14% 고정',
      r.canSeparate ? formatWon(r.separateTax) + '원' : '선택 불가',
      r.canSeparate && r.betterIsSeparate ? '← 유리' : ''
    ], r.canSeparate && r.betterIsSeparate);
    addRow(out.compareRows, [
      '종합과세',
      '6~45% 누진',
      formatWon(r.comprehensiveTax) + '원',
      r.betterIsSeparate ? '' : '← 적용'
    ], !r.betterIsSeparate);
  }

  function render() {
    var houses = parseInt(houseSelect.value, 10) || 1;

    // 보증금은 3주택 이상에서만, 고가주택 체크는 1주택에서만 의미가 있다.
    // 안 쓰는 입력을 띄워 두면 넣어도 결과가 안 변해 고장으로 보인다.
    depositField.hidden = houses < 3;
    var showHighValue = houses === 1;
    highValueLabel.hidden = !showHighValue;
    highValueHint.hidden = !showHighValue;

    if (houses === 1) {
      out.ruleNote.textContent = '1주택이고 기준시가 12억 원 이하면 월세는 비과세입니다';
    } else if (houses === 2) {
      out.ruleNote.textContent = '2주택은 월세가 과세 대상이며 보증금은 과세하지 않습니다';
    } else {
      out.ruleNote.textContent = '3주택 이상은 보증금 3억 원 초과분도 간주임대료로 과세됩니다';
    }

    var rent = Calc.toAmount(rentInput.value);
    var deposit = Calc.toAmount(depositInput.value);

    if (rent <= 0 && deposit <= 0) {
      out.revenue.textContent = '0';
      out.tax.textContent = '0';
      out.taxLabel.textContent = '내야 할 세금';
      out.status.textContent = '-';
      out.method.textContent = '-';
      out.expense.textContent = '0';
      out.net.textContent = '0';
      out.note.textContent = '';
      out.detail.hidden = true;
      return;
    }

    var r = Calc.rentalIncomeTax(currentOpts());

    out.revenue.textContent = formatWon(r.revenue);
    out.tax.textContent = formatWon(r.tax);
    out.expense.textContent = formatWon(r.expense);
    out.net.textContent = formatWon(r.netIncome);

    if (!r.taxable) {
      out.taxLabel.textContent = '내야 할 세금';
      out.status.textContent = '비과세';
      out.method.textContent = '신고 의무 없음';
      out.note.textContent = r.reason === 'oneHouse'
        ? '1주택이고 기준시가가 12억 원을 넘지 않아 월세 수입은 비과세입니다. 종합소득세 신고 의무가 없습니다. 다만 주택이 늘거나 공시가격이 12억 원을 넘어서면 그 해부터 과세 대상이 되므로 매년 확인하세요.'
        : '입력하신 조건은 과세 대상이 아닙니다.';
      out.detail.hidden = true;
      return;
    }

    out.taxLabel.textContent = '내야 할 세금';
    out.status.textContent = '과세 대상';
    out.method.textContent = r.betterIsSeparate ? '분리과세' : '종합과세';
    out.detail.hidden = false;

    var notes = [];
    if (!r.canSeparate) {
      notes.push('총수입이 2,000만 원을 넘어 분리과세를 선택할 수 없고 종합과세로 신고해야 합니다.');
    } else if (!r.betterIsSeparate) {
      notes.push('소득이 적어 한계세율이 낮은 덕분에 종합과세가 더 유리합니다. 분리과세는 세율이 14%로 고정이라 항상 유리하지는 않습니다.');
    }
    if (r.deduction === 0 && r.canSeparate) {
      notes.push('임대소득을 뺀 종합소득금액이 2,000만 원을 넘어 기본공제 200만 원이 적용되지 않았습니다.');
    }
    if (Calc.toAmount(salaryInput.value) <= 0) {
      notes.push('연봉을 넣으면 종합과세와의 비교가 정확해집니다.');
    }
    if (r.revenue > 20000000) {
      notes.push('수입금액이 연 2,000만 원을 넘으면 사업자등록 의무도 생깁니다.');
    }
    out.note.textContent = notes.join(' ');

    renderRevenue(r);
    renderCompare(r);
  }

  [rentInput, depositInput, salaryInput].forEach(function (input) {
    input.addEventListener('input', function () {
      formatAmountField(input);
      render();
    });
  });
  houseSelect.addEventListener('change', render);
  highValue.addEventListener('change', render);
  registered.addEventListener('change', render);

  document.getElementById('reset-all').addEventListener('click', function () {
    houseSelect.value = '1';
    rentInput.value = '';
    depositInput.value = '';
    salaryInput.value = '';
    highValue.checked = false;
    registered.checked = false;
    render();
  });

  render();
})();

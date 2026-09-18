'use strict';

/* 실수령액 → 세전 연봉 역산 UI. 계산은 calc.js 의 Calc 를 그대로 쓴다. */

(function () {
  if (typeof document === 'undefined') return;

  var el = function (id) { return document.getElementById(id); };
  var netInput = el('net-monthly');
  var exemptInput = el('non-taxable');
  var familySelect = el('family-count');
  var childSelect = el('child-count');

  var out = {
    gross: el('out-gross'),
    annual: el('out-annual'),
    deduction: el('out-deduction'),
    rate: el('out-rate'),
    base: el('out-base'),
    marginal: el('out-marginal'),
    note: el('out-note'),
    detail: el('detail-block'),
    verifyRows: el('verify-rows'),
    bracketRows: el('bracket-rows')
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

  function renderVerify(detail, target) {
    clearRows(out.verifyRows);
    addRow(out.verifyRows, ['세전 급여', formatWon(detail.gross) + '원']);
    addRow(out.verifyRows, ['국민연금', '− ' + formatWon(detail.pension) + '원']);
    addRow(out.verifyRows, ['건강보험', '− ' + formatWon(detail.health) + '원']);
    addRow(out.verifyRows, ['장기요양', '− ' + formatWon(detail.care) + '원']);
    addRow(out.verifyRows, ['고용보험', '− ' + formatWon(detail.employment) + '원']);
    addRow(out.verifyRows, ['소득세', '− ' + formatWon(detail.incomeTax) + '원']);
    addRow(out.verifyRows, ['지방소득세', '− ' + formatWon(detail.localTax) + '원']);
    addRow(out.verifyRows, [
      detail.net === target ? '실수령액 (입력값과 일치)' : '실수령액',
      formatWon(detail.net) + '원'
    ], true);
  }

  // 과세표준이 어느 구간에 있는지 표로 보여 준다.
  function renderBrackets(base) {
    clearRows(out.bracketRows);
    var brackets = Calc.TAX_BRACKETS;
    for (var i = 0; i < brackets.length; i++) {
      var b = brackets[i];
      var from = i === 0 ? 0 : brackets[i - 1].upto;
      var label = isFinite(b.upto)
        ? formatWon(from / 10000) + '만 ~ ' + formatWon(b.upto / 10000) + '만 원'
        : formatWon(from / 10000) + '만 원 초과';
      var here = base > from && base <= b.upto;
      addRow(out.bracketRows, [
        label,
        b.pct + '%',
        b.deduct ? formatWon(b.deduct) + '원' : '-',
        here ? '← 내 구간' : ''
      ], here);
    }
  }

  function reset() {
    out.gross.textContent = '0';
    out.annual.textContent = '0';
    out.deduction.textContent = '0';
    out.rate.textContent = '0';
    out.base.textContent = '0';
    out.marginal.textContent = '0';
    out.note.textContent = '';
    out.detail.hidden = true;
  }

  function render() {
    var target = Calc.toAmount(netInput.value);
    if (target <= 0) {
      reset();
      return;
    }

    var exempt = Calc.toAmount(exemptInput.value);
    var family = parseInt(familySelect.value, 10) || 1;
    var children = parseInt(childSelect.value, 10) || 0;

    var r = Calc.grossFromNet(target, exempt, family, children);
    if (r.gross <= 0) {
      reset();
      return;
    }

    var detail = Calc.netPay(r.gross, exempt, family, children);
    var base = Calc.estimatedTaxBase(r.annual, family);

    out.gross.textContent = formatWon(r.gross);
    out.annual.textContent = formatWon(r.annual);
    out.deduction.textContent = formatWon(detail.deduction);
    out.rate.textContent = Math.round(detail.deduction / detail.gross * 1000) / 10;
    out.base.textContent = formatWon(base);
    out.marginal.textContent = Calc.marginalPct(base);
    out.detail.hidden = false;

    var notes = [];
    if (!r.exact) {
      notes.push('입력하신 실수령액에 정확히 맞는 세전 금액이 없어 가장 가까운 값(' +
        formatWon(r.net) + '원)으로 계산했습니다.');
    }
    if (r.spread > 0) {
      notes.push('같은 실수령액이 나오는 세전 급여는 ' + formatWon(r.gross) + '~' +
        formatWon(r.grossMax) + '원 범위입니다. 소득세가 계단 함수라 생기는 폭이며 오차가 아닙니다.');
    }
    notes.push('상여금과 성과급은 반영되지 않았습니다. 따로 받으신다면 실제 연봉은 이보다 큽니다.');
    out.note.textContent = notes.join(' ');

    renderVerify(detail, target);
    renderBrackets(base);
  }

  [netInput, exemptInput].forEach(function (input) {
    input.addEventListener('input', function () {
      formatAmountField(input);
      render();
    });
  });
  familySelect.addEventListener('change', render);
  childSelect.addEventListener('change', render);

  el('reset-all').addEventListener('click', function () {
    netInput.value = '';
    exemptInput.value = '200,000';
    familySelect.value = '1';
    childSelect.value = '0';
    render();
  });

  render();
})();

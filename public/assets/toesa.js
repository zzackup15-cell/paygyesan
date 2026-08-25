'use strict';

/* 퇴사 정산 시뮬레이터 UI. 계산은 calc.js 의 Calc.exitPackage 를 그대로 쓴다.
 * 조합 로직까지 calc.js 에 둔 이유는, UI 에 두면 검증 스위트가 닿지 못해
 * 개별 계산기와 값이 갈라져도 아무도 모르기 때문이다. */

(function () {
  if (typeof document === 'undefined') return;

  var el = function (id) { return document.getElementById(id); };
  var hireInput = el('date-hire');
  var lastInput = el('date-last');
  var wageInput = el('monthly-wage');
  var bonusInput = el('annual-bonus');
  var unusedInput = el('unused-days');
  var reasonSelect = el('quit-reason');
  var costInput = el('monthly-cost');
  var over50 = el('over-50');

  var out = {
    immediate: el('out-immediate'),
    total: el('out-total'),
    service: el('out-service'),
    severance: el('out-severance'),
    leave: el('out-leave'),
    benefit: el('out-benefit'),
    survival: el('out-survival'),
    note: el('out-note'),
    detail: el('detail-block'),
    missRows: el('miss-rows'),
    flowRows: el('flow-rows')
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

  function periodText(days) {
    if (!days) return '-';
    var y = Math.floor(days / 365);
    var m = Math.floor((days % 365) / 30);
    if (!y) return m + '개월';
    return y + '년 ' + m + '개월';
  }

  function currentOpts() {
    return {
      hireDate: hireInput.value,
      lastWorkDate: lastInput.value,
      monthlyWage: wageInput.value,
      annualBonus: bonusInput.value,
      unusedDays: unusedInput.value,
      monthlyCost: costInput.value,
      voluntary: reasonSelect.value === 'voluntary',
      isOver50: over50.checked
    };
  }

  // 실제로 사람들이 돈을 잃는 지점만 적는다. 겁주기가 아니라 사실이다.
  function renderMissed(r) {
    clearRows(out.missRows);
    var rows = [];
    if (Calc.toAmount(unusedInput.value) <= 0) {
      rows.push(['미사용 연차', '남은 연차는 돈으로 받습니다. 일수를 넣어 보세요']);
    }
    if (Calc.toAmount(bonusInput.value) <= 0) {
      rows.push(['연간 상여금', '상여금의 3/12 가 퇴직금에 더해집니다. 빠뜨리면 적게 나옵니다']);
    }
    if (r.benefitEligible) {
      rows.push(['실업급여 신청기한', '퇴직일 다음 날부터 12개월. 넘기면 남은 일수를 받지 못합니다']);
    } else if (r.reason === 'voluntary') {
      rows.push(['자발적 퇴사 예외', '체불·괴롭힘·통근곤란·질병 등은 수급이 인정됩니다. 고용센터에 확인하세요']);
    }
    rows.push(['지급 기한', '퇴직금과 연차수당은 퇴직일부터 14일 이내에 받아야 합니다']);
    for (var i = 0; i < rows.length; i++) addRow(out.missRows, rows[i]);
  }

  function renderFlow(r) {
    clearRows(out.flowRows);
    for (var i = 0; i < r.flow.length; i++) {
      var f = r.flow[i];
      addRow(out.flowRows, [
        f.month + '개월차',
        f.severance + f.leave > 0 ? formatWon(f.severance + f.leave) + '원' : '-',
        f.benefit > 0 ? formatWon(f.benefit) + '원' : '-',
        formatWon(f.amount) + '원',
        formatWon(f.cumulative) + '원'
      ], i === 0);
    }
  }

  function reset() {
    out.immediate.textContent = '0';
    out.total.textContent = '0';
    out.service.textContent = '-';
    out.severance.textContent = '0';
    out.leave.textContent = '0';
    out.benefit.textContent = '0';
    out.survival.textContent = '';
    out.note.textContent = '';
    out.detail.hidden = true;
  }

  function render() {
    var r = Calc.exitPackage(currentOpts());

    if (!r.serviceDays || Calc.toAmount(wageInput.value) <= 0) {
      reset();
      return;
    }

    out.immediate.textContent = formatWon(r.immediate);
    out.total.textContent = formatWon(r.total);
    out.service.textContent = periodText(r.serviceDays);
    out.severance.textContent = formatWon(r.severance);
    out.leave.textContent = formatWon(r.annualLeavePay);
    out.benefit.textContent = formatWon(r.benefitTotal);
    out.detail.hidden = false;

    out.survival.textContent = r.survivalMonths > 0
      ? '월 생활비 ' + formatWon(r.monthlyCost) + '원 기준으로 약 '
        + (Math.round(r.survivalMonths * 10) / 10) + '개월 버틸 수 있습니다.'
      : '';

    var notes = [];
    if (r.severance === 0) {
      notes.push('계속근로기간이 1년(365일)에 미치지 못해 퇴직금이 발생하지 않습니다. 퇴사일을 조정할 수 있다면 며칠 차이로 크게 달라집니다.');
    }
    if (r.reason === 'voluntary') {
      notes.push('자발적 퇴사로 계산해 실업급여를 넣지 않았습니다. 다만 임금 체불이나 직장 내 괴롭힘 등 정당한 이직 사유가 인정되면 받을 수 있습니다.');
    } else if (r.reason === 'shortInsured') {
      notes.push('재직기간이 짧아 실업급여 수급 요건(피보험 단위기간 180일)을 채우지 못했습니다.');
    }
    if (r.benefitEligible && r.ordinaryDaily > r.averageDaily) {
      notes.push('평균임금보다 통상임금이 높아 통상임금을 기준으로 계산했습니다. 근로기준법이 정한 유리한 쪽 적용입니다.');
    }
    notes.push('퇴직금은 세전 금액이며 퇴직소득세는 반영하지 않았습니다. 실업급여는 비과세입니다.');
    out.note.textContent = notes.join(' ');

    renderMissed(r);
    renderFlow(r);
  }

  [wageInput, bonusInput, costInput].forEach(function (input) {
    input.addEventListener('input', function () {
      formatAmountField(input);
      render();
    });
  });
  [hireInput, lastInput, unusedInput].forEach(function (input) {
    input.addEventListener('input', render);
  });
  reasonSelect.addEventListener('change', render);
  over50.addEventListener('change', render);

  el('reset-all').addEventListener('click', function () {
    hireInput.value = '';
    lastInput.value = '';
    wageInput.value = '';
    bonusInput.value = '';
    unusedInput.value = '';
    costInput.value = '';
    reasonSelect.value = 'involuntary';
    over50.checked = false;
    render();
  });

  render();
})();

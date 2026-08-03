'use strict';

/* ------------------------------------------------------------------
 * UI
 * ------------------------------------------------------------------ */

(function () {
  if (typeof document === 'undefined') return;

  var DEFAULT_ITEMS = [
    {
      name: '기본급', amount: 3000000, period: 'monthly', included: true,
      note: '소정근로의 대가로 정기적·일률적으로 지급되는 임금의 핵심입니다. 통상임금에 당연히 포함됩니다.'
    },
    {
      name: '직책수당', amount: 0, period: 'monthly', included: true,
      note: '직책이라는 일정 조건을 갖춘 사람에게 매월 일률적으로 지급되므로 통상임금에 포함됩니다.'
    },
    {
      name: '자격·기술수당', amount: 0, period: 'monthly', included: true,
      note: '자격·면허·기술 보유자에게 일률적으로 매월 지급되면 통상임금에 포함됩니다.'
    },
    {
      name: '식대·교통비', amount: 0, period: 'monthly', included: true,
      note: '전 직원에게 매월 같은 금액이 지급되면 통상임금에 포함됩니다. 실제 사용액만 정산해 주는 실비변상 성격이면 제외됩니다.'
    },
    {
      name: '정기상여금 (연간 총액)', amount: 0, period: 'annual', included: true,
      note: '2024.12.19. 대법원 전원합의체 판결로 재직조건·근무일수 조건이 붙은 정기상여금도 통상임금에 포함됩니다. 연간 총액을 12로 나눠 월 환산합니다.'
    },
    {
      name: '연장·야간·휴일근로수당', amount: 0, period: 'monthly', included: false,
      role: 'overtime',
      note: '실제 근로한 시간에 따라 금액이 달라지므로 소정근로의 대가가 아닙니다. 통상임금에서 제외됩니다. 아래 가산수당 계산기에 시간을 입력할 예정이라면 여기는 비워 두세요. 둘 다 채우면 같은 수당이 두 번 더해집니다.'
    },
    {
      name: '연차수당 (연간 총액)', amount: 0, period: 'annual', included: false,
      note: '미사용 연차 일수에 따라 사후적으로 정산되는 금액이라 소정근로의 대가가 아닙니다. 통상임금에서는 제외되지만 실제로 받는 돈이므로 지급총액에는 포함됩니다. 보통 연 1회 정산되므로 연간 총액으로 입력하세요.'
    },
    {
      name: '성과급 (실적 연동)', amount: 0, period: 'monthly', included: false,
      note: '개인·회사 실적에 따라 지급 여부와 금액이 달라져 정기성·일률성이 없어 통상임금에서 제외됩니다. 다만 실제로 받는 돈이므로 지급총액에는 포함됩니다. 연 1회 받는다면 지급주기를 연(÷12)으로 바꾸세요.'
    }
  ];

  var CUSTOM_NOTE = '직접 추가한 항목입니다. 소정근로의 대가로 정기적·일률적으로 지급하기로 정해진 금품이면 통상임금에 포함하세요.';

  var itemList = document.getElementById('item-list');
  var rowTemplate = document.getElementById('item-row-template');
  var addBtn = document.getElementById('add-item');
  var itemCountEl = document.getElementById('item-count');
  var weeklyInput = document.getElementById('weekly-hours');
  var holidayNote = document.getElementById('holiday-note');

  var out = {
    total: document.getElementById('out-total'),
    hourly: document.getElementById('out-hourly'),
    hours: document.getElementById('out-hours'),
    hoursFormula: document.getElementById('out-hours-formula'),
    daily: document.getElementById('out-daily'),
    grossMonthly: document.getElementById('out-gross-monthly'),
    annualOrdinary: document.getElementById('out-annual-ordinary'),
    annualGross: document.getElementById('out-annual-gross'),
    annualAll: document.getElementById('out-annual-all'),
    payGross: document.getElementById('out-pay-gross'),
    payFormula: document.getElementById('out-pay-formula'),
    netMonthly: document.getElementById('out-net-monthly'),
    netAnnual: document.getElementById('out-net-annual'),
    deductRate: document.getElementById('out-deduct-rate'),
    taxable: document.getElementById('out-taxable')
  };

  var deductOut = {
    pension: document.getElementById('ded-pension'),
    health: document.getElementById('ded-health'),
    care: document.getElementById('ded-care'),
    employment: document.getElementById('ded-employment'),
    incomeTax: document.getElementById('ded-income-tax'),
    localTax: document.getElementById('ded-local-tax'),
    total: document.getElementById('ded-total')
  };

  var nonTaxableInput = document.getElementById('non-taxable');
  var familyInput = document.getElementById('family-count');
  var childInput = document.getElementById('child-count');

  function readCount(input, min, max) {
    var digits = input.value.replace(/[^0-9]/g, '');
    var n = digits === '' ? min : parseInt(digits, 10);
    if (!isFinite(n)) n = min;
    return Math.min(Math.max(n, min), max);
  }

  var extraRows = [
    { input: 'hours-overtime', out: 'pay-overtime', key: 'overtime' },
    { input: 'hours-night', out: 'pay-night', key: 'night' },
    { input: 'hours-holiday8', out: 'pay-holiday8', key: 'holidayWithin8' },
    { input: 'hours-holiday-over', out: 'pay-holiday-over', key: 'holidayOver8' }
  ];
  var extraTotalEl = document.getElementById('pay-extra-total');
  var dupWarning = document.getElementById('dup-warning');

  function formatWon(n) {
    if (!isFinite(n)) n = 0;
    return Math.round(n).toLocaleString('ko-KR');
  }

  function formatDecimal(n, digits) {
    if (!isFinite(n)) n = 0;
    return n.toLocaleString('ko-KR', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits
    });
  }

  function readItems() {
    var rows = itemList.querySelectorAll('[data-item]');
    var items = [];
    for (var i = 0; i < rows.length; i++) {
      items.push({
        amount: rows[i].querySelector('.item-amount').value,
        period: rows[i].querySelector('.item-period').value === 'annual' ? 'annual' : 'monthly',
        included: rows[i].querySelector('.item-included').checked,
        role: rows[i].getAttribute('data-role') || '',
        name: rows[i].querySelector('.item-name').value
      });
    }
    return items;
  }

  function render() {
    var weekly = Calc.toHours(weeklyInput.value);
    if (weekly > Calc.LEGAL_WEEKLY_MAX) weekly = Calc.LEGAL_WEEKLY_MAX;

    var monthlyHours = Calc.monthlyScheduledHours(weekly);
    var items = readItems();
    var total = Calc.totalOrdinaryWage(items);
    var hourly = Calc.hourlyOrdinaryWage(total, monthlyHours);
    var d = Calc.derived(hourly);

    out.total.textContent = formatWon(total);
    out.hourly.textContent = formatDecimal(hourly, 1);
    out.hours.textContent = formatDecimal(monthlyHours, 0);
    out.daily.textContent = formatWon(d.daily);

    var holidayHours = Calc.weeklyHolidayHours(weekly);
    out.hoursFormula.textContent =
      '(주 ' + formatDecimal(weekly, weekly % 1 === 0 ? 0 : 1) + '시간 + 주휴 ' +
      formatDecimal(holidayHours, holidayHours % 1 === 0 ? 0 : 1) + '시간) × 365 ÷ 7 ÷ 12';

    holidayNote.textContent = weekly > 0 && weekly < Calc.MIN_WEEKLY_FOR_HOLIDAY
      ? '주 15시간 미만은 주휴수당이 발생하지 않아 주휴시간을 0으로 계산했습니다.'
      : '';

    var extraSum = 0;
    for (var i = 0; i < extraRows.length; i++) {
      var row = extraRows[i];
      var hours = Calc.toHours(document.getElementById(row.input).value);
      var pay = d[row.key] * hours;
      extraSum += pay;
      document.getElementById(row.out).textContent = formatWon(pay) + '원';
    }
    extraTotalEl.textContent = formatWon(extraSum) + '원';

    // 같은 잔업수당을 항목과 시간 양쪽에 입력하면 이중 계상된다
    var overtimeItem = 0;
    var overtimeName = '';
    for (var k = 0; k < items.length; k++) {
      if (items[k].role === 'overtime') {
        overtimeItem += Calc.monthlyOf(items[k]);
        if (!overtimeName) overtimeName = items[k].name;
      }
    }
    var conflict = Math.round(overtimeItem) > 0 && Math.round(extraSum) > 0;
    if (conflict) {
      // 사용자가 바꾼 항목명을 그대로 쓰되 textContent로만 반영한다
      var label = overtimeName.replace(/\s+/g, ' ').trim() || '연장·야간·휴일근로수당';
      dupWarning.textContent =
        '중복 입력으로 보입니다. ‘' + label + '’ 항목에 ' + formatWon(overtimeItem) + '원, ' +
        '아래 가산수당 계산기에 ' + formatWon(extraSum) + '원이 각각 잡혀 ' +
        '월 지급총액에 두 금액이 모두 더해졌습니다(합계 ' + formatWon(overtimeItem + extraSum) + '원). ' +
        '같은 잔업수당이라면 둘 중 하나만 남기세요.';
      dupWarning.removeAttribute('hidden');
    } else {
      dupWarning.textContent = '';
      dupWarning.setAttribute('hidden', '');
    }

    // 연봉 환산
    var gross = Calc.totalGrossWage(items);
    out.grossMonthly.textContent = formatWon(gross);
    out.annualOrdinary.textContent = formatWon(Calc.toAnnual(total));
    out.annualGross.textContent = formatWon(Calc.toAnnual(gross));
    out.annualAll.textContent = formatWon(Calc.toAnnual(gross + extraSum));

    // 실수령액 추정 — 그 달에 실제 지급되는 총액(급여 + 가산수당)이 기준
    var payGross = gross + extraSum;
    var net = Calc.netPay(
      payGross,
      nonTaxableInput.value,
      readCount(familyInput, 1, Calc.MAX_FAMILY),
      readCount(childInput, 0, Calc.MAX_CHILDREN)
    );

    deductOut.pension.textContent = formatWon(net.pension) + '원';
    deductOut.health.textContent = formatWon(net.health) + '원';
    deductOut.care.textContent = formatWon(net.care) + '원';
    deductOut.employment.textContent = formatWon(net.employment) + '원';
    deductOut.incomeTax.textContent = formatWon(net.incomeTax) + '원';
    deductOut.localTax.textContent = formatWon(net.localTax) + '원';
    deductOut.total.textContent = formatWon(net.deduction) + '원';

    out.payGross.textContent = formatWon(net.gross);

    // 2번의 통상임금 총액과 왜 다른지 내역을 드러낸다
    var excluded = gross - total;
    var parts = ['통상임금 ' + formatWon(total) + '원'];
    if (Math.round(excluded) > 0) parts.push('통상임금 제외 항목 ' + formatWon(excluded) + '원');
    if (Math.round(extraSum) > 0) parts.push('가산수당 ' + formatWon(extraSum) + '원');
    out.payFormula.textContent = '월 지급총액 = ' + parts.join('  +  ');

    out.netMonthly.textContent = formatWon(net.net);
    out.netAnnual.textContent = formatWon(Calc.toAnnual(net.net));
    out.taxable.textContent = formatWon(net.taxable);
    out.deductRate.textContent = net.gross > 0
      ? formatDecimal(net.deduction / net.gross * 100, 1)
      : '0.0';
  }

  function formatAmountField(input) {
    var caret = input.selectionStart;
    var digitsBefore = input.value.slice(0, caret).replace(/[^0-9]/g, '').length;
    var value = Calc.toAmount(input.value);
    var next = input.value.replace(/[^0-9]/g, '') === '' ? '' : value.toLocaleString('ko-KR');
    if (next !== input.value) {
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
  }

  function updateCount() {
    var count = itemList.querySelectorAll('[data-item]').length;
    itemCountEl.textContent = count + ' / ' + Calc.MAX_ITEMS;
    addBtn.disabled = count >= Calc.MAX_ITEMS;
  }

  function createRow(data) {
    var frag = rowTemplate.content.cloneNode(true);
    var row = frag.querySelector('[data-item]');

    var nameInput = row.querySelector('.item-name');
    var amountInput = row.querySelector('.item-amount');
    var periodSelect = row.querySelector('.item-period');
    var includedInput = row.querySelector('.item-included');
    var noteEl = row.querySelector('.item-note');
    var noteToggle = row.querySelector('.note-toggle');

    // 항목명을 바꿔도 역할은 유지되어야 중복 감지가 계속 동작한다
    if (data.role) row.setAttribute('data-role', data.role);

    // 사용자 입력은 항상 value/textContent로만 반영 (innerHTML 미사용)
    nameInput.value = data.name;
    amountInput.value = data.amount ? Calc.toAmount(data.amount).toLocaleString('ko-KR') : '';
    periodSelect.value = data.period === 'annual' ? 'annual' : 'monthly';
    includedInput.checked = !!data.included;
    noteEl.textContent = data.note;

    noteToggle.addEventListener('click', function () {
      var open = noteEl.hasAttribute('hidden');
      if (open) { noteEl.removeAttribute('hidden'); } else { noteEl.setAttribute('hidden', ''); }
      noteToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    row.querySelector('.item-remove').addEventListener('click', function () {
      row.remove();
      updateCount();
      render();
    });

    // 항목명은 계산에 쓰이지 않지만 중복 경고 문구에 반영되므로 다시 그린다
    nameInput.addEventListener('input', render);

    amountInput.addEventListener('input', function () {
      formatAmountField(amountInput);
      render();
    });
    periodSelect.addEventListener('change', render);
    includedInput.addEventListener('change', render);

    return row;
  }

  function addRow(data) {
    if (itemList.querySelectorAll('[data-item]').length >= Calc.MAX_ITEMS) return;
    itemList.appendChild(createRow(data));
    updateCount();
  }

  for (var i = 0; i < DEFAULT_ITEMS.length; i++) addRow(DEFAULT_ITEMS[i]);

  addBtn.addEventListener('click', function () {
    addRow({ name: '', amount: 0, period: 'monthly', included: true, note: CUSTOM_NOTE });
    var rows = itemList.querySelectorAll('[data-item]');
    if (rows.length) rows[rows.length - 1].querySelector('.item-name').focus();
    render();
  });

  weeklyInput.addEventListener('input', render);
  weeklyInput.addEventListener('blur', function () {
    var w = Calc.toHours(weeklyInput.value);
    if (w > Calc.LEGAL_WEEKLY_MAX) w = Calc.LEGAL_WEEKLY_MAX;
    weeklyInput.value = w ? String(w) : '';
    render();
  });

  for (var j = 0; j < extraRows.length; j++) {
    document.getElementById(extraRows[j].input).addEventListener('input', render);
  }

  nonTaxableInput.addEventListener('input', function () {
    formatAmountField(nonTaxableInput);
    render();
  });
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
    var rows = itemList.querySelectorAll('[data-item]');
    for (var k = 0; k < rows.length; k++) rows[k].remove();
    for (var m = 0; m < DEFAULT_ITEMS.length; m++) addRow(DEFAULT_ITEMS[m]);
    weeklyInput.value = '40';
    for (var n = 0; n < extraRows.length; n++) document.getElementById(extraRows[n].input).value = '';
    nonTaxableInput.value = '200,000';
    familyInput.value = '1';
    childInput.value = '0';
    render();
  });

  render();
})();

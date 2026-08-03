'use strict';

/* ------------------------------------------------------------------
 * 통상임금 계산 로직 (순수 함수) — paygyesan.com
 * ------------------------------------------------------------------ */

var Calc = (function () {
  var MAX_ITEMS = 30;
  var MAX_AMOUNT = 100000000000; // 1000억 원
  var MAX_HOURS = 999;
  var WEEKS_PER_MONTH = 365 / 7 / 12; // 4.345238095...
  var MIN_WEEKLY_FOR_HOLIDAY = 15; // 근로기준법 제18조 제3항
  var LEGAL_WEEKLY_MAX = 40;

  function toAmount(raw) {
    if (typeof raw === 'number') {
      if (!isFinite(raw) || raw < 0) return 0;
      return Math.min(Math.floor(raw), MAX_AMOUNT);
    }
    var digits = String(raw == null ? '' : raw).replace(/[^0-9]/g, '');
    if (digits === '') return 0;
    digits = digits.slice(0, 15);
    var n = parseInt(digits, 10);
    if (!isFinite(n)) return 0;
    return Math.min(n, MAX_AMOUNT);
  }

  function toHours(raw) {
    var cleaned = String(raw == null ? '' : raw).replace(/[^0-9.]/g, '');
    var parts = cleaned.split('.');
    if (parts.length > 2) cleaned = parts[0] + '.' + parts[1];
    var n = parseFloat(cleaned);
    if (!isFinite(n) || n < 0) return 0;
    return Math.min(Math.round(n * 10) / 10, MAX_HOURS);
  }

  // 주휴시간: 주 15시간 이상일 때만 발생, 주 40시간 기준 8시간을 비례 적용
  function weeklyHolidayHours(weeklyHours) {
    if (weeklyHours < MIN_WEEKLY_FOR_HOLIDAY) return 0;
    return (Math.min(weeklyHours, LEGAL_WEEKLY_MAX) / LEGAL_WEEKLY_MAX) * 8;
  }

  // 월 소정근로시간 = (주 소정근로시간 + 주휴시간) × (365 ÷ 7) ÷ 12
  function monthlyScheduledHours(weeklyHours) {
    var w = toHours(weeklyHours);
    if (w > LEGAL_WEEKLY_MAX) w = LEGAL_WEEKLY_MAX;
    var hours = Math.round((w + weeklyHolidayHours(w)) * WEEKS_PER_MONTH);
    return hours < 1 ? 0 : hours;
  }

  // 항목의 월 환산액 (연간 항목은 ÷12)
  function monthlyOf(item) {
    var amount = toAmount(item.amount);
    return item.period === 'annual' ? amount / 12 : amount;
  }

  function totalOrdinaryWage(items) {
    var sum = 0;
    for (var i = 0; i < items.length; i++) {
      if (items[i].included) sum += monthlyOf(items[i]);
    }
    return isFinite(sum) ? sum : 0;
  }

  // 통상임금 포함 여부와 무관하게 입력한 모든 항목의 월 환산 합계 (세전 급여 총액)
  function totalGrossWage(items) {
    var sum = 0;
    for (var i = 0; i < items.length; i++) {
      sum += monthlyOf(items[i]);
    }
    return isFinite(sum) ? sum : 0;
  }

  function toAnnual(monthly) {
    if (!isFinite(monthly) || monthly < 0) return 0;
    return monthly * 12;
  }

  function hourlyOrdinaryWage(totalWage, monthlyHours) {
    if (!isFinite(totalWage) || !isFinite(monthlyHours) || monthlyHours <= 0) return 0;
    return totalWage / monthlyHours;
  }

  function derived(hourly) {
    return {
      overtime: hourly * 1.5,      // 연장근로 (통상시급 × 1.5)
      night: hourly * 0.5,         // 야간 가산 (22시~06시)
      holidayWithin8: hourly * 1.5, // 휴일근로 8시간 이내
      holidayOver8: hourly * 2.0,   // 휴일근로 8시간 초과분
      daily: hourly * 8             // 통상일급
    };
  }

  return {
    MAX_ITEMS: MAX_ITEMS,
    MAX_AMOUNT: MAX_AMOUNT,
    WEEKS_PER_MONTH: WEEKS_PER_MONTH,
    MIN_WEEKLY_FOR_HOLIDAY: MIN_WEEKLY_FOR_HOLIDAY,
    LEGAL_WEEKLY_MAX: LEGAL_WEEKLY_MAX,
    toAmount: toAmount,
    toHours: toHours,
    weeklyHolidayHours: weeklyHolidayHours,
    monthlyScheduledHours: monthlyScheduledHours,
    monthlyOf: monthlyOf,
    totalOrdinaryWage: totalOrdinaryWage,
    totalGrossWage: totalGrossWage,
    toAnnual: toAnnual,
    hourlyOrdinaryWage: hourlyOrdinaryWage,
    derived: derived
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Calc;

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
      note: '실제 근로한 시간에 따라 금액이 달라지므로 소정근로의 대가가 아닙니다. 통상임금에서 제외됩니다.'
    },
    {
      name: '연차수당', amount: 0, period: 'monthly', included: false,
      note: '미사용 연차 일수에 따라 사후적으로 정산되는 금액이라 소정근로의 대가가 아닙니다. 제외됩니다.'
    },
    {
      name: '성과급 (실적 연동)', amount: 0, period: 'monthly', included: false,
      note: '개인·회사 실적에 따라 지급 여부와 금액이 달라져 정기성·일률성이 없습니다. 제외됩니다.'
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
    annualAll: document.getElementById('out-annual-all')
  };

  var extraRows = [
    { input: 'hours-overtime', out: 'pay-overtime', key: 'overtime' },
    { input: 'hours-night', out: 'pay-night', key: 'night' },
    { input: 'hours-holiday8', out: 'pay-holiday8', key: 'holidayWithin8' },
    { input: 'hours-holiday-over', out: 'pay-holiday-over', key: 'holidayOver8' }
  ];
  var extraTotalEl = document.getElementById('pay-extra-total');

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
        included: rows[i].querySelector('.item-included').checked
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

    // 연봉 환산
    var gross = Calc.totalGrossWage(items);
    out.grossMonthly.textContent = formatWon(gross);
    out.annualOrdinary.textContent = formatWon(Calc.toAnnual(total));
    out.annualGross.textContent = formatWon(Calc.toAnnual(gross));
    out.annualAll.textContent = formatWon(Calc.toAnnual(gross + extraSum));
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

  document.getElementById('reset-all').addEventListener('click', function () {
    var rows = itemList.querySelectorAll('[data-item]');
    for (var k = 0; k < rows.length; k++) rows[k].remove();
    for (var m = 0; m < DEFAULT_ITEMS.length; m++) addRow(DEFAULT_ITEMS[m]);
    weeklyInput.value = '40';
    for (var n = 0; n < extraRows.length; n++) document.getElementById(extraRows[n].input).value = '';
    render();
  });

  render();
})();

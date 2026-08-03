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

  /* ---- 4대보험 · 소득세 (세후 추정) ---- */

  // 2026년 요율. 근로자 부담분 기준.
  var RATES = {
    year: 2026,
    pension: { rate: 0.0475, min: 410000, max: 6590000 }, // 국민연금 (기준소득월액 2026.7~2027.6)
    health: { rate: 0.03595 },                            // 건강보험
    care: { ofHealth: 0.1314 },                           // 장기요양 = 건강보험료 × 13.14%
    employment: { rate: 0.009 },                          // 고용보험 실업급여
    localTax: 0.1                                         // 지방소득세 = 소득세 × 10%
  };

  var MAX_FAMILY = 11; // 간이세액표 열 상한
  var MAX_CHILDREN = 10;

  function floor10(n) {
    if (!isFinite(n) || n <= 0) return 0;
    return Math.floor(n / 10) * 10;
  }

  // 간이세액표 디코딩 (최초 1회)
  var decodedTable = null;
  function table() {
    if (decodedTable) return decodedTable;
    if (typeof TAX_TABLE === 'undefined' || !TAX_TABLE) return null;

    var bounds = [TAX_TABLE.from];
    var parts = TAX_TABLE.bounds.split(',');
    var acc = TAX_TABLE.from;
    for (var i = 0; i < parts.length; i++) {
      acc += parseInt(parts[i], 36);
      bounds.push(acc);
    }

    var lines = TAX_TABLE.data.split(';');
    var rows = [];
    var prevFirst = 0;
    for (var r = 0; r < lines.length; r++) {
      var deltas = lines[r].split(',');
      var row = [];
      var v = prevFirst + parseInt(deltas[0], 36);
      prevFirst = v;
      row.push(v * 10);
      for (var c = 1; c < 11; c++) {
        v += parseInt(deltas[c], 36);
        row.push(v * 10);
      }
      rows.push(row);
    }

    decodedTable = { bounds: bounds, rows: rows, top: TAX_TABLE.top };
    return decodedTable;
  }

  // 월급여액 1,000만원 초과 구간 산식 (별표2 제6호)
  function taxOver10M(wage, top) {
    if (wage <= 14000000) return top + (wage - 10000000) * 0.98 * 0.35 + 25000;
    if (wage <= 28000000) return top + 1397000 + (wage - 14000000) * 0.98 * 0.38;
    if (wage <= 30000000) return top + 6610600 + (wage - 28000000) * 0.98 * 0.40;
    if (wage <= 45000000) return top + 7394600 + (wage - 30000000) * 0.40;
    if (wage <= 87000000) return top + 13394600 + (wage - 45000000) * 0.42;
    return top + 31034600 + (wage - 87000000) * 0.45;
  }

  // 8세 이상 20세 이하 자녀 세액공제 (별표2 제3호)
  function childCredit(children) {
    var n = Math.min(Math.max(Math.floor(children) || 0, 0), MAX_CHILDREN);
    if (n <= 0) return 0;
    if (n === 1) return 20830;
    if (n === 2) return 45830;
    return 45830 + (n - 2) * 33330;
  }

  // 근로소득 간이세액표상 월 원천징수 소득세
  function incomeTax(taxableMonthly, family, children) {
    var t = table();
    if (!t) return 0;
    var wage = isFinite(taxableMonthly) && taxableMonthly > 0 ? taxableMonthly : 0;
    var fam = Math.min(Math.max(Math.floor(family) || 1, 1), MAX_FAMILY);
    var col = fam - 1;

    var tax;
    if (wage === 10000000) {
      tax = t.top[col];
    } else if (wage > 10000000) {
      tax = floor10(taxOver10M(wage, t.top[col]));
    } else {
      var thousand = wage / 1000;
      if (thousand < t.bounds[0]) return 0;
      var lo = 0;
      var hi = t.rows.length - 1;
      while (lo < hi) {
        var mid = (lo + hi + 1) >> 1;
        if (t.bounds[mid] <= thousand) lo = mid; else hi = mid - 1;
      }
      tax = t.rows[lo][col];
    }

    return Math.max(0, tax - childCredit(children));
  }

  // 4대보험 근로자 부담분
  function insurance(taxableMonthly) {
    var base = isFinite(taxableMonthly) && taxableMonthly > 0 ? taxableMonthly : 0;

    // 국민연금 기준소득월액은 천원 단위 절사 후 상·하한 적용
    var pensionBase = Math.floor(base / 1000) * 1000;
    if (pensionBase < RATES.pension.min) pensionBase = base > 0 ? RATES.pension.min : 0;
    if (pensionBase > RATES.pension.max) pensionBase = RATES.pension.max;

    var pension = floor10(pensionBase * RATES.pension.rate);
    var health = floor10(base * RATES.health.rate);
    var care = floor10(health * RATES.care.ofHealth);
    var employment = floor10(base * RATES.employment.rate);

    return {
      pension: pension,
      health: health,
      care: care,
      employment: employment,
      total: pension + health + care + employment
    };
  }

  // 월 실수령액 추정
  function netPay(monthlyGross, nonTaxable, family, children) {
    var gross = isFinite(monthlyGross) && monthlyGross > 0 ? monthlyGross : 0;
    var exempt = Math.min(Math.max(toAmount(nonTaxable), 0), gross);
    var taxable = gross - exempt;

    var ins = insurance(taxable);
    var tax = incomeTax(taxable, family, children);
    var local = floor10(tax * RATES.localTax);
    var deduction = ins.total + tax + local;

    return {
      gross: gross,
      taxable: taxable,
      nonTaxable: exempt,
      pension: ins.pension,
      health: ins.health,
      care: ins.care,
      employment: ins.employment,
      insuranceTotal: ins.total,
      incomeTax: tax,
      localTax: local,
      deduction: deduction,
      net: Math.max(0, gross - deduction)
    };
  }

  return {
    MAX_ITEMS: MAX_ITEMS,
    MAX_AMOUNT: MAX_AMOUNT,
    MAX_FAMILY: MAX_FAMILY,
    MAX_CHILDREN: MAX_CHILDREN,
    RATES: RATES,
    incomeTax: incomeTax,
    childCredit: childCredit,
    insurance: insurance,
    netPay: netPay,
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

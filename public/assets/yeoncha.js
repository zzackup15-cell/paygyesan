'use strict';

/* 연차수당 계산기 UI. 계산은 calc.js 의 Calc 를 그대로 쓴다. */

(function () {
  if (typeof document === 'undefined') return;

  var hireInput = document.getElementById('date-hire');
  var baseInput = document.getElementById('date-base');
  var ordinaryInput = document.getElementById('monthly-ordinary');
  var dailyHoursInput = document.getElementById('daily-hours');
  var unusedInput = document.getElementById('unused-days');

  var out = {
    service: document.getElementById('out-service'),
    currentDays: document.getElementById('out-current-days'),
    firstYearDays: document.getElementById('out-first-year-days'),
    hourly: document.getElementById('out-hourly'),
    daily: document.getElementById('out-daily'),
    pay: document.getElementById('out-pay'),
    formula: document.getElementById('out-formula'),
    leaveLabel: document.getElementById('out-leave-label'),
    nextLabel: document.getElementById('out-next-label')
  };

  var alertDate = document.getElementById('alert-date');
  var alertFirstYear = document.getElementById('alert-first-year');
  var unusedHint = document.getElementById('unused-hint');

  var unusedTouched = false;

  function formatWon(n) {
    if (!isFinite(n)) n = 0;
    return Math.round(n).toLocaleString('ko-KR');
  }

  function formatNum(n, digits) {
    if (!isFinite(n)) n = 0;
    return n.toLocaleString('ko-KR', { maximumFractionDigits: digits === undefined ? 1 : digits });
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

  function serviceText(months) {
    if (months <= 0) return '1개월 미만';
    var y = Math.floor(months / 12);
    var m = months % 12;
    var parts = [];
    if (y) parts.push(y + '년');
    if (m) parts.push(m + '개월');
    return parts.join(' ');
  }

  function showAlert(el, text) {
    if (text) {
      el.textContent = text;
      el.removeAttribute('hidden');
    } else {
      el.textContent = '';
      el.setAttribute('hidden', '');
    }
  }

  function render() {
    var hire = Calc.parseDate(hireInput.value);
    var base = Calc.parseDate(baseInput.value);

    var info = { months: 0, years: 0, firstYearDays: 0, annualDays: 0, currentDays: 0, isFirstYear: true };

    if (hire && base) {
      if (Calc.daysBetween(hire, base) < 0) {
        showAlert(alertDate, '기준일이 입사일보다 앞섭니다. 날짜를 확인해 주세요.');
      } else {
        showAlert(alertDate, '');
        info = Calc.annualLeaveDays(hire, base);
      }
    } else {
      showAlert(alertDate, '');
    }

    out.service.textContent = hire && base ? serviceText(info.months) : '-';
    out.currentDays.textContent = formatNum(info.currentDays, 0);
    out.firstYearDays.textContent = formatNum(info.firstYearDays, 0);

    out.leaveLabel.textContent = info.isFirstYear
      ? '지금까지 발생한 연차'
      : '이번 연차 산정기간 발생분';

    // 다음 단계 안내
    if (!hire || !base) {
      out.nextLabel.textContent = '';
    } else if (info.isFirstYear) {
      out.nextLabel.textContent = '입사 1년이 되면 15일이 한 번에 발생합니다.';
    } else if (info.annualDays < Calc.MAX_ANNUAL_LEAVE) {
      var nextYear = info.years % 2 === 1 ? info.years + 2 : info.years + 1;
      out.nextLabel.textContent = '근속 ' + nextYear + '년차에 ' + (info.annualDays + 1) + '일로 늘어납니다.';
    } else {
      out.nextLabel.textContent = '법정 한도인 25일에 도달했습니다.';
    }

    showAlert(alertFirstYear, info.isFirstYear && info.months > 0
      ? '입사 1년 미만이라 1개월 개근마다 1일씩 발생합니다(최대 11일). ' +
        '이 연차는 입사일로부터 1년 안에 써야 하며, 남으면 미사용수당으로 정산받습니다.'
      : '');

    // 미사용 일수 기본값은 발생일수로 채우되, 사용자가 직접 고치면 건드리지 않는다
    if (!unusedTouched) {
      unusedInput.value = info.currentDays ? String(info.currentDays) : '';
    }
    unusedHint.textContent = unusedTouched
      ? '발생일수는 ' + info.currentDays + '일입니다.'
      : '발생일수를 자동으로 넣었습니다. 실제 남은 일수로 바꾸세요.';

    var monthlyOrdinary = Calc.toAmount(ordinaryInput.value);
    var dailyHours = Math.min(Calc.toHours(dailyHoursInput.value), 24);
    var hourly = Calc.hourlyOrdinaryWage(monthlyOrdinary, Calc.monthlyScheduledHours(40));
    var daily = hourly * dailyHours;
    var unused = Calc.toHours(unusedInput.value);
    if (unused > Calc.MAX_UNUSED_DAYS) unused = Calc.MAX_UNUSED_DAYS;
    var pay = Calc.annualLeavePay(daily, unused);

    out.hourly.textContent = formatNum(hourly, 1);
    out.daily.textContent = formatWon(daily);
    out.pay.textContent = formatWon(pay);

    out.formula.textContent = pay > 0
      ? formatWon(daily) + '원 × ' + formatNum(unused, 1) + '일   |   1일 통상임금 = ' +
        formatNum(hourly, 1) + '원 × ' + formatNum(dailyHours, 1) + '시간'
      : '';
  }

  [ordinaryInput].forEach(function (input) {
    input.addEventListener('input', function () {
      formatAmountField(input);
      render();
    });
  });

  dailyHoursInput.addEventListener('input', render);
  hireInput.addEventListener('input', render);
  hireInput.addEventListener('change', render);
  baseInput.addEventListener('input', render);
  baseInput.addEventListener('change', render);

  unusedInput.addEventListener('input', function () {
    unusedTouched = true;
    render();
  });

  document.getElementById('reset-all').addEventListener('click', function () {
    unusedTouched = false;
    hireInput.value = '';
    baseInput.value = new Date().toISOString().slice(0, 10);
    ordinaryInput.value = '';
    dailyHoursInput.value = '8';
    unusedInput.value = '';
    render();
  });

  // 기준일 기본값은 오늘
  if (!baseInput.value) baseInput.value = new Date().toISOString().slice(0, 10);

  render();
})();

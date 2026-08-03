'use strict';

/* 주휴수당 계산기 UI. 계산은 calc.js 의 Calc 를 그대로 쓴다. */

(function () {
  if (typeof document === 'undefined') return;

  var MAX_DAYS = 7;
  var MAX_DAILY_HOURS = 24;

  var hourlyInput = document.getElementById('wage-hourly');
  var dailyInput = document.getElementById('work-daily');
  var daysInput = document.getElementById('work-days');

  var out = {
    weekly: document.getElementById('out-weekly-hours'),
    holidayHours: document.getElementById('out-holiday-hours'),
    holidayPay: document.getElementById('out-holiday-pay'),
    basePay: document.getElementById('out-base-pay'),
    weekPay: document.getElementById('out-week-pay'),
    monthPay: document.getElementById('out-month-pay'),
    monthHours: document.getElementById('out-month-hours'),
    formula: document.getElementById('out-formula')
  };

  var alertEligible = document.getElementById('alert-eligible');
  var alertMinWage = document.getElementById('alert-minwage');
  var minWageLabel = document.getElementById('minwage-label');

  function formatWon(n) {
    if (!isFinite(n)) n = 0;
    return Math.round(n).toLocaleString('ko-KR');
  }

  function formatHours(n) {
    if (!isFinite(n)) n = 0;
    return n.toLocaleString('ko-KR', { maximumFractionDigits: 1 });
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

  function render() {
    var hourly = Calc.toAmount(hourlyInput.value);
    var daily = Math.min(Calc.toHours(dailyInput.value), MAX_DAILY_HOURS);
    var days = Math.min(Calc.toHours(daysInput.value), MAX_DAYS);

    var weekly = daily * days;
    // 소정근로시간 상한은 주 40시간. 초과분은 연장근로라 주휴 산정에 들어가지 않는다.
    var weeklyForHoliday = Math.min(weekly, Calc.LEGAL_WEEKLY_MAX);
    var holidayHours = Calc.weeklyHolidayHours(weeklyForHoliday);
    var holidayPay = holidayHours * hourly;
    var basePay = weekly * hourly;
    var monthHours = Calc.monthlyScheduledHours(weeklyForHoliday);

    out.weekly.textContent = formatHours(weekly);
    out.holidayHours.textContent = formatHours(holidayHours);
    out.holidayPay.textContent = formatWon(holidayPay);
    out.basePay.textContent = formatWon(basePay);
    out.weekPay.textContent = formatWon(basePay + holidayPay);
    out.monthHours.textContent = formatHours(monthHours);

    // 월 환산은 주급 × 4.345 가 아니라 '월 소정근로시간 × 시급' 으로 구한다.
    // 월 소정근로시간은 반올림된 값(주 40시간이면 209)이고, 고용노동부의
    // 최저임금 월 환산액도 이 방식을 쓴다. 주급을 4.345배 하면 209 대신
    // 208.57 을 쓰는 셈이 되어 고시액과 4천 원가량 어긋난다.
    var monthPay = monthHours * hourly;
    // 주 40시간을 넘겨 일하는 경우 초과분은 월 소정근로시간에 잡히지 않으므로
    // 실제 지급액과 벌어진다. 소정근로 기준 금액임을 아래 안내에 적어 두었다.
    out.monthPay.textContent = formatWon(monthPay);

    out.formula.textContent = holidayHours > 0
      ? '주휴시간 ' + formatHours(holidayHours) + '시간 = ' + formatHours(weeklyForHoliday) +
        '시간 ÷ 40 × 8   |   주휴수당 = ' + formatHours(holidayHours) + '시간 × ' + formatWon(hourly) + '원'
      : '주 소정근로시간이 15시간 미만이라 주휴시간이 발생하지 않습니다.';

    if (weekly > 0 && weekly < Calc.MIN_WEEKLY_FOR_HOLIDAY) {
      alertEligible.textContent =
        '주 소정근로시간이 ' + formatHours(weekly) + '시간으로 15시간 미만입니다. ' +
        '근로기준법상 초단시간 근로자는 주휴수당이 발생하지 않아 0원으로 계산했습니다. ' +
        '다만 4주를 평균해 주 15시간 이상이면 주휴수당을 받을 수 있으니, 주마다 근무시간이 다르다면 4주 평균으로 넣어 보세요.';
      alertEligible.removeAttribute('hidden');
    } else {
      alertEligible.textContent = '';
      alertEligible.setAttribute('hidden', '');
    }

    var min = Calc.RATES.minWage;
    if (hourly > 0 && hourly < min.hourly) {
      alertMinWage.textContent =
        '입력하신 시급 ' + formatWon(hourly) + '원은 ' + min.year + '년 최저임금 ' +
        formatWon(min.hourly) + '원보다 ' + formatWon(min.hourly - hourly) + '원 낮습니다. ' +
        '최저임금 미만으로 정한 근로계약은 그 부분이 무효이며, 최저임금액으로 지급해야 합니다.';
      alertMinWage.removeAttribute('hidden');
    } else {
      alertMinWage.textContent = '';
      alertMinWage.setAttribute('hidden', '');
    }
  }

  var min = Calc.RATES.minWage;
  minWageLabel.textContent = min.year + '년 최저임금 ' + formatWon(min.hourly) + '원';

  hourlyInput.addEventListener('input', function () {
    formatAmountField(hourlyInput);
    render();
  });
  dailyInput.addEventListener('input', render);
  daysInput.addEventListener('input', render);

  document.getElementById('use-minwage').addEventListener('click', function () {
    hourlyInput.value = min.hourly.toLocaleString('ko-KR');
    render();
  });

  document.getElementById('reset-all').addEventListener('click', function () {
    hourlyInput.value = min.hourly.toLocaleString('ko-KR');
    dailyInput.value = '8';
    daysInput.value = '5';
    render();
  });

  render();
})();

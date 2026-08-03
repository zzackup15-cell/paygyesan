'use strict';

/* 퇴직금 계산기 UI. 계산은 calc.js 의 Calc 를 그대로 쓴다. */

(function () {
  if (typeof document === 'undefined') return;

  var hireInput = document.getElementById('date-hire');
  var lastInput = document.getElementById('date-last');
  var wageInput = document.getElementById('wage-3months');
  var bonusInput = document.getElementById('annual-bonus');
  var leaveInput = document.getElementById('annual-leave-pay');
  var ordinaryInput = document.getElementById('monthly-ordinary');

  var out = {
    serviceDays: document.getElementById('out-service-days'),
    serviceText: document.getElementById('out-service-text'),
    period: document.getElementById('out-period'),
    periodDays: document.getElementById('out-period-days'),
    avgDaily: document.getElementById('out-avg-daily'),
    ordinaryDaily: document.getElementById('out-ordinary-daily'),
    baseWage: document.getElementById('out-base-wage'),
    severance: document.getElementById('out-severance'),
    formula: document.getElementById('out-formula')
  };

  var alertDate = document.getElementById('alert-date');
  var alertShort = document.getElementById('alert-short');
  var alertOrdinary = document.getElementById('alert-ordinary');

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

  function isoText(d) {
    if (!d) return '-';
    var mm = ('0' + (d.getUTCMonth() + 1)).slice(-2);
    var dd = ('0' + d.getUTCDate()).slice(-2);
    return d.getUTCFullYear() + '.' + mm + '.' + dd;
  }

  function serviceText(days) {
    if (days <= 0) return '';
    var y = Math.floor(days / 365);
    var rest = days - y * 365;
    var m = Math.floor(rest / 30);
    var d = rest - m * 30;
    var parts = [];
    if (y) parts.push(y + '년');
    if (m) parts.push(m + '개월');
    if (d) parts.push(d + '일');
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
    var last = Calc.parseDate(lastInput.value);

    var days = 0;
    var periodStart = null;
    var periodDays = 0;

    if (hire && last) {
      if (Calc.daysBetween(hire, last) < 0) {
        showAlert(alertDate, '마지막 근무일이 입사일보다 앞섭니다. 날짜를 확인해 주세요.');
      } else {
        showAlert(alertDate, '');
        days = Calc.serviceDays(hire, last);
        // 평균임금 산정기간은 퇴직일(마지막 근무일의 다음 날) 직전 3개월
        var leaveDate = new Date(last.getTime() + 86400000);
        periodStart = Calc.minusMonths(leaveDate, 3);
        periodDays = Calc.daysBetween(periodStart, leaveDate);
      }
    } else {
      showAlert(alertDate, '');
    }

    out.serviceDays.textContent = days ? days.toLocaleString('ko-KR') : '0';
    out.serviceText.textContent = serviceText(days);
    out.period.textContent = periodStart ? isoText(periodStart) + ' ~ ' + isoText(last) : '-';
    out.periodDays.textContent = periodDays ? periodDays.toLocaleString('ko-KR') : '0';

    var avgDaily = Calc.averageDailyWage({
      wage3Months: wageInput.value,
      annualBonus: bonusInput.value,
      annualLeavePay: leaveInput.value,
      periodDays: periodDays
    });

    // 1일 통상임금 = 월 통상임금 ÷ 209 × 8
    var monthlyOrdinary = Calc.toAmount(ordinaryInput.value);
    var ordinaryDaily = monthlyOrdinary > 0
      ? Calc.hourlyOrdinaryWage(monthlyOrdinary, Calc.monthlyScheduledHours(40)) * 8
      : 0;

    var result = Calc.severance(avgDaily, ordinaryDaily, days);

    out.avgDaily.textContent = formatWon(avgDaily);
    out.ordinaryDaily.textContent = ordinaryDaily > 0 ? formatWon(ordinaryDaily) : '-';
    out.baseWage.textContent = formatWon(result.base);
    out.severance.textContent = formatWon(result.amount);

    out.formula.textContent = days >= Calc.MIN_SERVICE_DAYS && result.base > 0
      ? formatWon(result.base) + '원 × 30일 × (' + days.toLocaleString('ko-KR') + '일 ÷ 365)'
      : '';

    showAlert(alertShort, days > 0 && days < Calc.MIN_SERVICE_DAYS
      ? '계속근로기간이 ' + days + '일로 1년(365일)에 미치지 않습니다. 근로자퇴직급여 보장법상 퇴직금 지급 대상이 아니라 0원으로 계산했습니다. ' +
        '다만 퇴직연금(DC형)에 가입되어 있다면 1년 미만이어도 적립된 부담금을 받을 수 있습니다.'
      : '');

    showAlert(alertOrdinary, result.usedOrdinary
      ? '평균임금(' + formatWon(avgDaily) + '원)이 1일 통상임금(' + formatWon(ordinaryDaily) + '원)보다 적어 ' +
        '통상임금을 기준으로 계산했습니다. 근로기준법 제2조 제2항에 따른 것입니다.'
      : '');
  }

  [wageInput, bonusInput, leaveInput, ordinaryInput].forEach(function (input) {
    input.addEventListener('input', function () {
      formatAmountField(input);
      render();
    });
  });

  hireInput.addEventListener('input', render);
  lastInput.addEventListener('input', render);
  hireInput.addEventListener('change', render);
  lastInput.addEventListener('change', render);

  document.getElementById('reset-all').addEventListener('click', function () {
    hireInput.value = '';
    lastInput.value = '';
    wageInput.value = '';
    bonusInput.value = '';
    leaveInput.value = '';
    ordinaryInput.value = '';
    render();
  });

  render();
})();

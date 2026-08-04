'use strict';

/* 실업급여(구직급여) 계산기 UI. 계산은 calc.js 의 Calc 를 그대로 쓴다. */

(function () {
  if (typeof document === 'undefined') return;

  var hireInput = document.getElementById('date-hire');
  var lastInput = document.getElementById('date-last');
  var wageInput = document.getElementById('wage-3months');
  var hoursInput = document.getElementById('daily-hours');
  var ageSelect = document.getElementById('age-group');

  var out = {
    insured: document.getElementById('out-insured'),
    insuredDays: document.getElementById('out-insured-days'),
    period: document.getElementById('out-period'),
    periodDays: document.getElementById('out-period-days'),
    baseDaily: document.getElementById('out-base-daily'),
    daily: document.getElementById('out-daily'),
    days: document.getElementById('out-days'),
    total: document.getElementById('out-total'),
    monthly: document.getElementById('out-monthly'),
    formula: document.getElementById('out-formula'),
    limitLabel: document.getElementById('out-limit-label')
  };

  var alertDate = document.getElementById('alert-date');
  var alertShort = document.getElementById('alert-short');
  var rangeLabel = document.getElementById('range-label');

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

  function periodText(months) {
    if (months <= 0) return '-';
    var y = Math.floor(months / 12);
    var m = months % 12;
    var parts = [];
    if (y) parts.push(y + '년');
    if (m) parts.push(m + '개월');
    return parts.length ? parts.join(' ') : '1개월 미만';
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

    var insuredDays = 0;
    var insuredMonths = 0;
    var periodStart = null;
    var periodDays = 0;

    if (hire && last) {
      if (Calc.daysBetween(hire, last) < 0) {
        showAlert(alertDate, '마지막 근무일이 입사일보다 앞섭니다. 날짜를 확인해 주세요.');
      } else {
        showAlert(alertDate, '');
        // 퇴직일(마지막 근무일의 다음 날)을 기준으로 잡아야 재직일수와 개월 수가
        // 어긋나지 않는다. 마지막 근무일로 개월을 세면 1,096일(정확히 3년)인데
        // 2년 11개월로 표시되어 소정급여일수 구간과 모순되어 보인다.
        var leaveDate = new Date(last.getTime() + 86400000);
        insuredDays = Calc.serviceDays(hire, last);
        insuredMonths = Calc.monthsBetween(hire, leaveDate);
        periodStart = Calc.minusMonths(leaveDate, 3);
        periodDays = Calc.daysBetween(periodStart, leaveDate);
      }
    } else {
      showAlert(alertDate, '');
    }

    out.insured.textContent = periodText(insuredMonths);
    out.insuredDays.textContent = insuredDays ? insuredDays.toLocaleString('ko-KR') : '0';
    out.period.textContent = periodStart ? isoText(periodStart) + ' ~ ' + isoText(last) : '-';
    out.periodDays.textContent = periodDays ? periodDays.toLocaleString('ko-KR') : '0';

    var baseDaily = periodDays > 0 ? Calc.toAmount(wageInput.value) / periodDays : 0;
    var dailyHours = Calc.toHours(hoursInput.value);
    var isOver50 = ageSelect.value === 'over50';

    var r = Calc.unemploymentBenefit({
      baseDaily: baseDaily,
      dailyHours: dailyHours,
      // 일수 ÷ 365 로 연수를 구하면 윤년이 빠진다. 3년은 1,096일인데
      // 1,095일이 3.0 으로 계산돼 상위 구간으로 잘못 잡혔다. 달력 개월 기준으로 센다.
      insuredYears: insuredMonths / 12,
      isOver50: isOver50
    });

    // 피보험 단위기간 180일 미만이면 수급 자격이 없다
    var eligible = insuredDays >= Calc.RATES.unemployment.minInsuredDays;

    out.baseDaily.textContent = formatWon(r.baseDaily);
    out.daily.textContent = formatWon(eligible ? r.daily : 0);
    out.days.textContent = eligible ? r.days.toLocaleString('ko-KR') : '0';
    out.total.textContent = formatWon(eligible ? r.total : 0);
    out.monthly.textContent = formatWon(eligible ? r.daily * 30 : 0);

    out.formula.textContent = eligible && r.daily > 0
      ? formatWon(r.daily) + '원 × ' + r.days + '일'
      : '';

    out.limitLabel.textContent = !eligible ? ''
      : r.atMax ? '상한액 적용 (기초일액 113,500원 초과)'
      : r.atMin ? '하한액 적용 (최저구직급여일액)'
      : '기초일액의 60%';

    showAlert(alertShort, insuredDays > 0 && !eligible
      ? '재직일수가 ' + insuredDays + '일로 180일에 미치지 않습니다. 이직 전 18개월간 피보험 단위기간이 180일 이상이어야 수급 자격이 생겨 0원으로 계산했습니다. ' +
        '다만 이전 직장의 고용보험 가입기간이 있다면 합산되므로, 그 경우 자격이 될 수 있습니다.'
      : '');

    var minD = Calc.minDailyBenefit(dailyHours);
    var maxD = Calc.RATES.unemployment.maxBaseDaily * Calc.RATES.unemployment.rate;
    rangeLabel.textContent = Calc.RATES.unemployment.year + '년 기준 1일 ' +
      formatWon(minD) + '원 ~ ' + formatWon(maxD) + '원';
  }

  [wageInput].forEach(function (input) {
    input.addEventListener('input', function () {
      formatAmountField(input);
      render();
    });
  });

  hoursInput.addEventListener('input', render);
  ageSelect.addEventListener('change', render);
  hireInput.addEventListener('input', render);
  hireInput.addEventListener('change', render);
  lastInput.addEventListener('input', render);
  lastInput.addEventListener('change', render);

  document.getElementById('reset-all').addEventListener('click', function () {
    hireInput.value = '';
    lastInput.value = '';
    wageInput.value = '';
    hoursInput.value = '8';
    ageSelect.value = 'under50';
    render();
  });

  render();
})();

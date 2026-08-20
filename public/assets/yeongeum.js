'use strict';

/* 국민연금 예상 수령액 계산기 UI. 계산은 calc.js 의 Calc 를 그대로 쓴다. */

(function () {
  if (typeof document === 'undefined') return;

  var birthInput = document.getElementById('birth-year');
  var incomeInput = document.getElementById('monthly-income');
  var startInput = document.getElementById('start-year');
  var endInput = document.getElementById('end-year');
  var claimSelect = document.getElementById('claim-age');

  var out = {
    monthly: document.getElementById('out-monthly'),
    annual: document.getElementById('out-annual'),
    period: document.getElementById('out-period'),
    startAge: document.getElementById('out-start-age'),
    replacement: document.getElementById('out-replacement'),
    payRate: document.getElementById('out-pay-rate'),
    note: document.getElementById('out-note'),
    paid: document.getElementById('out-paid'),
    breakeven: document.getElementById('out-breakeven'),
    claimRows: document.getElementById('claim-rows'),
    constantRows: document.getElementById('constant-rows')
  };

  function formatWon(n) {
    if (!isFinite(n)) n = 0;
    return Math.round(n).toLocaleString('ko-KR');
  }

  function digits(input) {
    return input.value.replace(/[^0-9]/g, '');
  }

  function formatAmountField(input) {
    var caret = input.selectionStart;
    var digitsBefore = input.value.slice(0, caret).replace(/[^0-9]/g, '').length;
    var value = Calc.toAmount(input.value);
    var next = digits(input) === '' ? '' : value.toLocaleString('ko-KR');
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
      var td = document.createElement('td');
      td.textContent = cells[i];
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }

  // 출생연도가 바뀌면 선택 가능한 수령 나이도 바뀐다.
  // 조기수급은 60세 이전으로는 못 내려간다.
  var lastAgeSignature = '';
  function syncClaimOptions(startAge) {
    var from = Math.max(60, startAge - 5);
    var to = startAge + 5;
    var signature = from + '-' + to;
    if (signature === lastAgeSignature) return;
    lastAgeSignature = signature;

    var previous = parseInt(claimSelect.value, 10);
    while (claimSelect.firstChild) claimSelect.removeChild(claimSelect.firstChild);

    for (var age = from; age <= to; age++) {
      var opt = document.createElement('option');
      opt.value = String(age);
      var label = age + '세';
      if (age < startAge) label += ' (조기수급)';
      else if (age > startAge) label += ' (연기수급)';
      else label += ' (정상)';
      opt.textContent = label;
      claimSelect.appendChild(opt);
    }
    claimSelect.value = String(previous >= from && previous <= to ? previous : startAge);
  }

  function periodText(months) {
    if (!months) return '0개월';
    var y = Math.floor(months / 12);
    var m = months % 12;
    if (!y) return m + '개월';
    if (!m) return y + '년';
    return y + '년 ' + m + '개월';
  }

  function renderClaimTable(startAge, chosenAge) {
    clearRows(out.claimRows);
    var from = Math.max(60, startAge - 5);
    for (var age = from; age <= startAge + 5; age++) {
      var r = Calc.nationalPension(withOpts({ claimAge: age }));
      var kind = age < startAge ? '조기' : (age > startAge ? '연기' : '정상');
      addRow(out.claimRows, [
        age + '세',
        kind,
        Math.round(r.payRate * 1000) / 10 + '%',
        formatWon(r.monthly) + '원'
      ], age === chosenAge);
    }
  }

  function renderConstantTable(rows) {
    clearRows(out.constantRows);
    if (!rows.length) return;

    // 상수가 같은 연속 구간은 한 줄로 묶는다. 40년치를 연도별로 늘어놓으면 읽을 수 없다.
    var groups = [];
    for (var i = 0; i < rows.length; i++) {
      var c = Calc.npsConstant(rows[i].year);
      var last = groups[groups.length - 1];
      if (last && last.constant === c) {
        last.to = rows[i].year;
        last.months += rows[i].months;
      } else {
        groups.push({ from: rows[i].year, to: rows[i].year, constant: c, months: rows[i].months });
      }
    }

    for (var g = 0; g < groups.length; g++) {
      var it = groups[g];
      var span = it.from === it.to ? it.from + '년' : it.from + '~' + it.to + '년';
      // 상수는 소득대체율의 3배다. 1988~1998년은 B에 0.75 가 걸려 표기가 달라진다.
      var rate = Math.round(it.constant / 3 * 1000) / 10 + '%';
      var constantText = it.constant + (Calc.npsIncomeWeight(it.from) < 1 ? ' (B×0.75)' : '');
      addRow(out.constantRows, [span, it.months + '개월', constantText, rate]);
    }
  }

  function withOpts(extra) {
    var opts = {
      birthYear: digits(birthInput),
      monthlyIncome: incomeInput.value,
      startYear: digits(startInput),
      startMonth: 1,
      endYear: digits(endInput),
      endMonth: 12
    };
    for (var k in (extra || {})) opts[k] = extra[k];
    return opts;
  }

  function render() {
    var hasBirth = digits(birthInput).length === 4;
    var income = Calc.toAmount(incomeInput.value);
    var hasSpan = digits(startInput).length === 4 && digits(endInput).length === 4;

    var startAge = hasBirth ? Calc.npsStartAge(parseInt(digits(birthInput), 10)) : 65;
    syncClaimOptions(startAge);
    var chosenAge = parseInt(claimSelect.value, 10) || startAge;

    out.startAge.textContent = hasBirth ? startAge : '-';

    // 입력이 덜 찼는데 금액이 뜨면 받을 돈이 확정된 것처럼 보인다. 비워 둔다.
    if (!hasBirth || !hasSpan || income <= 0) {
      out.monthly.textContent = '0';
      out.annual.textContent = '0';
      out.period.textContent = '0개월';
      out.replacement.textContent = '0';
      out.payRate.textContent = '100';
      out.paid.textContent = '0';
      out.breakeven.textContent = '-';
      out.note.textContent = '';
      clearRows(out.claimRows);
      clearRows(out.constantRows);
      return;
    }

    var r = Calc.nationalPension(withOpts({ claimAge: chosenAge }));

    out.monthly.textContent = formatWon(r.monthly);
    out.annual.textContent = formatWon(r.monthly * 12);
    out.period.textContent = periodText(r.months);
    out.replacement.textContent = Math.round(r.replacementRate * 1000) / 10;
    out.payRate.textContent = Math.round(r.payRate * 1000) / 10;
    out.paid.textContent = formatWon(r.paidSelf);
    out.breakeven.textContent = r.breakEvenMonths
      ? periodText(r.breakEvenMonths) + ' 후'
      : '-';

    var notes = [];
    if (!r.eligible) {
      notes.push('가입기간이 10년(120개월)에 미치지 못해 노령연금 대상이 아닙니다. 그동안 낸 보험료는 반환일시금으로 받게 됩니다.');
    } else if (r.months < Calc.NPS.excessFrom) {
      notes.push('가입기간이 20년 미만이라 기본연금액의 ' + Math.round(r.durationRate * 1000) / 10 + '% 만 지급됩니다.');
    }
    if (r.bValue === Calc.RATES.pension.max && income > Calc.RATES.pension.max) {
      notes.push('소득이 기준소득월액 상한(659만 원)을 넘어 상한액으로 계산했습니다.');
    }
    if (r.bValue === Calc.RATES.pension.min && income < Calc.RATES.pension.min) {
      notes.push('소득이 기준소득월액 하한(41만 원)에 미달해 하한액으로 계산했습니다.');
    }
    out.note.textContent = notes.join(' ');

    renderClaimTable(startAge, chosenAge);
    renderConstantTable(r.rows);
  }

  incomeInput.addEventListener('input', function () {
    formatAmountField(incomeInput);
    render();
  });
  birthInput.addEventListener('input', render);
  startInput.addEventListener('input', render);
  endInput.addEventListener('input', render);
  claimSelect.addEventListener('change', render);

  document.getElementById('reset-all').addEventListener('click', function () {
    birthInput.value = '';
    incomeInput.value = '';
    startInput.value = '';
    endInput.value = '';
    lastAgeSignature = '';
    render();
  });

  render();
})();

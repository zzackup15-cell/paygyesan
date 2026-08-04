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
    // 고용보험. 실업급여분은 노사가 반씩 부담하고, 고용안정·직업능력개발사업분은
    // 사업주가 기업 규모에 따라 추가로 부담한다.
    employment: {
      rate: 0.009,
      employerStability: [
        { key: 'under150', label: '150인 미만', rate: 0.0025 },
        { key: 'priority', label: '150인 이상 (우선지원 대상기업)', rate: 0.0045 },
        { key: 'under1000', label: '150인 이상 1,000인 미만', rate: 0.0065 },
        { key: 'over1000', label: '1,000인 이상 · 국가 · 지자체', rate: 0.0085 }
      ]
    },
    minWage: { year: 2026, hourly: 10320 },               // 최저임금 (고용노동부 고시)

    // 구직급여(실업급여). 고용보험법 제45조·제46조
    // 상한액은 2026년에 68,100원으로 올랐다. 최저임금 인상으로 하한액(66,048)이
    // 기존 상한액(66,000)을 넘어서는 역전이 생겨 함께 인상된 것이다.
    unemployment: {
      year: 2026,
      rate: 0.6,             // 구직급여일액 = 기초일액 × 60%
      maxBaseDaily: 113500,  // 기초일액 상한 → 일액 상한 68,100원
      minRate: 0.8,          // 최저구직급여일액 = 최저기초일액 × 80%
      maxDailyHours: 8,      // 최저기초일액 산정 시 1일 소정근로시간 상한
      minInsuredDays: 180    // 이직 전 18개월간 피보험 단위기간
    },
    localTax: 0.1                                         // 지방소득세 = 소득세 × 10%
  };

  var MAX_FAMILY = 11; // 간이세액표 열 상한
  var MAX_CHILDREN = 10;

  // 보험료는 10원 미만을 절사한다. 다만 곱셈을 그대로 절사하면 안 된다.
  // 0.009 같은 요율은 2진 부동소수로 정확히 표현되지 않아
  // 3,000,000 × 0.009 가 26,999.999999999996 으로 나오고,
  // 이걸 절사하면 27,000원이 26,990원이 되어 10원이 사라진다.
  // 계산 오차만 걷어낸 뒤 절사한다. 소수 6자리 밖은 실제 값일 수 없다.
  function floor10(n) {
    if (!isFinite(n) || n <= 0) return 0;
    return Math.floor(Math.round(n * 1e6) / 1e6 / 10) * 10;
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

  function toBase(monthly) {
    return isFinite(monthly) && monthly > 0 ? monthly : 0;
  }

  // 국민연금 기준소득월액. 천원 단위로 절사한 뒤 상·하한을 적용한다.
  // 근로자·사업주 부담이 같은 기준을 써야 하므로 함수로 뽑아 공유한다.
  function pensionBase(base) {
    if (base <= 0) return 0;
    var b = Math.floor(base / 1000) * 1000;
    if (b < RATES.pension.min) b = RATES.pension.min;
    if (b > RATES.pension.max) b = RATES.pension.max;
    return b;
  }

  // 4대보험 근로자 부담분
  function insurance(taxableMonthly) {
    var base = toBase(taxableMonthly);

    var pension = floor10(pensionBase(base) * RATES.pension.rate);
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

  // 4대보험 사업주 부담분
  //
  // 국민연금·건강보험·장기요양은 근로자와 같은 금액이고, 고용보험은
  // 실업급여분(0.9%)에 더해 고용안정·직업능력개발사업분을 기업 규모별로 더 낸다.
  // 산재보험은 사업주 전액이지만 업종별 편차가 커서 임의의 평균값을 쓰지 않는다.
  // 요율을 아는 사용자만 직접 넣도록 옵션으로 받는다.
  function employerInsurance(taxableMonthly, opts) {
    opts = opts || {};
    var base = toBase(taxableMonthly);

    var tiers = RATES.employment.employerStability;
    var tier = tiers[0];
    for (var i = 0; i < tiers.length; i++) {
      if (tiers[i].key === opts.sizeKey) { tier = tiers[i]; break; }
    }

    var pension = floor10(pensionBase(base) * RATES.pension.rate);
    var health = floor10(base * RATES.health.rate);
    var care = floor10(health * RATES.care.ofHealth);
    var employment = floor10(base * RATES.employment.rate);
    var stability = floor10(base * tier.rate);

    // 산재보험 요율은 퍼센트로 받는다 (예: 0.7 → 0.7%)
    var accidentRate = toHours(opts.accidentRate) / 100;
    if (!isFinite(accidentRate) || accidentRate < 0) accidentRate = 0;
    if (accidentRate > 0.2) accidentRate = 0.2; // 20% 상한
    var accident = floor10(base * accidentRate);

    return {
      pension: pension,
      health: health,
      care: care,
      employment: employment,
      stability: stability,
      stabilityRate: tier.rate,
      stabilityLabel: tier.label,
      accident: accident,
      accidentRate: accidentRate,
      total: pension + health + care + employment + stability + accident
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

  /* ---- 퇴직금 (근로자퇴직급여 보장법 제8조) ---- */

  var DAY_MS = 86400000;
  var MIN_SERVICE_DAYS = 365; // 계속근로기간 1년 이상이어야 퇴직금이 발생한다

  // 'YYYY-MM-DD' → UTC Date. 시간대 보정 오차를 피하려고 UTC 로만 다룬다.
  function parseDate(raw) {
    var m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(String(raw == null ? '' : raw).trim());
    if (!m) return null;
    var y = +m[1], mo = +m[2], d = +m[3];
    if (y < 1900 || y > 2200 || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    var dt = new Date(Date.UTC(y, mo - 1, d));
    // 2월 30일처럼 존재하지 않는 날짜는 걸러낸다
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
    return dt;
  }

  function daysBetween(from, to) {
    if (!from || !to) return 0;
    return Math.round((to.getTime() - from.getTime()) / DAY_MS);
  }

  // n개월 전. 같은 날짜가 없으면(3/31 의 1개월 전 등) 그 달의 마지막 날로 맞춘다.
  function minusMonths(date, n) {
    if (!date) return null;
    var y = date.getUTCFullYear();
    var m = date.getUTCMonth() - n;
    var d = date.getUTCDate();
    var last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    return new Date(Date.UTC(y, m, Math.min(d, last)));
  }

  // 재직일수. 퇴직일(마지막 근무일의 다음 날) 기준이므로 마지막 근무일에 1을 더한다.
  function serviceDays(hireDate, lastWorkDate) {
    var days = daysBetween(hireDate, lastWorkDate) + 1;
    return days > 0 ? days : 0;
  }

  // 평균임금 = 사유 발생일 이전 3개월 임금 총액 ÷ 그 기간의 총일수
  // 상여금과 연차수당은 12개월분의 3/12 만 산입한다.
  function averageDailyWage(opts) {
    var periodDays = opts.periodDays > 0 ? opts.periodDays : 0;
    if (!periodDays) return 0;
    var total = toAmount(opts.wage3Months) +
      toAmount(opts.annualBonus) * 3 / 12 +
      toAmount(opts.annualLeavePay) * 3 / 12;
    return isFinite(total) ? total / periodDays : 0;
  }

  // 평균임금이 통상임금보다 적으면 통상임금을 평균임금으로 본다 (근로기준법 제2조 제2항)
  function severance(avgDaily, ordinaryDaily, days) {
    var base = Math.max(avgDaily || 0, ordinaryDaily || 0);
    if (!isFinite(base) || base <= 0) return { base: 0, amount: 0, usedOrdinary: false };
    if (!isFinite(days) || days < MIN_SERVICE_DAYS) return { base: base, amount: 0, usedOrdinary: false };
    return {
      base: base,
      amount: base * 30 * (days / 365),
      usedOrdinary: (ordinaryDaily || 0) > (avgDaily || 0)
    };
  }

  /* ---- 연차유급휴가 (근로기준법 제60조) ---- */

  var MAX_ANNUAL_LEAVE = 25;      // 가산휴가 포함 한도
  var MAX_FIRST_YEAR_LEAVE = 11;  // 1년 미만 기간에 월 1일씩 최대 11일
  var MAX_UNUSED_DAYS = 25;

  // 경과한 만(滿) 개월 수. 일자가 모자라면 아직 그 달을 채우지 못한 것으로 본다.
  function monthsBetween(from, to) {
    if (!from || !to) return 0;
    var m = (to.getUTCFullYear() - from.getUTCFullYear()) * 12 +
            (to.getUTCMonth() - from.getUTCMonth());
    if (to.getUTCDate() < from.getUTCDate()) m--;
    return m > 0 ? m : 0;
  }

  // 입사일 기준으로 산정한 연차일수
  function annualLeaveDays(hireDate, baseDate) {
    var months = monthsBetween(hireDate, baseDate);
    var years = Math.floor(months / 12);

    // 1년 미만: 1개월 개근마다 1일 (최대 11일)
    var firstYear = Math.min(months, MAX_FIRST_YEAR_LEAVE);

    // 1년 이상: 15일 + 최초 1년을 초과하는 매 2년마다 1일 가산
    var annual = 0;
    if (years >= 1) {
      annual = Math.min(15 + Math.floor((years - 1) / 2), MAX_ANNUAL_LEAVE);
    }

    return {
      months: months,
      years: years,
      firstYearDays: years >= 1 ? MAX_FIRST_YEAR_LEAVE : firstYear,
      annualDays: annual,
      // 지금 이 시점에 새로 쓸 수 있는 연차
      currentDays: years >= 1 ? annual : firstYear,
      isFirstYear: years < 1
    };
  }

  // 연차 미사용수당 = 1일 통상임금 × 미사용 일수
  function annualLeavePay(dailyOrdinary, unusedDays) {
    var d = toHours(unusedDays);
    if (d > MAX_UNUSED_DAYS) d = MAX_UNUSED_DAYS;
    if (!isFinite(dailyOrdinary) || dailyOrdinary <= 0 || d <= 0) return 0;
    return dailyOrdinary * d;
  }

  /* ---- 구직급여 (고용보험법 제45조·제46조, 별표1) ---- */

  // 소정급여일수 (고용보험법 별표1). 2019.10.1. 이후 이직자 기준.
  // 각 구간은 [피보험기간 상한(년), 50세 미만, 50세 이상·장애인]
  var BENEFIT_DAYS = [
    [1, 120, 120],
    [3, 150, 180],
    [5, 180, 210],
    [10, 210, 240],
    [Infinity, 240, 270]
  ];

  function benefitDays(insuredYears, isOver50) {
    var y = isFinite(insuredYears) && insuredYears > 0 ? insuredYears : 0;
    for (var i = 0; i < BENEFIT_DAYS.length; i++) {
      if (y < BENEFIT_DAYS[i][0]) return isOver50 ? BENEFIT_DAYS[i][2] : BENEFIT_DAYS[i][1];
    }
    return isOver50 ? 270 : 240;
  }

  // 최저구직급여일액 = (1일 소정근로시간 × 최저임금) × 80%
  function minDailyBenefit(dailyHours) {
    var u = RATES.unemployment;
    var h = Math.min(toHours(dailyHours) || u.maxDailyHours, u.maxDailyHours);
    return h * RATES.minWage.hourly * u.minRate;
  }

  // 구직급여일액. 기초일액에 상한을 씌워 60%를 적용하되, 최저액보다 낮으면 최저액.
  function dailyBenefit(baseDaily, dailyHours) {
    var u = RATES.unemployment;
    var base = isFinite(baseDaily) && baseDaily > 0 ? baseDaily : 0;
    if (base <= 0) return 0;
    var capped = Math.min(base, u.maxBaseDaily) * u.rate;
    return Math.max(capped, minDailyBenefit(dailyHours));
  }

  function unemploymentBenefit(opts) {
    var base = isFinite(opts.baseDaily) && opts.baseDaily > 0 ? opts.baseDaily : 0;
    var daily = dailyBenefit(base, opts.dailyHours);
    var days = benefitDays(opts.insuredYears, opts.isOver50);
    var u = RATES.unemployment;
    var min = minDailyBenefit(opts.dailyHours);
    return {
      baseDaily: base,
      daily: daily,
      days: days,
      total: daily * days,
      minDaily: min,
      maxDaily: u.maxBaseDaily * u.rate,
      atMax: base > u.maxBaseDaily,
      atMin: base > 0 && Math.min(base, u.maxBaseDaily) * u.rate < min
    };
  }

  /* ---- 육아휴직 급여 (고용보험법 제70조) ---- */

  var PARENTAL = {
    year: 2026,
    maxMonths: 18,        // 1년 6개월
    floor: 700000,        // 하한액
    // [상한 적용 개월 상한, 지급률, 월 상한액]
    tiers: [
      [3, 1.0, 2500000],
      [6, 1.0, 2000000],
      [Infinity, 0.8, 1600000]
    ],
    // 6+6 부모육아휴직제: 첫 6개월 상한이 개월차별로 올라간다 (지급률 100%)
    plusCaps: [2500000, 2500000, 3000000, 3500000, 4000000, 4500000]
  };

  // n개월차 육아휴직 급여
  function parentalLeaveMonth(monthIndex, monthlyOrdinary, isPlus) {
    var wage = toAmount(monthlyOrdinary);
    var i = Math.floor(monthIndex);
    if (!isFinite(i) || i < 1) return { rate: 0, cap: 0, amount: 0 };

    var rate, cap;
    if (isPlus && i <= PARENTAL.plusCaps.length) {
      rate = 1.0;
      cap = PARENTAL.plusCaps[i - 1];
    } else {
      for (var t = 0; t < PARENTAL.tiers.length; t++) {
        if (i <= PARENTAL.tiers[t][0]) {
          rate = PARENTAL.tiers[t][1];
          cap = PARENTAL.tiers[t][2];
          break;
        }
      }
    }

    var amount = Math.min(wage * rate, cap);
    // 하한액은 상·하한 중 마지막에 적용된다
    if (amount < PARENTAL.floor) amount = PARENTAL.floor;
    return { rate: rate, cap: cap, amount: amount };
  }

  function parentalLeave(monthlyOrdinary, months, isPlus) {
    var n = Math.min(Math.max(Math.floor(toHours(months)) || 0, 0), PARENTAL.maxMonths);
    var rows = [];
    var total = 0;
    for (var i = 1; i <= n; i++) {
      var m = parentalLeaveMonth(i, monthlyOrdinary, isPlus);
      rows.push({ month: i, rate: m.rate, cap: m.cap, amount: m.amount });
      total += m.amount;
    }
    return { months: n, rows: rows, total: total };
  }

  return {
    MAX_ITEMS: MAX_ITEMS,
    MIN_SERVICE_DAYS: MIN_SERVICE_DAYS,
    PARENTAL: PARENTAL,
    parentalLeaveMonth: parentalLeaveMonth,
    parentalLeave: parentalLeave,
    benefitDays: benefitDays,
    minDailyBenefit: minDailyBenefit,
    dailyBenefit: dailyBenefit,
    unemploymentBenefit: unemploymentBenefit,
    MAX_ANNUAL_LEAVE: MAX_ANNUAL_LEAVE,
    MAX_FIRST_YEAR_LEAVE: MAX_FIRST_YEAR_LEAVE,
    MAX_UNUSED_DAYS: MAX_UNUSED_DAYS,
    monthsBetween: monthsBetween,
    annualLeaveDays: annualLeaveDays,
    annualLeavePay: annualLeavePay,
    parseDate: parseDate,
    daysBetween: daysBetween,
    minusMonths: minusMonths,
    serviceDays: serviceDays,
    averageDailyWage: averageDailyWage,
    severance: severance,
    MAX_AMOUNT: MAX_AMOUNT,
    MAX_FAMILY: MAX_FAMILY,
    MAX_CHILDREN: MAX_CHILDREN,
    RATES: RATES,
    incomeTax: incomeTax,
    childCredit: childCredit,
    insurance: insurance,
    employerInsurance: employerInsurance,
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

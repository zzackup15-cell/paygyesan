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

  /* ---- 월급 외 추가 수익의 세금 (종합소득세) ---- */

  // 소득세법 제55조 종합소득세율. 세율이 전부 정수 퍼센트라
  // 정수 연산으로 계산할 수 있다.
  var TAX_BRACKETS = [
    { upto: 14000000, pct: 6, deduct: 0 },
    { upto: 50000000, pct: 15, deduct: 1260000 },
    { upto: 88000000, pct: 24, deduct: 5760000 },
    { upto: 150000000, pct: 35, deduct: 15440000 },
    { upto: 300000000, pct: 38, deduct: 19940000 },
    { upto: 500000000, pct: 40, deduct: 25940000 },
    { upto: 1000000000, pct: 42, deduct: 35940000 },
    { upto: Infinity, pct: 45, deduct: 65940000 }
  ];

  var SIDE = {
    otherExpensePct: 60,        // 기타소득 필요경비 의제율
    otherWithholdPct: 88,       // 기타소득 원천징수 8.8% (지방소득세 포함, 1000분율)
    businessWithholdPct: 33,    // 사업소득 원천징수 3.3% (지방소득세 포함, 1000분율)
    otherSeparateLimit: 3000000,// 기타소득금액 300만원 이하면 분리과세 선택 가능
    healthThreshold: 20000000,  // 보수외소득 연 2,000만원 초과분에 건보료
    basicDeduction: 1500000,    // 인적공제 1명당
    earnedDeductionCap: 20000000
  };

  // 종합소득 산출세액 = 과세표준 × 세율 - 누진공제
  function comprehensiveTax(base) {
    if (!isFinite(base) || base <= 0) return 0;
    for (var i = 0; i < TAX_BRACKETS.length; i++) {
      if (base <= TAX_BRACKETS[i].upto) {
        var t = Math.floor(base * TAX_BRACKETS[i].pct / 100) - TAX_BRACKETS[i].deduct;
        return t > 0 ? t : 0;
      }
    }
    return 0;
  }

  // 이 과세표준에 1원을 더 벌면 붙는 세율(%). 추가 수익 세금의 핵심 개념이다.
  function marginalPct(base) {
    if (!isFinite(base) || base <= 0) return TAX_BRACKETS[0].pct;
    for (var i = 0; i < TAX_BRACKETS.length; i++) {
      if (base <= TAX_BRACKETS[i].upto) return TAX_BRACKETS[i].pct;
    }
    return TAX_BRACKETS[TAX_BRACKETS.length - 1].pct;
  }

  // 근로소득공제 (소득세법 제47조). 한도 2,000만원
  function earnedIncomeDeduction(gross) {
    var g = toAmount(gross);
    if (g <= 0) return 0;
    var d;
    if (g <= 5000000) d = g * 70 / 100;
    else if (g <= 15000000) d = 3500000 + (g - 5000000) * 40 / 100;
    else if (g <= 45000000) d = 7500000 + (g - 15000000) * 15 / 100;
    else if (g <= 100000000) d = 12000000 + (g - 45000000) * 5 / 100;
    else d = 14750000 + (g - 100000000) * 2 / 100;
    if (d > SIDE.earnedDeductionCap) d = SIDE.earnedDeductionCap;
    return Math.floor(d);
  }

  /* 근로소득만 있을 때의 과세표준 추정.
   *
   * 정확한 과세표준은 개인별 공제에 따라 달라진다. 여기서는 누구에게나
   * 적용되는 것만 뺀다. 근로소득공제(법정 산식), 인적공제, 그리고 4대보험료
   * 소득공제다. 주택자금·기부금 같은 선택적 공제와 세액공제는 넣지 않는다.
   *
   * 이 추정치의 오차는 대체로 상쇄된다. 이 계산기가 내놓는 값은 세금 총액이
   * 아니라 '추가 수익 때문에 늘어난 세금'이고, 그건 두 과세표준에서 각각
   * 구한 세액의 차이이기 때문이다. 양쪽에 똑같이 걸린 공제는 빼기에서 사라진다.
   */
  function estimatedTaxBase(annualSalary, family) {
    var salary = toAmount(annualSalary);
    if (salary <= 0) return 0;
    var fam = Math.min(Math.max(Math.floor(family) || 1, 1), MAX_FAMILY);
    var ins = insurance(Math.floor(salary / 12));
    var insAnnual = (ins.pension + ins.health + ins.care + ins.employment) * 12;
    var base = salary - earnedIncomeDeduction(salary) - SIDE.basicDeduction * fam - insAnnual;
    return base > 0 ? Math.floor(base) : 0;
  }

  /* 추가 수익에 붙는 세금.
   *
   * 핵심은 추가 수익의 세금이 '금액'이 아니라 '기존 연봉'으로 정해진다는 것이다.
   * 종합소득세는 누진세라 부수입이 연봉 위에 얹혀 한계세율을 맞는다.
   * 같은 500만원이라도 연봉 3천만원이면 15%, 1억이면 35%다.
   *
   * 원천징수(사업 3.3% / 기타 8.8%)는 미리 떼어 둔 것일 뿐 정산이 아니다.
   * 대부분 5월에 더 내야 하고, 이 계산기는 그 차액을 보여 준다.
   */
  function sideIncomeTax(opts) {
    opts = opts || {};
    var isOther = opts.type === 'other';
    var salary = toAmount(opts.annualSalary);
    var revenue = toAmount(opts.sideRevenue);
    var family = opts.family;

    // 소득금액 = 수입 - 필요경비.
    // 기타소득은 실제 경비 대신 60% 를 의제로 인정한다.
    var expense = isOther
      ? Math.floor(revenue * SIDE.otherExpensePct / 100)
      : Math.min(toAmount(opts.sideExpense), revenue);
    var incomeAmount = revenue - expense;

    var withholdPct = isOther ? SIDE.otherWithholdPct : SIDE.businessWithholdPct;
    var withheld = Math.floor(revenue * withholdPct / 1000);

    var baseBefore = estimatedTaxBase(salary, family);
    var baseAfter = baseBefore + incomeAmount;

    var taxBefore = comprehensiveTax(baseBefore);
    var taxAfter = comprehensiveTax(baseAfter);
    var addedIncomeTax = taxAfter - taxBefore;
    if (addedIncomeTax < 0) addedIncomeTax = 0;
    var addedLocalTax = Math.floor(addedIncomeTax * 10 / 100);
    var addedTax = addedIncomeTax + addedLocalTax;

    // 건강보험 소득월액보험료. 보수외소득이 연 2,000만원을 넘으면
    // 초과분에 대해 직장가입자가 전액 부담한다(국민건강보험법 제69조·제76조).
    // 사업·기타소득의 소득평가율은 100% 다.
    var healthMonthly = 0;
    var careMonthly = 0;
    if (incomeAmount > SIDE.healthThreshold) {
      var monthlyBase = (incomeAmount - SIDE.healthThreshold) / 12;
      // 보수월액보험료와 달리 사업주 부담이 없어 요율 전체를 본인이 낸다.
      healthMonthly = floor10(monthlyBase * RATES.health.rate * 2);
      careMonthly = floor10(healthMonthly * RATES.care.ofHealth);
    }
    var healthYear = (healthMonthly + careMonthly) * 12;

    // 기타소득금액 300만원 이하는 종합과세 대신 분리과세를 고를 수 있다.
    // 이 경우 원천징수된 8.8% 로 납세의무가 끝난다.
    var canSeparate = isOther && incomeAmount > 0 && incomeAmount <= SIDE.otherSeparateLimit;

    return {
      type: isOther ? 'other' : 'business',
      revenue: revenue,
      expense: expense,
      incomeAmount: incomeAmount,
      withheld: withheld,
      baseBefore: baseBefore,
      baseAfter: baseAfter,
      marginalPct: marginalPct(baseAfter),
      incomeTax: addedIncomeTax,
      localTax: addedLocalTax,
      addedTax: addedTax,
      settlement: addedTax - withheld, // 양수면 5월에 더 낼 돈
      effectiveRate: incomeAmount > 0 ? addedTax / incomeAmount : 0,
      healthMonthly: healthMonthly,
      careMonthly: careMonthly,
      healthYear: healthYear,
      totalBurden: addedTax + healthYear,
      netIncome: revenue - expense - addedTax - healthYear,
      canSeparate: canSeparate,
      separateTax: canSeparate ? withheld : 0
    };
  }

  /* ---- 국민연금 노령연금 (예상 수령액) ---- */

  // 국민연금법 제51조 급여산식.
  //
  //   기본연금액(연액) = Σ[ 상수ᵢ × (A + wᵢ·B) × Pᵢ/P ] × (1 + 0.05 × n/12)
  //
  //   A  = 연금수급 직전 3년간 전체가입자 평균소득월액의 평균액 (공단 고시)
  //   B  = 가입기간 중 기준소득월액의 평균액 (과거 소득을 현재가치로 재평가한 값)
  //   Pᵢ = 해당 연도 가입월수,  P = 총 가입월수,  n = 20년(240개월) 초과 가입월수
  //
  // 비례상수는 '가입한 연도'마다 다르고, 그 연도 가입월수의 비중으로 가중합산한다.
  // 한 사람이 1995년과 2026년에 걸쳐 가입했다면 두 상수가 함께 적용된다.
  // 1988~1998년 가입분만 B에 0.75를 곱한다(w).
  var NPS = {
    year: 2026,
    aValue: 3193511,   // 2026년 A값
    startYear: 1988,   // 제도 시행
    minMonths: 120,    // 노령연금 최소 가입기간 10년
    maxMonths: 600,    // 입력 방어용 상한
    excessFrom: 240,   // 20년 초과분 가산 기준
    excessPerYear: 0.05,
    early: { perYear: 0.06, maxYears: 5 },  // 조기노령연금 1년당 6% 감액
    defer: { perYear: 0.072, maxYears: 5 }, // 연기연금 1년당 7.2% 가산
    // 보험료율 (2025년 연금개혁). 2025년까지 9%, 2026년 9.5%부터 매년 0.5%p씩
    // 올라 2033년 13%에서 멈춘다.
    feeBase: 0.09, feeFrom: 2026, feeCap: 0.13
  };

  // 가입 연도별 비례상수. 정수 연산으로 만든다.
  // 부동소수 곱셈을 쓰면 1.5 - 0.015×17 이 1.2449999... 로 나온다.
  function npsConstant(year) {
    if (year <= 1998) return 2.4;  // 소득대체율 70%
    if (year <= 2007) return 1.8;  // 60%
    if (year >= 2026) return 1.29; // 43% 고정 (2025년 개혁)
    return (1500 - 15 * (year - 2008)) / 1000; // 2008년 1.5 → 2025년 1.245
  }

  // 1988~1998년 가입기간은 B에 0.75만 반영한다
  function npsIncomeWeight(year) {
    return year <= 1998 ? 0.75 : 1;
  }

  /* 가입기간에 따른 지급률.
   *
   * 급여산식의 Σ[ … × Pᵢ/P ] 는 가중치 합이 1이라 총 가입기간이 반영되지 않는다.
   * 상수 자체가 '20년 가입'을 전제로 만들어졌기 때문이다. 20년을 넘는 부분은
   * 기본연금액 안의 (1 + 0.05n/12) 가 받고, 20년에 못 미치는 부분은 이 지급률이
   * 받는다. 10년에 50%, 이후 1년마다 5%p 씩 올라 20년에 100% 로 이어진다.
   *
   * 이게 빠지면 10년 가입자와 20년 가입자의 연금액이 같아진다.
   */
  function npsDurationRate(months) {
    if (months < NPS.minMonths) return 0;
    if (months >= NPS.excessFrom) return 1;
    return 0.5 + 0.05 * (months - NPS.minMonths) / 12;
  }

  // 노령연금 수급개시연령 (국민연금법 부칙 제8조)
  function npsStartAge(birthYear) {
    var y = Math.floor(birthYear) || 0;
    if (y <= 1952) return 60;
    if (y <= 1956) return 61;
    if (y <= 1960) return 62;
    if (y <= 1964) return 63;
    if (y <= 1968) return 64;
    return 65;
  }

  // 해당 연도 보험료율 (노사 합계). 정수 연산.
  function npsFeeRate(year) {
    if (year < NPS.feeFrom) return NPS.feeBase;
    var r = (90 + 5 * (year - NPS.feeFrom + 1)) / 1000;
    return r > NPS.feeCap ? NPS.feeCap : r;
  }

  // 연·월·나이는 toHours() 를 쓰면 안 된다. 그쪽 상한이 999시간이라
  // 2026 을 넣으면 999 로 잘려 나온다.
  function npsInt(raw) {
    if (typeof raw === 'number') return isFinite(raw) ? Math.floor(raw) : NaN;
    var digits = String(raw == null ? '' : raw).replace(/[^0-9]/g, '');
    if (digits === '') return NaN;
    return parseInt(digits.slice(0, 6), 10);
  }

  function npsYear(raw, fallback) {
    var n = npsInt(raw);
    if (!isFinite(n) || n < 1900) return fallback;
    return n > 2200 ? 2200 : n;
  }

  function npsMonth(raw) {
    var n = npsInt(raw);
    if (!isFinite(n) || n < 1) return 1;
    return n > 12 ? 12 : n;
  }

  function npsAge(raw, fallback) {
    var n = npsInt(raw);
    if (!isFinite(n) || n <= 0) return fallback;
    return n > 120 ? 120 : n;
  }

  // 연도별 가입월수. 가입 시작·종료를 연월로 받아 달력 연도마다 쪼갠다.
  function npsMonthsByYear(startY, startM, endY, endM) {
    var out = [];
    var total = 0;
    if (endY < startY || (endY === startY && endM < startM)) return { rows: out, total: 0 };
    for (var y = startY; y <= endY; y++) {
      var from = y === startY ? startM : 1;
      var to = y === endY ? endM : 12;
      var count = to - from + 1;
      if (count <= 0) continue;
      if (total + count > NPS.maxMonths) count = NPS.maxMonths - total;
      if (count <= 0) break;
      out.push({ year: y, months: count });
      total += count;
    }
    return { rows: out, total: total };
  }

  /* 예상 노령연금액.
   *
   * 실제 금액은 공단이 보관한 가입 이력으로만 확정된다. 여기서는 B값을
   * '현재 소득이 가입기간 내내 유지된다'고 보고 대신 쓴다. 공단의 예상연금
   * 모의계산도 이력이 없는 사람에게 같은 가정을 쓴다. 과거 소득은 어차피
   * 재평가율로 현재가치 환산되므로, 소득이 평균 임금상승을 따라온 경우
   * 이 가정은 크게 빗나가지 않는다.
   *
   * 따라서 결과는 모두 '현재가치' 기준이다. 실제 수령 시점의 명목 금액은
   * 물가상승분만큼 더 크다.
   */
  function nationalPension(opts) {
    opts = opts || {};

    var income = pensionBase(toAmount(opts.monthlyIncome)); // 기준소득월액 상·하한 적용
    var birthYear = npsYear(opts.birthYear, 0);
    var startY = npsYear(opts.startYear, NPS.startYear);
    var endY = npsYear(opts.endYear, startY);
    if (startY < NPS.startYear) startY = NPS.startYear;

    var span = npsMonthsByYear(startY, npsMonth(opts.startMonth), endY, npsMonth(opts.endMonth));
    var months = span.total;

    var startAge = npsStartAge(birthYear);
    var claimAge = npsAge(opts.claimAge, startAge);
    var shift = claimAge - startAge;
    if (shift < -NPS.early.maxYears) shift = -NPS.early.maxYears;
    if (shift > NPS.defer.maxYears) shift = NPS.defer.maxYears;

    var payRate = 1;
    if (shift < 0) payRate = 1 - NPS.early.perYear * (-shift);
    else if (shift > 0) payRate = 1 + NPS.defer.perYear * shift;

    var result = {
      months: months,
      years: months / 12,
      startAge: startAge,
      claimAge: startAge + shift,
      shift: shift,
      payRate: payRate,
      durationRate: npsDurationRate(months),
      aValue: NPS.aValue,
      bValue: income,
      rows: span.rows,
      eligible: months >= NPS.minMonths,
      basicMonthly: 0,
      monthly: 0,
      replacementRate: 0,
      paidSelf: 0,
      breakEvenMonths: 0
    };

    if (!months || income <= 0) return result;

    // 연도별 상수를 가입월수 비중으로 가중합산
    var weighted = 0;
    var paid = 0;
    for (var i = 0; i < span.rows.length; i++) {
      var row = span.rows[i];
      var w = npsIncomeWeight(row.year);
      weighted += npsConstant(row.year) * (NPS.aValue + w * income) * (row.months / months);
      // 사업장가입자 기준 본인부담분(요율의 절반). 현재 소득 기준 명목 합계.
      paid += income * npsFeeRate(row.year) / 2 * row.months;
    }

    var excess = months > NPS.excessFrom ? months - NPS.excessFrom : 0;
    var basicAnnual = weighted * (1 + NPS.excessPerYear * excess / 12);
    var basicMonthly = basicAnnual / 12;

    result.basicMonthly = Math.floor(basicMonthly);
    result.paidSelf = Math.floor(paid);

    if (!result.eligible) return result; // 10년 미만은 반환일시금 대상

    result.monthly = Math.floor(basicMonthly * result.durationRate * payRate);
    result.replacementRate = result.monthly / income;
    result.breakEvenMonths = result.monthly > 0 ? Math.ceil(result.paidSelf / result.monthly) : 0;
    return result;
  }

  return {
    TAX_BRACKETS: TAX_BRACKETS,
    SIDE: SIDE,
    comprehensiveTax: comprehensiveTax,
    marginalPct: marginalPct,
    earnedIncomeDeduction: earnedIncomeDeduction,
    estimatedTaxBase: estimatedTaxBase,
    sideIncomeTax: sideIncomeTax,
    NPS: NPS,
    npsConstant: npsConstant,
    npsIncomeWeight: npsIncomeWeight,
    npsStartAge: npsStartAge,
    npsDurationRate: npsDurationRate,
    npsFeeRate: npsFeeRate,
    npsMonthsByYear: npsMonthsByYear,
    nationalPension: nationalPension,
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

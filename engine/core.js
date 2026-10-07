/* Praxis Practice engine: core logic shared by every tool.
   No DOM here, so the same file runs in the browser (window.PraxisCore)
   and in Node for the checks in /checks (require('../engine/core.js')). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PraxisCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------- Languages ---------- */
  // Order = order in the language picker. base: shared translation a regional variant builds on.
  var LANGUAGES = [
    { code: 'af', name: 'Afrikaans' },
    { code: 'ar', name: 'العربية', dir: 'rtl', script: 'arabic' },
    { code: 'cs', name: 'Čeština' },
    { code: 'da', name: 'Dansk' },
    { code: 'de', name: 'Deutsch' },
    { code: 'el', name: 'Ελληνικά', script: 'greek' },
    { code: 'en', name: 'English' },
    { code: 'es', name: 'Español (España)' },
    { code: 'es-AR', name: 'Español (Argentina)', base: 'es' },
    { code: 'es-CO', name: 'Español (Colombia)', base: 'es' },
    { code: 'es-MX', name: 'Español (México)', base: 'es' },
    { code: 'eu', name: 'Euskara' },
    { code: 'fr', name: 'Français' },
    { code: 'id', name: 'Bahasa Indonesia' },
    { code: 'it', name: 'Italiano' },
    { code: 'nl', name: 'Nederlands' },
    { code: 'nb', name: 'Norsk bokmål' },
    { code: 'pl', name: 'Polski' },
    { code: 'pt-BR', name: 'Português (Brasil)', base: 'pt' },
    { code: 'pt', name: 'Português (Portugal)' },
    { code: 'fi', name: 'Suomi' },
    { code: 'sv', name: 'Svenska' },
    { code: 'tl', name: 'Tagalog', intl: 'fil' },
    { code: 'vi', name: 'Tiếng Việt', script: 'vietnamese' },
    { code: 'tr', name: 'Türkçe' },
    { code: 'pa', name: 'ਪੰਜਾਬੀ', script: 'gurmukhi', intl: 'pa-Guru-IN' },
    { code: 'ta', name: 'தமிழ்', script: 'tamil' },
    { code: 'th', name: 'ไทย', script: 'thai' },
    { code: 'zh-CN', name: '简体中文', script: 'sc' },
    { code: 'ja', name: '日本語', script: 'jp' },
    { code: 'ko', name: '한국어', script: 'kr' }
  ];
  var BY_CODE = {};
  LANGUAGES.forEach(function (l) { BY_CODE[l.code.toLowerCase()] = l; });

  // Browser tags that should land on a supported language
  var ALIASES = {
    'zh': 'zh-CN', 'zh-hans': 'zh-CN', 'zh-sg': 'zh-CN', 'zh-hans-cn': 'zh-CN',
    'no': 'nb', 'nn': 'nb', 'nb-no': 'nb', 'fil': 'tl', 'pa-in': 'pa', 'pa-guru': 'pa',
    'es-419': 'es-MX', 'es-us': 'es-MX', 'es-es': 'es', 'pt-pt': 'pt', 'pt-ao': 'pt', 'pt-mz': 'pt'
  };

  function language(code) { return BY_CODE[String(code || '').toLowerCase()] || null; }

  /** Best supported language for one browser/URL tag, or null. */
  function matchLanguage(tag) {
    if (!tag) return null;
    var t = String(tag).replace(/_/g, '-').toLowerCase();
    if (BY_CODE[t]) return BY_CODE[t].code;
    if (ALIASES[t]) return ALIASES[t];
    var parts = t.split('-');
    // es-XX / pt-XX regions we don't list fall back to the base language
    for (var i = parts.length - 1; i > 0; i--) {
      var p = parts.slice(0, i).join('-');
      if (ALIASES[p]) return ALIASES[p];
      if (BY_CODE[p]) return BY_CODE[p].code;
    }
    return null;
  }

  /** First supported language in a list such as navigator.languages; English if none. */
  function pickLanguage(list) {
    for (var i = 0; i < (list || []).length; i++) {
      var m = matchLanguage(list[i]);
      if (m) return m;
    }
    return 'en';
  }

  /** Locale passed to Intl for a language code. */
  function intlLocale(code) {
    var l = language(code);
    return (l && l.intl) || (l && l.code) || 'en';
  }

  /** Chain of translation files to merge, base first: es-AR -> ['en','es','es-AR']. */
  function fileChain(code) {
    var l = language(code) || BY_CODE.en, chain = ['en'];
    if (l.base && l.base !== 'en') chain.push(l.base);
    if (l.code !== 'en') chain.push(l.code);
    return chain;
  }

  /* ---------- Currencies ---------- */
  /** Default currency for a list of browser tags, using currencies.json data. */
  function pickCurrency(list, data) {
    var regions = data.regions || {}, langs = data.languages || {};
    for (var i = 0; i < (list || []).length; i++) {
      var parts = String(list[i]).replace(/_/g, '-').split('-');
      for (var j = parts.length - 1; j > 0; j--) {
        var r = parts[j].toUpperCase();
        if (/^[A-Z]{2}$/.test(r) && regions[r]) return regions[r];
      }
    }
    for (var k = 0; k < (list || []).length; k++) {
      var lang = matchLanguage(list[k]);
      if (lang && langs[lang]) return langs[lang];
    }
    return data.fallback || 'USD';
  }

  /* ---------- Numbers ---------- */
  var DIGIT_ZEROS = [0xFF10, 0x0660, 0x06F0, 0x0966, 0x09E6, 0x0A66, 0x0AE6, 0x0BE6, 0x0E50, 0x1040, 0x17E0];

  function separators(locale) {
    var parts = new Intl.NumberFormat(locale).formatToParts(12345.6), dec = '.', grp = ',';
    parts.forEach(function (p) {
      if (p.type === 'decimal') dec = p.value;
      if (p.type === 'group') grp = p.value;
    });
    return { decimal: dec, group: grp };
  }

  /** Converts full-width, Arabic-Indic, Devanagari, Gurmukhi, Tamil, Thai… digits to ASCII. */
  function asciiDigits(s) {
    return String(s).replace(/[\uFF10-\uFF19\u0660-\u0669\u06F0-\u06F9\u0966-\u096F\u09E6-\u09EF\u0A66-\u0A6F\u0AE6-\u0AEF\u0BE6-\u0BEF\u0E50-\u0E59\u1040-\u1049\u17E0-\u17E9]/g, function (ch) {
      var c = ch.charCodeAt(0);
      for (var i = 0; i < DIGIT_ZEROS.length; i++) {
        if (c >= DIGIT_ZEROS[i] && c <= DIGIT_ZEROS[i] + 9) return String(c - DIGIT_ZEROS[i]);
      }
      return ch;
    });
  }

  /**
   * Reads what a student typed, following the chosen language.
   * Decimal-comma languages: comma is the decimal mark (never thousands); a dot alone is also read as a decimal.
   * Decimal-dot languages: comma groups thousands (1,234.5), but a lone comma that is not a thousands
   * pattern (8,47) is read as a decimal so a slip does not turn 8,47 into 847.
   * Returns NaN when it is not a number.
   */
  function parseNumber(input, locale) {
    if (input == null) return NaN;
    var sep = separators(locale || 'en');
    var t = asciiDigits(input)
      .replace(/\uFF0E/g, '.').replace(/[\uFF0C\u060C]/g, ',')
      .replace(/\u066B/g, sep.decimal === ',' ? ',' : '.').replace(/\u066C/g, '')
      .replace(/[\u2212\uFF0D\u2013]/g, '-').replace(/\uFF0B/g, '+')
      .replace(/[\s\u00A0\u202F\u2009'\u2019]/g, '')
      .replace(/^(%|\uFF05|\u066A)|(%|\uFF05|\u066A)$/g, '');
    if (t === '') return NaN;
    if (sep.decimal === ',') {
      if (t.indexOf(',') >= 0) t = t.replace(/\./g, '').replace(',', '.');
    } else if (t.indexOf(',') >= 0) {
      if (t.indexOf('.') >= 0 || /^[-+]?\d{1,3}(,\d{3})+$/.test(t)) t = t.replace(/,/g, '');
      else if ((t.match(/,/g) || []).length === 1) t = t.replace(',', '.');
    }
    if (!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(t)) return NaN;
    return parseFloat(t);
  }

  function formatNumber(n, locale, dp) {
    var o = dp == null ? {} : { minimumFractionDigits: dp, maximumFractionDigits: dp };
    return new Intl.NumberFormat(locale, o).format(n);
  }

  function formatMoney(n, locale, currency) {
    try {
      return new Intl.NumberFormat(locale, { style: 'currency', currency: currency, currencyDisplay: 'narrowSymbol', maximumFractionDigits: 0, minimumFractionDigits: 0 }).format(n);
    } catch (e) { return currency + ' ' + formatNumber(n, locale, 0); }
  }

  /* ---------- Marking ---------- */
  /** Spreadsheet rule: correct when |typed − exact answer| < tolerance (strictly less). */
  function isCorrect(value, exact, tol) {
    return typeof value === 'number' && isFinite(value) && Math.abs(value - exact) < tol;
  }

  function roundTo(x, dp) {
    var m = Math.pow(10, dp);
    return Math.round((x + Number.EPSILON * Math.sign(x)) * m) / m;
  }

  /* ---------- Random examples from approved ranges ---------- */
  /** A whole number on the grid min, min+step, …, max. rand() returns [0,1). */
  function drawStep(range, rand) {
    var n = Math.round((range.max - range.min) / range.step);
    return range.min + range.step * Math.floor(rand() * (n + 1));
  }

  /** Third decimal digit of num ÷ den × 100, in exact integer arithmetic (inputs are whole numbers). */
  function thirdDecimalOfPercent(num, den) {
    return Math.floor((num * 100000) / den) % 10;
  }

  /**
   * Draws one ratio-percentage metric (num ÷ den × 100) from its approved ranges.
   * Keeps a draw only if num < den, the answer is inside [keepMin, keepMax],
   * and the exact answer has no 5 in the third decimal.
   */
  function drawPercentMetric(metric, rand, maxTries) {
    var r = metric.ranges, tries = 0;
    while (tries++ < (maxTries || 100000)) {
      var den = drawStep(r[metric.den], rand), num = drawStep(r[metric.num], rand);
      if (!(num < den)) continue;
      var x = num / den * 100;
      if (x < metric.keep[0] || x > metric.keep[1]) continue;
      if (thirdDecimalOfPercent(num, den) === 5) continue;
      var v = {}; v[metric.num] = num; v[metric.den] = den;
      return { values: v, tries: tries };
    }
    throw new Error('No draw found for ' + metric.id);
  }

  /** Small seedable generator (mulberry32) for repeatable sweeps. */
  function seeded(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** Fills {name} placeholders. */
  function fill(str, vars) {
    return String(str).replace(/\{(\w+)\}/g, function (m, k) { return vars && vars[k] != null ? vars[k] : m; });
  }

  return {
    LANGUAGES: LANGUAGES, language: language, matchLanguage: matchLanguage, pickLanguage: pickLanguage,
    intlLocale: intlLocale, fileChain: fileChain, pickCurrency: pickCurrency,
    separators: separators, asciiDigits: asciiDigits, parseNumber: parseNumber,
    formatNumber: formatNumber, formatMoney: formatMoney,
    isCorrect: isCorrect, roundTo: roundTo,
    drawStep: drawStep, thirdDecimalOfPercent: thirdDecimalOfPercent, drawPercentMetric: drawPercentMetric,
    seeded: seeded, fill: fill
  };
});

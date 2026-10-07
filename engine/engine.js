/* Praxis Practice engine: page behaviour shared by every tool and the library page.
   Needs engine/core.js first. A tool page calls PraxisEngine.percentTool(definition);
   the library page calls PraxisEngine.library(). */
(function () {
  'use strict';
  var C = window.PraxisCore;

  /* ---------- Settings ---------- */
  var GOATCOUNTER_CODE = 'praxislearn';
  var SITE = 'https://praxislearn.co.za/';
  var STORE_LANG = 'praxis.lang', STORE_CUR = 'praxis.cur';
  var FONTS = {
    arabic: ['Noto Sans Arabic', 'Noto Naskh Arabic'],
    greek: ['Noto Sans', 'Noto Serif'],
    vietnamese: ['Noto Sans', 'Noto Serif'],
    gurmukhi: ['Noto Sans Gurmukhi', 'Noto Serif Gurmukhi'],
    tamil: ['Noto Sans Tamil', 'Noto Serif Tamil'],
    thai: ['Noto Sans Thai', 'Noto Serif Thai'],
    sc: ['Noto Sans SC', 'Noto Serif SC'],
    jp: ['Noto Sans JP', 'Noto Serif JP'],
    kr: ['Noto Sans KR', 'Noto Serif KR']
  };

  /* ---------- Small helpers ---------- */
  function $(sel, el) { return (el || document).querySelector(sel); }
  function $all(sel, el) { return Array.prototype.slice.call((el || document).querySelectorAll(sel)); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function store(key, val) {
    try { if (val === undefined) return window.localStorage.getItem(key); window.localStorage.setItem(key, val); } catch (e) { return null; }
    return null;
  }
  function getJSON(url) {
    return fetch(url, { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error(url + ' ' + r.status); return r.json(); });
  }
  function merge(list) {
    var out = {};
    list.forEach(function (o) { Object.keys(o || {}).forEach(function (k) { if (k.charAt(0) !== '_') out[k] = o[k]; }); });
    return out;
  }
  function utm(path, campaign) {
    return SITE + (path || '') + '?utm_source=practice-tools&utm_medium=web&utm_campaign=' + encodeURIComponent(campaign);
  }

  /* ---------- Analytics ---------- */
  (function () {
    if (!GOATCOUNTER_CODE) return;
    var s = document.createElement('script');
    s.async = true; s.src = 'https://gc.zgo.at/count.js';
    s.setAttribute('data-goatcounter', 'https://' + GOATCOUNTER_CODE + '.goatcounter.com/count');
    document.head.appendChild(s);
  })();
  var tracked = {};
  function track(name, once) {
    if (once) { if (tracked[name]) return; tracked[name] = true; }
    try { if (window.goatcounter && window.goatcounter.count) window.goatcounter.count({ path: name, title: name, event: true }); } catch (e) { /* stats are optional */ }
  }

  /* ---------- Language + currency state ---------- */
  function params() {
    var p = {};
    (location.search || '').replace(/^\?/, '').split('&').forEach(function (kv) {
      if (!kv) return;
      var i = kv.indexOf('=');
      p[decodeURIComponent(i < 0 ? kv : kv.slice(0, i))] = i < 0 ? '' : decodeURIComponent(kv.slice(i + 1));
    });
    return p;
  }
  function browserTags() {
    return (navigator.languages && navigator.languages.length) ? navigator.languages : [navigator.language || 'en'];
  }

  /**
   * Shared page frame: loads strings for a language (base + variant), applies dir/fonts,
   * fills [data-i18n] elements, runs the pickers. opts.root = path to the site root.
   */
  function Frame(opts) {
    this.root = opts.root;
    this.toolI18n = opts.toolI18n || null; // folder with this tool's own strings
    this.campaign = opts.campaign;
    this.slug = opts.slug;
    this.cache = {};
    this.onChange = opts.onChange || function () {};
  }
  Frame.prototype.files = function (code) {
    var self = this;
    var chain = C.fileChain(code);
    function load(dir) {
      return Promise.all(chain.map(function (c) {
        var url = dir + c + '.json';
        if (!self.cache[url]) self.cache[url] = getJSON(url).catch(function () { return {}; });
        return self.cache[url];
      }));
    }
    return Promise.all([
      load(self.root + 'i18n/'),
      load(self.root + 'i18n/glossary/'),
      self.toolI18n ? load(self.toolI18n) : Promise.resolve([])
    ]).then(function (r) {
      var gloss = r[1][r[1].length - 1] || {};
      return { strings: merge(r[0].concat(r[2])), glossary: merge(r[1]), checked: code === 'en' || gloss._checked === true };
    });
  };
  Frame.prototype.t = function (key, vars) {
    var s = this.strings[key];
    if (s == null) s = this.glossary[key];
    if (s == null) { if (window.console) console.warn('Missing string: ' + key); s = key; }
    return C.fill(s, vars);
  };
  Frame.prototype.g = function (key) { return this.glossary[key] != null ? this.glossary[key] : this.t(key); };
  Frame.prototype.applyScript = function (lang) {
    var l = C.language(lang), html = document.documentElement, fonts = l && FONTS[l.script];
    html.lang = lang; html.dir = (l && l.dir) || 'ltr';
    if (fonts) {
      var id = 'font-' + l.script;
      if (!document.getElementById(id)) {
        var link = document.createElement('link');
        link.id = id; link.rel = 'stylesheet';
        link.href = 'https://fonts.googleapis.com/css2?family=' + fonts.map(function (f) { return f.replace(/ /g, '+') + ':wght@400;500;600'; }).join('&family=') + '&display=swap';
        document.head.appendChild(link);
      }
      html.style.setProperty('--script-sans', "'" + fonts[0] + "'");
      html.style.setProperty('--script-serif', "'" + fonts[1] + "'");
      if (l.script !== 'vietnamese' && l.script !== 'greek') html.setAttribute('data-script', l.script);
      else html.removeAttribute('data-script');
    } else {
      html.style.removeProperty('--script-sans'); html.style.removeProperty('--script-serif'); html.removeAttribute('data-script');
    }
  };
  Frame.prototype.fillStatic = function () {
    var self = this;
    $all('[data-i18n]').forEach(function (el) { el.textContent = self.t(el.getAttribute('data-i18n')); });
    $all('[data-i18n-attr]').forEach(function (el) {
      el.getAttribute('data-i18n-attr').split(';').forEach(function (pair) {
        var p = pair.split(':'); el.setAttribute(p[0], self.t(p[1]));
      });
    });
    $all('[data-href]').forEach(function (el) { el.href = utm(el.getAttribute('data-href'), self.campaign); });
    var note = $('#draftNote');
    if (note) {
      note.hidden = this.checked;
      var a = $('a', note);
      if (a) a.href = utm('contact-us/', this.campaign + '-translation-' + this.lang);
    }
  };
  Frame.prototype.setLanguage = function (lang, why) {
    var self = this;
    return this.files(lang).then(function (f) {
      self.lang = lang; self.locale = C.intlLocale(lang);
      self.strings = f.strings; self.glossary = f.glossary; self.checked = f.checked;
      self.applyScript(lang);
      self.fillStatic();
      var sel = $('#langPick'); if (sel) sel.value = lang;
      self.fillCurrencyOptions();
      if (why === 'user') { store(STORE_LANG, lang); track('lang-' + lang); }
      self.onChange('lang');
    });
  };
  Frame.prototype.setCurrency = function (cur, why) {
    this.cur = cur;
    var sel = $('#curPick'); if (sel) sel.value = cur;
    if (why === 'user') { store(STORE_CUR, cur); track('cur-' + cur); }
    this.onChange('cur');
  };
  Frame.prototype.fillCurrencyOptions = function () {
    var sel = $('#curPick'); if (!sel || !this.currencies) return;
    var names = null;
    try { names = new Intl.DisplayNames([this.locale], { type: 'currency' }); } catch (e) { names = null; }
    var list = this.currencies.picker.slice(), self = this;
    sel.innerHTML = list.map(function (code) {
      var n = names ? names.of(code) : '';
      return '<option value="' + code + '">' + code + (n && n !== code ? ' – ' + esc(n) : '') + '</option>';
    }).join('');
    sel.value = self.cur;
  };
  Frame.prototype.start = function (withCurrency) {
    var self = this, q = params(), tags = browserTags();
    var lang = C.matchLanguage(q.lang) || C.matchLanguage(store(STORE_LANG)) || C.pickLanguage(tags);
    if (C.matchLanguage(q.lang)) store(STORE_LANG, lang);
    var langSel = $('#langPick');
    if (langSel) {
      langSel.innerHTML = C.LANGUAGES.map(function (l) { return '<option value="' + l.code + '" lang="' + l.code + '">' + esc(l.name) + '</option>'; }).join('');
      langSel.addEventListener('change', function () { self.setLanguage(langSel.value, 'user'); });
    }
    var cur = Promise.resolve();
    if (withCurrency) {
      cur = getJSON(self.root + 'currencies.json').then(function (data) {
        self.currencies = data;
        var fromUrl = q.cur && /^[A-Za-z]{3}$/.test(q.cur) ? q.cur.toUpperCase() : null;
        var stored = store(STORE_CUR);
        self.cur = fromUrl || (stored && /^[A-Z]{3}$/.test(stored) ? stored : null) || C.pickCurrency(tags, data);
        if (fromUrl) store(STORE_CUR, fromUrl);
        if (data.picker.indexOf(self.cur) < 0) data.picker.unshift(self.cur);
        var curSel = $('#curPick');
        if (curSel) curSel.addEventListener('change', function () { self.setCurrency(curSel.value, 'user'); });
      });
    }
    return cur.then(function () { return self.setLanguage(lang, 'start'); });
  };

  /* ---------- Shared click tracking for data-track links ---------- */
  function trackClicks(prefix) {
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('[data-track]');
      if (a) track(prefix + a.getAttribute('data-track'));
    });
  }

  /* =====================================================================
     Percentage tool: each metric = numerator ÷ denominator × 100,
     marked against the exact answer with the tool's tolerance.
     ===================================================================== */
  function percentTool(def) {
    var frame = new Frame({ root: def.root, toolI18n: 'i18n/', campaign: def.campaign, slug: def.slug, onChange: function () { render(); } });
    var examples = [def.example], entries = [{}], current = 0, open = {};
    var dp = def.grading.dp, tol = def.grading.tol;

    trackClicks(def.slug + '/');

    function answerOf(m, v) { return v[m.num] / v[m.den] * 100; }
    function pct(x, digits) { return C.formatNumber(x, frame.locale, digits); }
    function pctStyle(x) {
      return new Intl.NumberFormat(frame.locale, { style: 'percent', minimumFractionDigits: dp, maximumFractionDigits: dp }).format(C.roundTo(x, dp) / 100);
    }
    function given(m, key, v) {
      var inp = m.inputs[key];
      return inp.money ? C.formatMoney(v, frame.locale, frame.cur) : C.formatNumber(v, frame.locale, 0);
    }
    function newExample() {
      var ex = {};
      def.metrics.forEach(function (m) { ex[m.id] = C.drawPercentMetric(m, Math.random).values; });
      return ex;
    }

    function render() {
      if (!frame.strings) return;
      var ex = examples[current], html = '';
      document.title = frame.t('meta.title') + ' | Praxis Learn';
      $('#exName').textContent = frame.t('ui.example', { n: current + 1 });
      $('#instructions').textContent = frame.t('instructions', { p: new Intl.NumberFormat(frame.locale, { style: 'percent' }).format(0.2), a: pct(20, 2), b: pct(0.2, 1) });
      def.metrics.forEach(function (m, i) {
        var v = ex[m.id];
        var rows = [m.num, m.den].map(function (k) {
          var inp = m.inputs[k];
          var unit = inp.money ? frame.cur : frame.g(inp.unit);
          return '<tr><td>' + esc(frame.g(inp.term)) + '</td><td class="val"><span class="num">' + esc(given(m, k, v[k])) + '</span></td><td class="unit">' + esc(unit) + '</td></tr>';
        });
        var id = 'a_' + m.id, ans = frame.g(m.term) + ' (%)';
        var formula = frame.g(m.inputs[m.num].term) + ' ÷ ' + frame.g(m.inputs[m.den].term) + ' × 100';
        html += '<section class="card metric" aria-labelledby="h_' + m.id + '">' +
          '<h2 id="h_' + m.id + '">' + (i + 1) + '. ' + esc(frame.g(m.term)) + '</h2>' +
          '<table class="given"><thead><tr><th scope="col">' + esc(frame.t('ui.given')) + '</th><th scope="col"></th><th scope="col"></th></tr></thead><tbody>' + rows.join('') + '</tbody></table>' +
          '<div class="answer-row"><div><label class="answer-label" for="' + id + '">' + esc(ans) + '</label><span class="unit-tag">%</span>' +
          '<div class="formula">' + esc(formula) + '</div></div>' +
          '<div><div class="inbox"><input id="' + id + '" data-m="' + m.id + '" inputmode="decimal" autocomplete="off" spellcheck="false" dir="ltr" placeholder="' + esc(frame.t('ui.yourAnswer')) + '"><span class="mark" aria-hidden="true"></span></div><div class="hint" aria-live="polite"></div></div></div>' +
          '<button class="linkbtn" type="button" data-working="' + m.id + '" aria-expanded="false" aria-controls="w_' + m.id + '">' + esc(frame.t('ui.showWorking')) + '</button>' +
          '<div class="working" id="w_' + m.id + '" hidden></div>' +
          '</section>';
      });
      $('#metrics').innerHTML = html;
      $all('#metrics input[data-m]').forEach(function (el) {
        var saved = entries[current][el.dataset.m];
        if (saved != null) el.value = saved;
        mark(el);
      });
      Object.keys(open).forEach(function (id) { if (open[id]) toggleWorking(id, true); });
      updateProgress();
    }

    function mark(el) {
      var m = def.metrics.filter(function (x) { return x.id === el.dataset.m; })[0];
      var exact = answerOf(m, examples[current][m.id]);
      var box = el.closest('.inbox'), sign = $('.mark', box), hint = el.closest('div').parentNode.querySelector('.hint');
      box.classList.remove('ok', 'bad'); sign.textContent = ''; hint.textContent = '';
      if (el.value === '') { el.removeAttribute('aria-invalid'); el.removeAttribute('title'); return null; }
      var v = C.parseNumber(el.value, frame.locale), ok = C.isCorrect(v, exact, tol);
      if (isNaN(v)) hint.textContent = frame.t('ui.hintNumber', { ex: pct(12.34, 2) });
      else if (!ok && Math.abs(v * 100 - exact) < 0.5) hint.textContent = frame.t('ui.hintDecimal', { pct: pct(12.34, 2), dec: pct(0.1234, 4) });
      else if (!ok && Math.abs(v - exact) < 0.05) hint.textContent = frame.t('ui.hintRounding', { dp: dp });
      box.classList.add(ok ? 'ok' : 'bad');
      sign.textContent = ok ? '✓' : '✗';
      el.setAttribute('aria-invalid', ok ? 'false' : 'true');
      el.title = frame.t(ok ? 'ui.correct' : 'ui.notYet');
      return ok;
    }

    function updateProgress() {
      var total = def.metrics.length, n = $all('#metrics .inbox.ok').length;
      $('#bar').style.width = (n / total * 100) + '%';
      $('#progressText').textContent = frame.t('ui.progress', { n: n, total: total });
      $('#doneTitle').textContent = frame.t('ui.doneTitle', { total: total });
      var done = $('#done');
      if (n === total) { if (!done.classList.contains('show')) { done.classList.add('show'); track(def.slug + '/complete'); } }
      else done.classList.remove('show');
    }

    function workingHTML(id) {
      var m = def.metrics.filter(function (x) { return x.id === id; })[0], v = examples[current][id];
      var exact = answerOf(m, v), a = v[m.num], b = v[m.den];
      var isExact = Math.abs(C.roundTo(exact, 4) - exact) < 1e-12;
      var shownExact = pct(C.roundTo(exact, 4), 4) + (isExact ? '' : '…');
      var nums = '<bdi>' + esc(given(m, m.num, a)) + '</bdi> ÷ <bdi>' + esc(given(m, m.den, b)) + '</bdi> × 100 = ' + esc(shownExact);
      return '<div style="font-weight:600;margin-bottom:4px">' + esc(frame.g(m.inputs[m.num].term) + ' ÷ ' + frame.g(m.inputs[m.den].term) + ' × 100') + '</div>' +
        '<div class="wl">' + nums + '</div>' +
        '<div style="margin-top:6px">' + esc(frame.t('ui.workingRounded', { dp: dp })) + ' <strong class="num">' + esc(pctStyle(exact)) + '</strong></div>' +
        (m.inputs[m.num].money ? '<div class="muted" style="margin-top:6px">' + esc(frame.t('note.currency')) + '</div>' : '');
    }
    function toggleWorking(id, show) {
      var box = $('#w_' + id), b = $('[data-working="' + id + '"]');
      if (show) box.innerHTML = workingHTML(id);
      box.hidden = !show; b.setAttribute('aria-expanded', String(show));
      b.textContent = frame.t(show ? 'ui.hideWorking' : 'ui.showWorking');
    }

    $('#metrics').addEventListener('input', function (e) {
      var el = e.target; if (!el.dataset.m) return;
      entries[current][el.dataset.m] = el.value;
      mark(el); updateProgress(); track(def.slug + '/tool-used', true);
    });
    $('#metrics').addEventListener('click', function (e) {
      var b = e.target.closest('[data-working]'); if (!b) return;
      var id = b.dataset.working, show = $('#w_' + id).hidden;
      open[id] = show; toggleWorking(id, show);
      if (show) track(def.slug + '/working-opened', true);
    });
    function another() {
      if (current === examples.length - 1) { examples.push(newExample()); entries.push({}); }
      current++; open = {};
      render(); track(def.slug + '/another-example');
      $('.toolbar').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    $('#nextEx').addEventListener('click', another);
    $('#doneNext').addEventListener('click', another);
    $('#clearEx').addEventListener('click', function () { entries[current] = {}; render(); });

    // Exposed for the automated checks only
    window.PraxisTool = {
      def: def, examples: examples, current: function () { return current; },
      answers: function () { var ex = examples[current]; return def.metrics.map(function (m) { return answerOf(m, ex[m.id]); }); },
      newExample: newExample, frame: frame
    };
    frame.start(true);
  }

  /* =====================================================================
     Library page: tools by subject, from catalogue.json
     ===================================================================== */
  function library() {
    var catalogue = null;
    var frame = new Frame({ root: '', campaign: 'library', slug: 'library', onChange: function () { render(); } });
    trackClicks('library/');
    function render() {
      if (!catalogue || !frame.strings) return;
      document.title = frame.t('library.title') + ' | Praxis Learn';
      var subjects = [];
      catalogue.tools.forEach(function (tl) { if (subjects.indexOf(tl.subject) < 0) subjects.push(tl.subject); });
      $('#library').innerHTML = subjects.map(function (s) {
        return '<section class="subject" aria-labelledby="s_' + s + '"><h2 id="s_' + s + '">' + esc(frame.t('subject.' + s)) + '</h2><div class="tool-grid">' +
          catalogue.tools.filter(function (tl) { return tl.subject === s; }).map(function (tl) {
            var multi = tl.languages === 'all' || (tl.languages || []).indexOf(frame.lang) >= 0;
            var href = tl.path + (multi && frame.lang !== 'en' ? '?lang=' + encodeURIComponent(frame.lang) : '');
            return '<article class="card tool-card"><h3>' + esc(frame.t('catalogue.' + tl.slug + '.title')) + '</h3>' +
              (multi ? '' : '<span class="badge">' + esc(frame.t('library.englishOnly')) + '</span>') +
              '<p>' + esc(frame.t('catalogue.' + tl.slug + '.text')) + '</p><div class="actions">' +
              '<a class="btn" data-track="open-' + tl.slug + '" href="' + esc(href) + '">' + esc(frame.t('library.open')) + '</a>' +
              (tl.video ? '<a class="btn secondary" data-track="video-' + tl.slug + '" href="' + esc(tl.video) + '" rel="noopener">' + esc(frame.t('library.video')) + '</a>' : '') +
              '</div></article>';
          }).join('') + '</div></section>';
      }).join('');
    }
    getJSON('catalogue.json').then(function (c) { catalogue = c; render(); });
    frame.start(false);
  }

  window.PraxisEngine = { percentTool: percentTool, library: library, track: track };
})();

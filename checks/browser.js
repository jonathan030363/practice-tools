// Browser test (Playwright + Chromium). Serve the repo root first, e.g.
//   python3 -m http.server 8765   then   node checks/browser.js http://localhost:8765 [screenshot dir]
'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const BASE = process.argv[2] || 'http://localhost:8765';
const SHOTS = process.argv[3] || null;
const C = require('../engine/core.js');
let bad = 0;
function check(ok, msg) { if (!ok) { bad++; console.log('FAIL ' + msg); } else console.log('ok   ' + msg); }

(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  async function open(path, opts = {}) {
    const ctx = await browser.newContext({ viewport: opts.viewport || { width: 1280, height: 900 }, locale: opts.locale || 'en-GB' });
    await ctx.route(/goatcounter|gc\.zgo\.at|fonts\.(googleapis|gstatic)/, r => r.abort());
    const page = await ctx.newPage();
    const errors = [], missing = [];
    page.on('pageerror', e => errors.push(String(e)));
    page.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED|net::/.test(m.text())) errors.push(m.text()); if (/Missing string/.test(m.text())) missing.push(m.text()); });
    await page.goto(BASE + path);
    await page.waitForLoadState('networkidle');
    return { page, ctx, errors, missing };
  }
  const keyLike = /\b(ui|cta|library|hero|meta|note|subject|catalogue|footer)\.[a-zA-Z-]+\b|\{(n|total|dp|ex|pct|dec|p|a|b)\}/;

  /* ---- Library ---- */
  {
    const { page, ctx, errors } = await open('/');
    check(await page.locator('.tool-card').count() === 2, 'library lists 2 tools');
    check(await page.locator('a[href="tools/ratios/"]').count() === 1, 'library links to the ratio tool (old root link)');
    await page.click('a[href="tools/ratios/"]');
    await page.waitForLoadState('networkidle');
    check(/Financial ratio practice/.test(await page.title()), 'ratio tool opens from the library');
    await page.fill('#roa_y1', '1');
    check(await page.locator('.inbox.bad').count() === 1, 'ratio tool still marks answers');
    check(errors.length === 0, 'library + ratio tool: no JS errors ' + errors.join(' | '));
    await ctx.close();
  }

  /* ---- Market share, English ---- */
  const { page, ctx, errors, missing } = await open('/tools/market-share/', { locale: 'en-ZA' });
  const exact = await page.evaluate(() => PraxisTool.answers());
  const want = [84000 / 420000 * 100, 12400 / 310000 * 100, 4200000 / 18500000 * 100, 45600 / 380000 * 100];
  check(exact.every((x, i) => Math.abs(x - want[i]) < 1e-12), 'Example 1 answers match the spreadsheet: ' + exact.map(x => x.toFixed(4)).join(', '));
  check(await page.inputValue('#curPick') === 'ZAR', 'en-ZA browser defaults to ZAR');
  check(/R\s?4,200,000/.test(await page.textContent('#metrics')), 'revenue shown with rand symbol');
  const box = id => page.locator(`#a_${id}`).locator('xpath=..');
  const hint = id => page.locator(`#a_${id}`).locator('xpath=../../div[contains(@class,"hint")]');
  await page.fill('#a_ums', '20.00'); check(await box('ums').getAttribute('class') === 'inbox ok', 'correct answer 20.00 turns green');
  await page.fill('#a_rms', '22.80'); check(/bad/.test(await box('rms').getAttribute('class')), 'wrong answer 22.80 turns red');
  await page.fill('#a_rms', '0.227'); check(/bad/.test(await box('rms').getAttribute('class')) && /decimal/.test(await hint('rms').textContent()), 'decimal slip 0.227 → red + decimal hint');
  await page.fill('#a_rms', '22.71'); check(/bad/.test(await box('rms').getAttribute('class')) && /rounding/.test(await hint('rms').textContent()), 'rounding slip 22.71 → red + rounding hint');
  await page.fill('#a_rms', '22.7'); check(/ok/.test(await box('rms').getAttribute('class')), '22.7 accepted (same as 22.70; spreadsheet rule)');
  await page.fill('#a_rms', '22.70'); check(/ok/.test(await box('rms').getAttribute('class')), '22.70 accepted (exact 22.7027…)');
  await page.fill('#a_rms', '22.705'); check(/ok/.test(await box('rms').getAttribute('class')), '22.705 within 0.005 accepted (spreadsheet rule)');
  await page.fill('#a_rms', '22.6977'); check(/bad/.test(await box('rms').getAttribute('class')), '22.6977 (0.005 away) rejected');
  await page.fill('#a_rms', 'abc'); check(/number/.test(await hint('rms').textContent()), 'text → "Enter a number" hint');
  await page.click('[data-working="rms"]');
  const w = await page.textContent('#w_rms');
  check(/4,200,000|4 200 000/.test(w) && /22\.7027…/.test(w) && /22\.70/.test(w), 'Show working has real numbers: ' + w.replace(/\s+/g, ' ').slice(0, 120));
  await page.fill('#a_rms', '22.70'); await page.fill('#a_pen', '4'); await page.fill('#a_bpen', '12.00');
  check(await page.isVisible('#done') && /4 of 4 correct/.test(await page.textContent('#progressText')), 'all answers → completion panel + 4 of 4');
  // currency switch keeps answers and marks
  await page.selectOption('#curPick', 'USD');
  check(/\$4,200,000/.test(await page.textContent('#metrics')) && await page.locator('.inbox.ok').count() === 4, 'currency switch: $ shown, answers unchanged and still correct');
  if (SHOTS) await page.screenshot({ path: SHOTS + '/desktop-en.png', fullPage: true });

  // Try another: random examples follow the rules; page answers vs plain recalculation
  const sample = await page.evaluate(() => { const out = []; for (let i = 0; i < 2000; i++) out.push(PraxisTool.newExample()); return out; });
  let mism = 0, rules = 0;
  const def = require('../tools/market-share/definition.js');
  for (const ex of sample) for (const m of def.metrics) {
    const v = ex[m.id], a = v[m.num], b = v[m.den], x = a * 100 / b;
    if (!(a < b) || x < m.keep[0] || x > m.keep[1] || Math.floor(a * 100000 / b) % 10 === 5) rules++;
  }
  check(rules === 0, `2,000 in-page "Try another" examples (8,000 answers) obey the approved ranges and rules`);
  await page.click('#nextEx');
  const pageAns = await page.evaluate(() => PraxisTool.answers());
  const ex2 = await page.evaluate(() => PraxisTool.examples[1]);
  def.metrics.forEach((m, i) => { if (Math.abs(ex2[m.id][m.num] / ex2[m.id][m.den] * 100 - pageAns[i]) > 1e-12) mism++; });
  check(mism === 0 && /Example 2/.test(await page.textContent('#exName')) && await page.locator('.inbox.ok').count() === 0, 'Try another → Example 2, empty answers, page answers match recalculation');
  await page.fill('#a_ums', C.roundTo(pageAns[0], 2).toFixed(2));
  check(await page.locator('.inbox.ok').count() === 1, 'Example 2: rounded answer marked correct');
  check(errors.length === 0, 'market share (en): no JS errors ' + errors.join(' | '));
  check(missing.length === 0, 'market share (en): no missing strings');
  await ctx.close();

  /* ---- Languages: German (decimal comma), Arabic (RTL), Japanese (full-width) ---- */
  {
    const { page, ctx, errors, missing } = await open('/tools/market-share/', { locale: 'de-DE' });
    check(await page.inputValue('#langPick') === 'de' && await page.inputValue('#curPick') === 'EUR', 'de-DE browser → Deutsch + EUR');
    await page.fill('#a_rms', '22,70'); check(await page.locator('.inbox.ok').count() === 1, 'de: 22,70 read as 22.70 ✓');
    await page.fill('#a_ums', '20.00'); check(await page.locator('.inbox.ok').count() === 2, 'de: dot decimal 20.00 also accepted');
    await page.fill('#a_pen', '8,47'); check(/bad/.test(await page.locator('#a_pen').locator('xpath=..').getAttribute('class')), 'de: 8,47 read as 8.47 (wrong for 4.00), not 847');
    await page.fill('#a_pen', '4,00');
    // switch to Arabic: answers survive, layout mirrors
    await page.selectOption('#langPick', 'ar'); await page.waitForTimeout(300);
    check(await page.evaluate(() => document.documentElement.dir) === 'rtl', 'ar: page is right-to-left');
    check(await page.inputValue('#a_rms') === '22,70' && await page.locator('.inbox.ok').count() === 3, 'switch de → ar keeps typed answers and marks');
    const brandX = await page.evaluate(() => document.querySelector('.brand').getBoundingClientRect().left);
    check(brandX > 600, 'ar: header mirrored (logo on the right)');
    await page.fill('#a_bpen', '١٢٫٠٠'); check(await page.locator('.inbox.ok').count() === 4, 'ar: Arabic-Indic digits ١٢٫٠٠ read as 12.00 ✓');
    const wl = await page.evaluate(() => { document.querySelector('[data-working="ums"]').click(); return getComputedStyle(document.querySelector('#w_ums .wl')).direction; });
    check(wl === 'ltr', 'ar: working numbers stay left-to-right');
    if (SHOTS) await page.screenshot({ path: SHOTS + '/desktop-ar.png', fullPage: true });
    await page.selectOption('#langPick', 'ja'); await page.waitForTimeout(300);
    await page.fill('#a_rms', '２２．７０'); check(/ok/.test(await page.locator('#a_rms').locator('xpath=..').getAttribute('class')), 'ja: full-width ２２．７０ read as 22.70 ✓');
    check(/Noto Sans JP/.test(await page.evaluate(() => document.documentElement.style.getPropertyValue('--script-sans'))), 'ja: Noto Sans JP loaded on demand');
    if (SHOTS) await page.screenshot({ path: SHOTS + '/desktop-ja.png', fullPage: true });
    check(errors.length === 0 && missing.length === 0, 'de/ar/ja: no JS errors or missing strings ' + errors.concat(missing).join(' | '));
    await ctx.close();
  }

  /* ---- Every language: all strings present, nothing untranslated shows ---- */
  {
    const { page, ctx, errors, missing } = await open('/tools/market-share/');
    const en = await page.evaluate(() => document.querySelector('main').innerText);
    const untranslated = [];
    for (const l of C.LANGUAGES) {
      if (l.code === 'en') continue;
      await page.selectOption('#langPick', l.code); await page.waitForTimeout(150);
      const txt = await page.evaluate(() => document.querySelector('main').innerText);
      if (keyLike.test(txt)) untranslated.push(l.code + ': ' + txt.match(keyLike)[0]);
      const h1 = await page.textContent('h1');
      if (h1 === 'Market share and penetration practice') untranslated.push(l.code + ': English title');
      if (!(await page.isVisible('#draftNote'))) untranslated.push(l.code + ': draft note hidden');
    }
    check(untranslated.length === 0 && missing.length === 0, `all ${C.LANGUAGES.length} languages: no missing strings or raw keys, draft note shown ` + untranslated.concat(missing).join(' | '));
    check(errors.length === 0, 'language sweep: no JS errors ' + errors.join(' | '));
    await ctx.close();
    const lib = await open('/');
    for (const l of C.LANGUAGES) { await lib.page.selectOption('#langPick', l.code); await lib.page.waitForTimeout(100); const t = await lib.page.evaluate(() => document.querySelector('main').innerText); if (keyLike.test(t)) untranslated.push('library ' + l.code); }
    check(untranslated.length === 0 && lib.missing.length === 0 && lib.errors.length === 0, 'library in all languages: no raw keys, missing strings or errors');
    await lib.ctx.close();
  }

  /* ---- Shareable link + phone width ---- */
  {
    const { page, ctx, errors } = await open('/tools/market-share/?lang=pt-BR&cur=BRL', { viewport: { width: 390, height: 844 }, locale: 'en-US' });
    check(await page.inputValue('#langPick') === 'pt-BR' && await page.inputValue('#curPick') === 'BRL', '?lang=pt-BR&cur=BRL overrides browser defaults');
    check(/R\$/.test(await page.textContent('#metrics')) && /Participação de mercado em unidades/.test(await page.textContent('#metrics')), 'pt-BR variant terms + R$ shown');
    const sw = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
    check(sw[0] <= sw[1], `no horizontal scroll at 390px (${sw[0]} ≤ ${sw[1]})`);
    if (SHOTS) await page.screenshot({ path: SHOTS + '/phone-pt-BR.png', fullPage: true });
    for (const code of ['ar', 'ta', 'de', 'ja']) {
      await page.selectOption('#langPick', code); await page.waitForTimeout(200);
      const s = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
      check(s[0] <= s[1], `no horizontal scroll at 390px in ${code} (${s[0]})`);
      if (SHOTS) await page.screenshot({ path: SHOTS + `/phone-${code}.png`, fullPage: true });
    }
    const lib = await open('/', { viewport: { width: 390, height: 844 } });
    const s2 = await lib.page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
    check(s2[0] <= s2[1], 'library: no horizontal scroll at 390px');
    if (SHOTS) await lib.page.screenshot({ path: SHOTS + '/phone-library.png', fullPage: true });
    // remembered choice on the device
    await page.goto(BASE + '/tools/market-share/'); await page.waitForLoadState('networkidle');
    check(await page.inputValue('#langPick') === 'ja' && await page.inputValue('#curPick') === 'BRL', 'language and currency remembered on the device');
    check(errors.length === 0 && lib.errors.length === 0, 'phone: no JS errors ' + errors.join(' | '));
    await ctx.close(); await lib.ctx.close();
  }
  await browser.close();
  console.log(bad ? `FAILED: ${bad}` : 'Browser checks clean');
  process.exit(bad ? 1 : 0);
})();

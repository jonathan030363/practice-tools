// Number-entry checks: decimal comma/dot, full-width and Arabic-Indic digits, per language.
'use strict';
const C = require('../engine/core.js');
const cases = [
  ['en', '8.47', 8.47], ['en', '8,47', 8.47], ['en', '1,234.5', 1234.5], ['en', '1,234', 1234], ['en', '20.00%', 20], ['en', ' 22.70 ', 22.7],
  ['de', '8,47', 8.47], ['de', '8.47', 8.47], ['de', '1.234,5', 1234.5], ['de', '22,70 %', 22.7],
  ['fr', '8,47', 8.47], ['fr', '1 234,5', 1234.5], ['fr', '1 234,5', 1234.5], ['es', '8,47', 8.47], ['pt-BR', '8,47', 8.47],
  ['cs', '8,47', 8.47], ['pl', '8,47', 8.47], ['tr', '%8,47', 8.47], ['tr', '8,47', 8.47],
  ['ja', '８．４７', 8.47], ['ja', '８.４７', 8.47], ['zh-CN', '２２．７０％', 22.7], ['ko', '8.47', 8.47],
  ['ar', '٨٫٤٧', 8.47], ['ar', '٨.٤٧', 8.47], ['ar', '8.47', 8.47], ['ar', '22٫70٪', 22.7],
  ['th', '๘.๔๗', 8.47], ['pa', '੮.੪੭', 8.47], ['ta', '8.47', 8.47],
  ['en', 'abc', NaN], ['de', '8,4,7', NaN], ['en', '', NaN]
];
let bad = 0;
for (const [lang, input, want] of cases) {
  const got = C.parseNumber(input, C.intlLocale(lang));
  const ok = (isNaN(want) && isNaN(got)) || Math.abs(got - want) < 1e-12;
  if (!ok) { bad++; console.log(`FAIL ${lang} ${JSON.stringify(input)} -> ${got}, want ${want}`); }
}
// language and currency defaults from browser tags
const cur = require('../currencies.json');
const pick = [
  [['pt-BR'], 'pt-BR', 'BRL'], [['en-ZA'], 'en', 'ZAR'], [['en-GB', 'en'], 'en', 'GBP'], [['de-DE'], 'de', 'EUR'],
  [['es-419'], 'es-MX', 'MXN'], [['es-AR'], 'es-AR', 'ARS'], [['zh-TW', 'zh-CN'], 'zh-CN', 'TWD'], [['ja'], 'ja', 'JPY'],
  [['nn-NO'], 'nb', 'NOK'], [['fil-PH'], 'tl', 'PHP'], [['af'], 'af', 'ZAR'], [['ar-EG'], 'ar', 'EGP'], [['xx'], 'en', 'USD']
];
for (const [tags, lang, c] of pick) {
  const gl = C.pickLanguage(tags), gc = C.pickCurrency(tags, cur);
  if (gl !== lang || gc !== c) { bad++; console.log(`FAIL ${tags} -> ${gl}/${gc}, want ${lang}/${c}`); }
}
console.log(bad ? `FAILED: ${bad}` : `Parsing and defaults clean: ${cases.length + pick.length} cases`);
process.exit(bad ? 1 : 0);

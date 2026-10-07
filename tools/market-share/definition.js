/* Market share and penetration practice: tool definition.
   Source: Market_Share_and_Penetration_Practice_2026-10-07.xlsx (Drive, self-marking library),
   sheet "Practice". Formulas = column G; example = column B; ranges = the approved
   "Ranges for “Try another”" block (I5:M17, approved by Jonathan on 7 October 2026).
   Labels are glossary keys (i18n/glossary/<lang>.json). The same data can later
   produce a Moodle Formula question (one template, two outputs). */
var MARKET_SHARE_TOOL = {
  slug: 'market-share',
  campaign: 'market-share',
  root: '../../',
  // Spreadsheet: answers to 2 decimals of a percent, correct if |answer − exact| < 0.005
  grading: { dp: 2, tol: 0.005 },
  metrics: [
    { id: 'ums', term: 'unit_market_share', num: 'brand', den: 'total',     // G9  = B7/B8*100
      inputs: { brand: { term: 'brand_unit_sales', unit: 'units' }, total: { term: 'total_market_unit_sales', unit: 'units' } },
      ranges: { total: { min: 100000, max: 900000, step: 10000 }, brand: { min: 5000, max: 400000, step: 1000 } },
      keep: [3, 60] },   // Brand < total; keep only if answer is 3%–60%
    { id: 'pen', term: 'market_penetration', num: 'customers', den: 'market', // G14 = B12/B13*100
      inputs: { customers: { term: 'current_customers', unit: 'customers' }, market: { term: 'target_market_size_households', unit: 'households' } },
      ranges: { market: { min: 100000, max: 900000, step: 10000 }, customers: { min: 2000, max: 200000, step: 100 } },
      keep: [1, 40] },   // Customers < market; keep only if answer is 1%–40%
    { id: 'rms', term: 'revenue_market_share', num: 'brand', den: 'total',   // G19 = B17/B18*100
      inputs: { brand: { term: 'brand_sales_revenue', money: true }, total: { term: 'total_market_revenue', money: true } },
      ranges: { total: { min: 5000000, max: 50000000, step: 100000 }, brand: { min: 200000, max: 20000000, step: 10000 } },
      keep: [3, 60] },   // Brand < total; keep only if answer is 3%–60%. Currency changes only the symbol.
    { id: 'bpen', term: 'brand_penetration', num: 'buyers', den: 'households', // G24 = B22/B23*100
      inputs: { buyers: { term: 'households_purchased', unit: 'households' }, households: { term: 'total_households', unit: 'households' } },
      ranges: { households: { min: 100000, max: 900000, step: 10000 }, buyers: { min: 5000, max: 400000, step: 100 } },
      keep: [2, 60] }    // Purchasers < total; keep only if answer is 2%–60%
  ],
  // All four metrics: redraw if the exact answer has a 5 in the third decimal (core.drawPercentMetric).
  // Example 1 = the spreadsheet's own given data (column B).
  example: {
    ums: { brand: 84000, total: 420000 },
    pen: { customers: 12400, market: 310000 },
    rms: { brand: 4200000, total: 18500000 },
    bpen: { buyers: 45600, households: 380000 }
  }
};
if (typeof module === 'object' && module.exports) module.exports = MARKET_SHARE_TOOL;
else window.PraxisEngine.percentTool(MARKET_SHARE_TOOL);

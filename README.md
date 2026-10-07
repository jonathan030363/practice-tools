# Praxis Practice tools

Free self-marking practice pages from Praxis Learn, served by GitHub Pages from `main`:
https://jonathan030363.github.io/practice-tools/

## Layout

```
index.html               library page: every tool by subject (built from catalogue.json)
catalogue.json           the tool list shown on the library page
currencies.json          region/language → default currency, currency picker order
engine/core.js           shared logic: languages, number parsing, marking, random draws (also runs in Node)
engine/engine.js         shared page behaviour: pickers, i18n, marking, workings, progress, GoatCounter
engine/praxis.css        shared brand styles (light/dark, right-to-left ready)
i18n/<lang>.json         shared UI strings (en = British English master; others are drafts)
i18n/glossary/<lang>.json  finance/marketing terms reused by every tool (_checked: true once reviewed)
tools/<topic>/           one folder per tool: index.html + definition.js + i18n/<lang>.json
checks/                  verification scripts (see below)
```

Tools:

| Tool | Folder | Source |
|---|---|---|
| Financial ratio practice (English only, pilot) | `tools/ratios/` | Ratio_Practice_Workbook |
| Market share and penetration practice | `tools/market-share/` | Market_Share_and_Penetration_Practice_2026-10-07.xlsx |

The old root address now opens the library page, which links to the ratio tool.

Regional variants (`es-AR`, `es-CO`, `es-MX`, `pt-BR`) hold only the strings that differ from
their base file (`es`, `pt`). Language/currency can be set in a link: `?lang=pt-BR&cur=BRL`.

## Checks

```
bash checks/run-all.sh path/to/Market_Share_and_Penetration_Practice_2026-10-07.xlsx
```

- `parse.js`: number entry in decimal-comma/dot languages, full-width and Arabic-Indic digits, default language/currency.
- `sweep.js` + `verify.py`: 10,000 kept draws per metric with the engine's own code, then an independent
  exact-fraction recalculation in Python; with the spreadsheet it also checks formulas, example figures,
  ranges, rules and grading against the workbook.
- `browser.js`: Playwright/Chromium test of the library, ratio tool and market share tool (marking, hints,
  workings, completion, Try another, all languages, Arabic RTL, phone width, screenshots).

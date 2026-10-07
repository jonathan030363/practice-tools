"""Independent recalculation (plain Python, exact fractions) of every draw from checks/sweep.js.

Usage: python3 checks/verify.py draws.csv [spreadsheet.xlsx]
With the spreadsheet, it also reads the formulas, example figures and the approved Ranges block
straight from the workbook and checks the tool definition matches them.
"""
import csv, json, re, subprocess, sys
from fractions import Fraction

# Spreadsheet formulas (sheet "Practice", column G): answer = numerator / denominator * 100
FORMULAS = {"ums": ("B7", "B8"), "pen": ("B12", "B13"), "rms": ("B17", "B18"), "bpen": ("B22", "B23")}
FORMULA_CELLS = {"ums": "G9", "pen": "G14", "rms": "G19", "bpen": "G24"}

draws, rows = sys.argv[1], None
definition = json.loads(subprocess.check_output(["node", "-e",
    "const d=require('./tools/market-share/definition.js');console.log(JSON.stringify(d))"]))
metrics = {m["id"]: m for m in definition["metrics"]}
problems = 0

if len(sys.argv) > 2:
    import openpyxl
    ws = openpyxl.load_workbook(sys.argv[2])["Practice"]
    for mid, (n, d) in FORMULAS.items():
        f = ws[FORMULA_CELLS[mid]].value
        if f != f"={n}/{d}*100":
            problems += 1; print("formula differs", mid, f)
        m, ex = metrics[mid], definition["example"][mid]
        if (ex[m["num"]], ex[m["den"]]) != (ws[n].value, ws[d].value):
            problems += 1; print("example differs", mid, ex, ws[n].value, ws[d].value)
    # Ranges block I7:M14 -> (metric number, variable label) rows
    label_to = {"Total market unit sales": ("ums", "total"), "Brand unit sales": ("ums", "brand"),
                "Total target market size": ("pen", "market"), "Number of current customers": ("pen", "customers"),
                "Total market revenue": ("rms", "total"), "Brand sales revenue": ("rms", "brand"),
                "Total households in target market": ("bpen", "households"), "Households that purchased the brand": ("bpen", "buyers")}
    seen = 0
    for r in range(7, 15):
        label = re.sub(r"^\d\.\s*", "", str(ws[f"I{r}"].value))
        mid, key = label_to[label]
        want = {"min": ws[f"J{r}"].value, "max": ws[f"K{r}"].value, "step": ws[f"L{r}"].value}
        if metrics[mid]["ranges"][key] != want:
            problems += 1; print("range differs", mid, key, metrics[mid]["ranges"][key], want)
        rule = ws[f"M{r}"].value
        if rule:
            lo, hi = map(int, re.search(r"answer is (\d+)%–(\d+)%", rule).groups())
            if metrics[mid]["keep"] != [lo, hi]:
                problems += 1; print("keep band differs", mid, metrics[mid]["keep"], (lo, hi))
        seen += 1
    if "5 in the third decimal" not in str(ws["M15"].value):
        problems += 1; print("redraw rule not found in M15")
    if "within 0.005" not in str(ws["A28"].value) or definition["grading"] != {"dp": 2, "tol": 0.005}:
        problems += 1; print("grading differs")
    print(f"Workbook: 4 formulas, 4 examples, {seen} ranges, rules and grading match the tool definition")

count = 0
with open(draws) as f:
    for row in csv.DictReader(f):
        m = metrics[row["metric"]]
        num, den = int(row["num"]), int(row["den"])
        exact = Fraction(num, den) * 100
        if abs(float(exact) - float(row["answer"])) > 1e-9:
            problems += 1; print("answer mismatch", row)
        third = int(exact * 1000) % 10
        if third == 5:
            problems += 1; print("5 in third decimal", row)
        # the 2-decimal answer a student types, marked with the spreadsheet rule ABS(C-G) < 0.005
        typed = Fraction(round(exact * 100), 100) if exact * 1000 % 10 != 5 else None
        if typed is None or not abs(typed - exact) < Fraction(5, 1000):
            problems += 1; print("rounded answer not accepted", row)
        if not (num < den and m["keep"][0] <= exact <= m["keep"][1]):
            problems += 1; print("rule broken", row)
        count += 1
print(f"Recalculated {count} answers in exact arithmetic: {problems} problems")
sys.exit(1 if problems else 0)

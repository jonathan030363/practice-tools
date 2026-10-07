#!/usr/bin/env bash
# Runs every check. Usage: bash checks/run-all.sh [path/to/spreadsheet.xlsx]
set -euo pipefail
cd "$(dirname "$0")/.."
tmp=$(mktemp -d)
node checks/parse.js
node checks/sweep.js 10000 "$tmp/draws.csv"
python3 checks/verify.py "$tmp/draws.csv" ${1:+"$1"}
python3 -m http.server 8799 >/dev/null 2>&1 & srv=$!
trap 'kill $srv' EXIT
sleep 1
NODE_PATH=${NODE_PATH:-$(npm root -g)} node checks/browser.js http://localhost:8799 "$tmp"
echo "All checks passed. Screenshots: $tmp"

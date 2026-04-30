#!/usr/bin/env bash
# Capture screenshots of the running dev server using headless Edge.
set -euo pipefail

EDGE='C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
BASE='http://localhost:5173'
OUT='C:\Users\Admin\Documents\Claude\Github\Dashboard-react\screenshots'

shoot() {
  local name="$1" path="$2" w="${3:-1440}" h="${4:-900}"
  "$EDGE" \
    --headless=new \
    --disable-gpu \
    --hide-scrollbars \
    --no-sandbox \
    --window-size="${w},${h}" \
    --virtual-time-budget=10000 \
    --screenshot="${OUT}\\${name}.png" \
    "${BASE}${path}" 2>/dev/null
  echo "captured ${name}.png"
}

shoot 01-home ""
shoot 02-plan "/plan"
shoot 03-todo "/todo"
shoot 04-skole "/skole"
shoot 05-notes "/notes"
shoot 06-sport "/sport"
shoot 07-gaming "/gaming"
shoot 08-links "/links"
shoot 09-tools "/tools"
shoot 10-tools-calculator "/tools/calculator"
shoot 11-tools-qr "/tools/qr"
shoot 12-tools-timer "/tools/timer"
shoot 13-tools-pdf "/tools/pdf"
shoot 14-tools-reader "/tools/reader"
shoot 15-tools-video "/tools/video"
shoot 16-tools-bgremove "/tools/bgremove"
shoot 17-tools-convert "/tools/convert"

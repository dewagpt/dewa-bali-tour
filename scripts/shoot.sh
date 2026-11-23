#!/bin/bash
# shoot.sh <url> <out> <lebar,tinggi> <skala>
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
rm -f "$2"
"$CHROME" --headless=new --disable-gpu --hide-scrollbars --no-first-run --no-default-browser-check \
  --force-device-scale-factor="${4:-1}" --user-data-dir="/tmp/dbt-p-$$-$RANDOM" \
  --screenshot="$2" --window-size="$3" --virtual-time-budget=6000 "$1" >/dev/null 2>&1
ls -l "$2" | awk "{print \$5, \$9}"
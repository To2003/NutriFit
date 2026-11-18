#!/usr/bin/env bash
# Genera el video tutorial (1080x1920, ~60 s) a partir del modo demo.
# Requiere: pnpm demo corriendo, Playwright con Chromium, ffmpeg, python3 + numpy + Pillow.
#   pnpm demo &            # http://localhost:3000
#   bash scripts/tutorial/build.sh
set -euo pipefail
export OUT="${OUT:-$PWD/.video}"
DIR="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$OUT/fonts"
cd "$OUT"
# Tipografía (Plus Jakarta Sans 500 y 800, Google Fonts, licencia OFL)
CSS=$(curl -s -A "Mozilla/4.0" "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;800")
mapfile -t URLS < <(echo "$CSS" | grep -o "https://[^)]*\.ttf")
curl -s -o fonts/jakarta-500.ttf "${URLS[0]}"
curl -s -o fonts/jakarta-800.ttf "${URLS[1]}"
NODE_PATH="${NODE_PATH:-$(npm root -g)}" node "$DIR/record.cjs"
ffmpeg -loglevel error -y -f concat -safe 0 -i frames.txt -vf "fps=30,format=yuv420p" -c:v libx264 -crf 17 screen.mp4
python3 "$DIR/audio.py"
python3 "$DIR/compose.py"
ffmpeg -loglevel error -y -loop 1 -i bg.png -i screen.mp4 -loop 1 -i mask.png -loop 1 -i frame.png -i audio.wav \
  -filter_complex_script filter.txt -map "[v]" -map 4:a -c:v libx264 -preset slow -crf 20 -r 30 \
  -c:a aac -b:a 192k -shortest -movflags +faststart nutrifit-tutorial.mp4
echo "Listo: $OUT/nutrifit-tutorial.mp4"

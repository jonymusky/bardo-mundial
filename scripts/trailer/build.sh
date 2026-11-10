#!/bin/sh
# Monta el tráiler: une las tomas capturadas, agrega el audio y deja mp4 + póster en public/media.
# Uso: scripts/trailer/build.sh <carpeta de captura>   (necesita ffmpeg)
set -eu
DIR=${1:-trailer-out}
OUT=public/media
mkdir -p "$OUT"
: > "$DIR/list.txt"
for d in "$DIR"/clip*/; do
  for f in "$d"*.jpg; do printf "file '%s'\nduration 0.0166667\n" "$(cd "$(dirname "$f")" && pwd)/$(basename "$f")" >> "$DIR/list.txt"; done
done
N=$(grep -c '^file' "$DIR/list.txt")
DUR=$(awk "BEGIN { printf \"%.3f\", $N / 60 }")
FADE=$(awk "BEGIN { printf \"%.3f\", $N / 60 - 0.5 }")
ffmpeg -y -loglevel error -f concat -safe 0 -r 60 -i "$DIR/list.txt" -i "$DIR/audio.wav" \
  -vf "fade=t=in:st=0:d=0.15,fade=t=out:st=$FADE:d=0.5,scale=in_range=full:out_range=tv,format=yuv420p" -color_range tv \
  -af "loudnorm=I=-15:TP=-1.5:LRA=11,afade=t=in:st=0:d=0.05,afade=t=out:st=$FADE:d=0.5" \
  -c:v libx264 -preset slow -crf 26 -profile:v high -r 60 -g 120 -c:a aac -b:a 192k -ar 48000 \
  -t "$DUR" -movflags +faststart "$OUT/trailer.mp4"
echo "trailer.mp4: $N cuadros, $DUR s"

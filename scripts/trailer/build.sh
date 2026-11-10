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
# Música: la pista grabada, estirada de su tempo (103,67 bpm) a 100 bpm para que cada pulso caiga en un corte
# (los cortes están cada 0,6 s), desde el primer pulso de la canción. Los efectos van aparte, ya sincronizados.
MUSIC=${MUSIC:-public/media/music.mp3}
ffmpeg -y -loglevel error -f concat -safe 0 -r 60 -i "$DIR/list.txt" -i "$DIR/audio.wav" -ss 0.152 -i "$MUSIC" \
  -filter_complex "[0:v]fade=t=in:st=0:d=0.15,fade=t=out:st=$FADE:d=0.5,scale=in_range=full:out_range=tv,format=yuv420p[v];[2:a]atempo=0.96460,volume=0.62[m];[1:a]volume=1.25[fx];[m][fx]amix=inputs=2:normalize=0:duration=first,loudnorm=I=-15:TP=-1.5:LRA=11,afade=t=in:st=0:d=0.04,afade=t=out:st=$FADE:d=0.5[a]" \
  -map "[v]" -map "[a]" -color_range tv \
  -c:v libx264 -preset slow -crf 26 -profile:v high -r 60 -g 120 -c:a aac -b:a 192k -ar 48000 \
  -t "$DUR" -movflags +faststart "$OUT/trailer.mp4"
echo "trailer.mp4: $N cuadros, $DUR s"

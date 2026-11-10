#!/bin/zsh
# uso: run.sh <lista.txt> <ref.png> <nombre>
S=${ART_SRC:-$(cd "$(dirname "$0")/.." && pwd)}
d=$(grep "^$3|" $1 | cut -d'|' -f2-)
$S/tools/gen.sh "$3" "$2" "$d"

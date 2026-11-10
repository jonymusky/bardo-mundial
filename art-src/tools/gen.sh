#!/bin/zsh
# uso: gen.sh <nombre> <ref.png> <descripcion>
S=${ART_SRC:-$(cd "$(dirname "$0")/.." && pwd)}
name=$1; ref=$2; subj=$3
mkdir -p $S/gen/$name
cd $S/gen/$name
codex exec --skip-git-repo-check -s workspace-write -C $S/gen/$name -i $ref -o $S/gen/$name/last.txt "Use your image generation tool to create ONE image and save it as $name.png in the current directory. Do not write code to draw it; generate it with the image tool. Do nothing else. Subject: $subj Style: polished hand-illustrated 2D game sprite that matches the attached reference image exactly: thick dark purple-black outline (#1b1026) of uniform weight, cel shading with 2-3 flat tones plus a crisp rim highlight, slightly chunky toy-like proportions, saturated colors. Transparent background (alpha PNG). No text, no letters, no numbers, no logos, no brand marks, no hands, no people, no ground shadow, no extra objects. The subject should fill most of the canvas with a small margin." > $S/gen/$name/log.txt 2>&1
ls $S/gen/$name/$name.png 2>/dev/null || echo "FALLO $name"

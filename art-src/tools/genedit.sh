#!/bin/zsh
# uso: genedit.sh <lista.txt> <nombre>   (edita la cabeza base)
S=${ART_SRC:-$(cd "$(dirname "$0")/.." && pwd)}
name=$2
subj=$(grep "^$name|" $1 | cut -d'|' -f2-)
mkdir -p $S/gen/h_$name
cd $S/gen/h_$name
cp $S/gen/head/head.png base.png
codex exec --skip-git-repo-check -s workspace-write -C $S/gen/h_$name -i $S/gen/head/head.png -o last.txt "Use your image generation tool in image-EDIT mode on the attached image (also available as base.png in the current directory) to create ONE image and save it as $name.png in the current directory. Do not write code to draw it. Do nothing else. The edit: keep the cartoon head EXACTLY as it is - same canvas size, same position, same scale, same angle, same skin colour, same outline, same ear and nose - and change only this: $subj Keep the same art style: thick dark purple-black outline of uniform weight, flat cel shading, clean shapes. Transparent background (alpha PNG), same square canvas. No text, no logos, no body, no neck." > log.txt 2>&1
ls $S/gen/h_$name/$name.png 2>/dev/null || echo "FALLO $name"

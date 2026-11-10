#!/bin/zsh
# uso: gentop.sh <lista.txt> <nombre>   (viste el torso base)
S=${ART_SRC:-$(cd "$(dirname "$0")/.." && pwd)}
name=$2
subj=$(grep "^$name|" $1 | cut -d'|' -f2-)
mkdir -p $S/gen/t_$name
cd $S/gen/t_$name
cp $S/gen/torso/torso.png base.png
codex exec --skip-git-repo-check -s workspace-write -C $S/gen/t_$name -i $S/gen/torso/torso.png -o last.txt "Use your image generation tool in image-EDIT mode on the attached image (also available as base.png in the current directory) to create ONE image and save it as $name.png in the current directory. Do not write code to draw it. Do nothing else. The attached image is a bare cartoon mannequin torso (no head, no arms, no legs). The edit: keep the torso EXACTLY as it is - same canvas size, same position, same scale, same angle, same skin colour, same outline - and dress it with this garment: $subj The garment has NO sleeves drawn beyond the shoulder edge (the arms are separate sprites): at each shoulder it ends in a short rounded shoulder cap at most. Wherever the garment does not cover the torso, the bare tan skin stays visible unchanged. Keep the same art style: thick dark purple-black outline of uniform weight, flat cel shading with a darker shade on the left/back side and a small highlight, clean shapes. Transparent background (alpha PNG), same square canvas. No text, no letters, no numbers, no logos, no arms, no legs, no head." > log.txt 2>&1
ls $S/gen/t_$name/$name.png 2>/dev/null || echo "FALLO $name"

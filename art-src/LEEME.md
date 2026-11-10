# Fuentes del arte

Imágenes originales (PNG a resolución completa) generadas con el generador de imágenes de Codex, y las
herramientas con las que se convirtieron en `public/art/*.webp`.

- `gen/` — una carpeta por imagen. `p_*` es el decorado (árboles, farol, etc.). `h_*` son ediciones de la cabeza base (`head/`), `t_*` del torso base (`torso/`), `bg_*` los fondos.
- `tools/*.txt` — las descripciones usadas para cada imagen.
- `tools/gen*.sh`, `run.sh` — cómo se llamó a `codex exec` (tienen rutas de una carpeta temporal: sirven de referencia, hay que ajustarlas para volver a correrlas).
- `tools/heads.mjs`, `tools/tops.mjs`, `tools/parts.mjs` — separan cabezas, pelo, prendas, brazos, piernas, zapatilla y pollera en capas teñibles. Uso: `node art-src/tools/heads.mjs art-src/gen public/art` (necesita ImageMagick).

Cabezas, pelo y prendas se generan en azul puro y piel tostada a propósito: ese color es la clave con la que
se separan las capas que después se tiñen con los colores que elige el jugador.

Esta carpeta no se despliega (`.vercelignore`).

Los brazos sin manga y de manga corta no tienen imagen propia: el generador rechazó esos pedidos, así que se
obtienen del brazo de manga larga tiñendo la tela con el color de piel (ver `partSprite` en `src/headArt.ts`).

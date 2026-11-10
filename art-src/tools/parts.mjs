// Separa piezas sueltas (brazos, piernas, zapatilla, pollera) en capas piel/tela/fijo con un recorte común.
// Uso: node parts.mjs <genDir> <outDir> [grosorContorno]
import { execFileSync } from 'node:child_process';
import { writeFileSync, existsSync } from 'node:fs';
const [gen, out, olArg] = process.argv.slice(2);
const GROW = Number(olArg ?? 0); // píxeles (en la imagen original) de contorno extra
const MAX = 256;
const tmp = out + '/_tmp.raw';
const hsv = (r, g, b) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; let h = 0; if (d) h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return [h * 60, mx ? d / mx : 0, mx / 255]; };
const lum = (r, g, b) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
const SKIN_REF = lum(0xd9, 0xa0, 0x66), BLUE_REF = lum(0x2f, 0x6b, 0xff);
const enc = (g, hi) => (g <= 1 ? Math.round(g * 200) : 200 + Math.min(55, Math.round(((g - 1) / hi) * 55)));
const isSkin = (r, g, b) => { const [h, s, v] = hsv(r, g, b); return h >= 14 && h <= 48 && s > 0.2 && v > 0.3; };
const isBlue = (r, g, b) => { const [h, s, v] = hsv(r, g, b); return h >= 200 && h <= 250 && s > 0.35 && v > 0.25; };
const meta = {};
for (const name of ['arm_plain', 'arm_long', 'leg_pants', 'leg_short', 'leg_bare', 'leg_ripped', 'shoe', 'skirt']) {
  const f = `${gen}/${name}/${name}.png`;
  if (!existsSync(f)) { console.log('FALTA', name); continue; }
  const [W, H] = execFileSync('magick', ['identify', '-format', '%w %h', f]).toString().split(' ').map(Number);
  const p = new Uint8Array(execFileSync('magick', [f, '-depth', '8', 'rgba:-'], { maxBuffer: 1 << 28 }));
  let x0 = W, x1 = 0, y0 = H, y1 = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (p[(y * W + x) * 4 + 3] > 24) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  x0 = Math.max(0, x0 - GROW - 2); y0 = Math.max(0, y0 - GROW - 2); x1 = Math.min(W - 1, x1 + GROW + 2); y1 = Math.min(H - 1, y1 + GROW + 2);
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  const skin = new Uint8Array(w * h * 4), cloth = new Uint8Array(w * h * 4), fix = new Uint8Array(w * h * 4);
  // grosor medio del contorno: se mide cruzando la fila central
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = ((y + y0) * W + x + x0) * 4, o = (y * w + x) * 4;
    const r = p[i], g = p[i + 1], b = p[i + 2], a = p[i + 3];
    if (a < 8) continue;
    if (isBlue(r, g, b)) { const v = enc(lum(r, g, b) / BLUE_REF, 0.6); cloth[o] = cloth[o + 1] = cloth[o + 2] = v; cloth[o + 3] = a; }
    else if (isSkin(r, g, b)) { const v = enc(lum(r, g, b) / SKIN_REF, 0.25); skin[o] = skin[o + 1] = skin[o + 2] = v; skin[o + 3] = a; }
    else { fix[o] = r; fix[o + 1] = g; fix[o + 2] = b; fix[o + 3] = a; }
  }
  if (GROW > 0) {
    // contorno extra: donde no hay nada pero hay algo opaco a menos de GROW píxeles, se pinta el color del contorno
    const R2 = GROW * GROW;
    const solid = new Uint8Array(w * h);
    for (let j = 0; j < w * h; j++) { const i = ((Math.floor(j / w) + y0) * W + (j % w) + x0) * 4; solid[j] = p[i + 3] > 128 ? 1 : 0; }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (solid[y * w + x]) continue;
      let best = 1e9;
      for (let dy = -GROW; dy <= GROW && best > 0; dy++) { const yy = y + dy; if (yy < 0 || yy >= h) continue; for (let dx = -GROW; dx <= GROW; dx++) { const xx = x + dx; if (xx < 0 || xx >= w) continue; if (solid[yy * w + xx]) { const d = dx * dx + dy * dy; if (d < best) best = d; } } }
      if (best <= R2) { const o = (y * w + x) * 4; const aa = Math.max(fix[o + 3], Math.round(255 * Math.min(1, GROW - Math.sqrt(best) + 0.5))); fix[o] = 0x1b; fix[o + 1] = 0x10; fix[o + 2] = 0x26; fix[o + 3] = aa; }
    }
  }
  const k = MAX / Math.max(w, h);
  const ow = Math.round(w * k), oh = Math.round(h * k);
  for (const [buf, suf] of [[skin, 's'], [cloth, 't'], [fix, 'f']]) {
    writeFileSync(tmp, buf);
    execFileSync('magick', ['-size', `${w}x${h}`, '-depth', '8', `rgba:${tmp}`, '-resize', `${ow}x${oh}!`, '-define', 'webp:alpha-quality=95', '-quality', '94', `${out}/${name}_${suf}.webp`]);
  }
  // grosor del contorno en la fila del medio (del borde izquierdo hacia adentro)
  let ol = 0; { const y = Math.floor(h / 2); let x = 0; while (x < w && fix[(y * w + x) * 4 + 3] < 128 && skin[(y * w + x) * 4 + 3] < 128 && cloth[(y * w + x) * 4 + 3] < 128) x++; while (x < w && fix[(y * w + x) * 4 + 3] >= 128) { x++; ol++; } }
  meta[name] = { w: ow, h: oh, outlinePx: +(ol * k).toFixed(1) };
}
console.log(JSON.stringify(meta));

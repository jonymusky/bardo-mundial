// Separa las cabezas generadas en capas teñibles. Uso: node heads.mjs <genDir> <outDir>
import { execFileSync } from 'node:child_process';
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
const [gen, out] = process.argv.slice(2);
const N = 1254, OUT = 420;
mkdirSync(out, { recursive: true });
const tmp = out + '/_tmp.raw';
const load = (f) => new Uint8Array(execFileSync('magick', [f, '-resize', `${N}x${N}!`, '-depth', '8', 'rgba:-'], { maxBuffer: 1 << 28 }));
const save = (buf, name) => {
  writeFileSync(tmp, buf);
  execFileSync('magick', ['-size', `${N}x${N}`, '-depth', '8', `rgba:${tmp}`, '-resize', `${OUT}x${OUT}`, '-define', 'webp:alpha-quality=95', '-quality', '94', `${out}/${name}.webp`]);
};
const hsv = (r, g, b) => {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, mx ? d / mx : 0, mx / 255];
};
const lum = (r, g, b) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
const SKIN_REF = lum(0xd9, 0xa0, 0x66), HAIR_REF = lum(0x2f, 0x6b, 0xff);
// gris codificado: 0..200 = sombra (factor 0..1), 200..255 = brillo hacia el blanco
const enc = (g, hi) => (g <= 1 ? Math.round(g * 200) : 200 + Math.min(55, Math.round(((g - 1) / hi) * 55)));
const isSkin = (r, g, b) => { const [h, s, v] = hsv(r, g, b); return h >= 14 && h <= 48 && s > 0.2 && v > 0.3; };
const isBlue = (r, g, b) => { const [h, s, v] = hsv(r, g, b); return h >= 200 && h <= 250 && s > 0.35 && v > 0.25; };

// cabeza → capa de piel (gris para multiplicar) + capa de rasgos (tal cual)
function head(file, name) {
  const p = load(file);
  const skin = new Uint8Array(p.length), feat = new Uint8Array(p.length);
  let x0 = N, x1 = 0, y0 = N, y1 = 0;
  for (let i = 0; i < p.length; i += 4) {
    const r = p[i], g = p[i + 1], b = p[i + 2], a = p[i + 3];
    if (a < 8) continue;
    if (isSkin(r, g, b)) {
      const v = enc(lum(r, g, b) / SKIN_REF, 0.25);
      skin[i] = skin[i + 1] = skin[i + 2] = v; skin[i + 3] = a;
      const x = (i / 4) % N, y = Math.floor(i / 4 / N);
      if (a > 200) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    } else { feat[i] = r; feat[i + 1] = g; feat[i + 2] = b; feat[i + 3] = a; }
  }
  save(skin, name + '_s');
  save(feat, name + '_f');
  const k = OUT / N;
  console.log(name, 'piel bbox', [x0, y0, x1, y1].map((v) => Math.round(v * k)));
  return p;
}

// pelo/barba sobre la cabeza base → capa teñible (azul → gris, más su contorno) + capa fija (otros colores nuevos)
function hair(file, name, base) {
  const p = load(file);
  const blue = new Uint8Array(N * N);
  for (let i = 0, j = 0; i < p.length; i += 4, j++) if (p[i + 3] > 40 && isBlue(p[i], p[i + 1], p[i + 2])) blue[j] = 1;
  // dilatación de la máscara azul (ancho del contorno) con dos pasadas de caja
  const R = 13, near = new Uint8Array(N * N), row = new Uint16Array(N * N);
  for (let y = 0; y < N; y++) { let acc = 0; for (let x = 0; x < N + R; x++) { if (x < N) acc += blue[y * N + x]; if (x - 2 * R - 1 >= 0) acc -= blue[y * N + x - 2 * R - 1]; const cx = x - R; if (cx >= 0 && cx < N) row[y * N + cx] = acc; } }
  for (let x = 0; x < N; x++) { let acc = 0; for (let y = 0; y < N + R; y++) { if (y < N) acc += row[y * N + x]; if (y - 2 * R - 1 >= 0) acc -= row[(y - 2 * R - 1) * N + x]; const cy = y - R; if (cy >= 0 && cy < N) near[cy * N + x] = acc > 0 ? 1 : 0; } }
  const tint = new Uint8Array(p.length), fix = new Uint8Array(p.length);
  let nfix = 0;
  for (let i = 0, j = 0; i < p.length; i += 4, j++) {
    const r = p[i], g = p[i + 1], b = p[i + 2], a = p[i + 3];
    if (a < 8) continue;
    if (blue[j]) {
      const v = enc(lum(r, g, b) / HAIR_REF, 0.6);
      tint[i] = tint[i + 1] = tint[i + 2] = v; tint[i + 3] = a;
      continue;
    }
    if (!near[j]) continue;
    const dr = r - base[i], dg = g - base[i + 1], db = b - base[i + 2], da = a - base[i + 3];
    const diff = Math.abs(dr) + Math.abs(dg) + Math.abs(db) + Math.abs(da);
    if (diff < 90 || isSkin(r, g, b)) continue;
    const [, s, v] = hsv(r, g, b);
    if (v < 0.42 || s < 0.25) { const l = Math.round(lum(r, g, b) * 200); tint[i] = tint[i + 1] = tint[i + 2] = l; tint[i + 3] = a; }
    else { fix[i] = r; fix[i + 1] = g; fix[i + 2] = b; fix[i + 3] = a; nfix++; }
  }
  save(tint, name + '_t');
  if (nfix > 1500) { save(fix, name + '_x'); console.log(name, 'capa fija', nfix); }
}

const base = head(`${gen}/head/head.png`, 'head');
for (const e of ['blink', 'hurt', 'aim']) if (existsSync(`${gen}/h_${e}/${e}.png`)) head(`${gen}/h_${e}/${e}.png`, 'head_' + e);
for (const h of ['buzz', 'short', 'long', 'bun', 'afro', 'mohawk', 'pigtail', 'bob', 'curls', 'beard', 'mustache', 'goatee']) {
  if (existsSync(`${gen}/h_${h}/${h}.png`)) hair(`${gen}/h_${h}/${h}.png`, 'hair_' + h, base);
  else console.log('FALTA', h);
}

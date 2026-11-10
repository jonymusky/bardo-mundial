// Separa cada torso vestido en capas: piel (teñible), tela (teñible) y fijo. Uso: node tops.mjs <genDir> <outDir>
import { execFileSync } from 'node:child_process';
import { writeFileSync, existsSync } from 'node:fs';
const [gen, out] = process.argv.slice(2);
const N = 1254, OUT = 420;
const tmp = out + '/_tmp.raw';
const load = (f) => new Uint8Array(execFileSync('magick', [f, '-resize', `${N}x${N}!`, '-depth', '8', 'rgba:-'], { maxBuffer: 1 << 28 }));
const save = (buf, name) => {
  writeFileSync(tmp, buf);
  execFileSync('magick', ['-size', `${N}x${N}`, '-depth', '8', `rgba:${tmp}`, '-resize', `${OUT}x${OUT}`, '-define', 'webp:alpha-quality=95', '-quality', '94', `${out}/${name}.webp`]);
};
const hsv = (r, g, b) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; let h = 0; if (d) h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return [h * 60, mx ? d / mx : 0, mx / 255]; };
const lum = (r, g, b) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
const SKIN_REF = lum(0xd9, 0xa0, 0x66), BLUE_REF = lum(0x2f, 0x6b, 0xff);
const enc = (g, hi) => (g <= 1 ? Math.round(g * 200) : 200 + Math.min(55, Math.round(((g - 1) / hi) * 55)));
const isSkin = (r, g, b) => { const [h, s, v] = hsv(r, g, b); return h >= 14 && h <= 48 && s > 0.2 && v > 0.3; };
const isBlue = (r, g, b) => { const [h, s, v] = hsv(r, g, b); return h >= 200 && h <= 250 && s > 0.35 && v > 0.25; };
for (const name of ['tee', 'jersey', 'tank', 'hoodie', 'shirt', 'dress', 'suit', 'crop', 'vest']) {
  const f = `${gen}/t_${name}/${name}.png`;
  if (!existsSync(f)) { console.log('FALTA', name); continue; }
  const p = load(f);
  const skin = new Uint8Array(p.length), cloth = new Uint8Array(p.length), fix = new Uint8Array(p.length);
  let ns = 0, x0 = N, x1 = 0, y0 = N, y1 = 0;
  for (let i = 0; i < p.length; i += 4) {
    const r = p[i], g = p[i + 1], b = p[i + 2], a = p[i + 3];
    if (a < 8) continue;
    if (a > 200) { const x = (i / 4) % N, y = Math.floor(i / 4 / N); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    if (isBlue(r, g, b)) { const v = enc(lum(r, g, b) / BLUE_REF, 0.6); cloth[i] = cloth[i + 1] = cloth[i + 2] = v; cloth[i + 3] = a; }
    else if (isSkin(r, g, b)) { const v = enc(lum(r, g, b) / SKIN_REF, 0.25); skin[i] = skin[i + 1] = skin[i + 2] = v; skin[i + 3] = a; ns++; }
    else { fix[i] = r; fix[i + 1] = g; fix[i + 2] = b; fix[i + 3] = a; }
  }
  save(cloth, `top_${name}_t`);
  save(fix, `top_${name}_f`);
  save(skin, `top_${name}_s`);
  const k = OUT / N;
  console.log(name, 'bbox', [x0, y0, x1, y1].map((v) => Math.round(v * k)), 'piel', ns);
}

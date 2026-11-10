// Cabeza ilustrada: se arma por capas (piel teñida, rasgos, barba, pelo, accesorio) según el avatar
// y la expresión, y se guarda en caché. Devuelve null mientras alguna capa no cargó.
import { art, coreReady } from './art.ts';

export type Expr = 'n' | 'blink' | 'hurt' | 'aim';
export interface HeadSpec { skin: string; hairC: string; hair: number; face: number; acc: number; capC: string; band: [string, string] }

/** Tamaño de las capas y dónde está la cabeza dentro de ellas. */
export const HEAD_PX = 420;
export const HEAD_CX = 205.5;
export const HEAD_CY = 218;
export const HEAD_R = 140;

const HAIRS = ['buzz', 'short', 'long', 'bun', 'afro', 'mohawk', 'pigtail', 'bob', 'curls'];
// accesorio: imagen, centro x, centro y, ancho, giro
const ACCS: Record<number, [string, number, number, number, number]> = {
  1: ['cap', 238, 124, 318, -0.1],
  2: ['shades', 262, 236, 236, -0.06],
  4: ['hat', 210, 98, 400, -0.08],
  5: ['phones', 176, 178, 262, 0.02],
  6: ['helmet', 205, 150, 330, -0.04],
  8: ['crown', 208, 62, 210, -0.06],
};
const OL = '#1b1026';

const cache = new Map<string, HTMLCanvasElement>();
let tmp: HTMLCanvasElement | null = null;

function rgb(col: string): [number, number, number] {
  if (col[0] !== '#') {
    const m = col.match(/\d+(\.\d+)?/g);
    return m ? [Number(m[0]), Number(m[1]), Number(m[2])] : [0, 0, 0];
  }
  const n = parseInt(col.slice(1), 16);
  return [n >> 16, (n >> 8) & 255, n & 255];
}

/**
 * Dibuja una capa gris teñida con un color. El gris viene codificado: hasta 200 oscurece el color
 * (sombra) y de 200 a 255 lo lleva hacia el blanco (brillo), así los tonos claros no se lavan.
 */
function tintLayer(im: HTMLImageElement, color: string, w = HEAD_PX, h = HEAD_PX): HTMLCanvasElement {
  tmp ??= document.createElement('canvas');
  tmp.width = w;
  tmp.height = h;
  const t = tmp.getContext('2d', { willReadFrequently: true })!;
  t.clearRect(0, 0, w, h);
  t.drawImage(im, 0, 0, w, h);
  const img = t.getImageData(0, 0, w, h);
  const d = img.data;
  const [r, g, b] = rgb(color);
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const v = d[i];
    if (v <= 200) {
      const f = v / 200;
      d[i] = r * f; d[i + 1] = g * f; d[i + 2] = b * f;
    } else {
      const hl = ((v - 200) / 55) * 0.55;
      d[i] = r + (255 - r) * hl; d[i + 1] = g + (255 - g) * hl; d[i + 2] = b + (255 - b) * hl;
    }
  }
  t.putImageData(img, 0, 0);
  return tmp;
}
function tinted(c: CanvasRenderingContext2D, im: HTMLImageElement, color: string): void {
  c.drawImage(tintLayer(im, color), 0, 0);
}

export function headSprite(s: HeadSpec, expr: Expr): HTMLCanvasElement | null {
  const key = `${s.skin}|${s.hairC}|${s.hair}|${s.face}|${s.acc}|${s.capC}|${s.band[0]}${s.band[1]}|${expr}`;
  const hit = cache.get(key);
  if (hit) return hit;
  if (!coreReady()) return null;

  const base = expr === 'n' ? 'head' : 'head_' + expr;
  const skinL = art(base + '_s'), featL = art(base + '_f');
  const hairName = HAIRS[s.hair] ?? 'short';
  const hairL = art(`hair_${hairName}_t`);
  const hairX = hairName === 'pigtail' ? art('hair_pigtail_x') : null;
  const beard = s.face === 1 || s.face === 4 ? art('hair_beard_t') : s.face === 2 ? art('hair_mustache_t') : s.face === 5 ? art('hair_goatee_t') : null;
  const needBeard = s.face === 1 || s.face === 2 || s.face === 4 || s.face === 5;
  const A = ACCS[s.acc];
  const accIm = A ? art(A[0]) : null;
  if (!skinL || !featL || !hairL || (needBeard && !beard) || (A && !accIm) || (hairName === 'pigtail' && !hairX)) return null;

  const cv = document.createElement('canvas');
  cv.width = cv.height = HEAD_PX;
  const c = cv.getContext('2d')!;
  c.imageSmoothingQuality = 'high';
  tinted(c, skinL, s.skin);
  c.drawImage(featL, 0, 0, HEAD_PX, HEAD_PX);

  // maquillaje: sombra, pestañas y labios sobre los rasgos
  if ((s.face === 3 || s.face === 4) && expr !== 'hurt') {
    const eyes: [number, number, number][] = [[214, 244, 34], [318, 232, 24]];
    c.globalCompositeOperation = 'source-atop';
    c.fillStyle = 'rgba(190,80,255,.5)';
    for (const [ex, ey, w] of eyes) {
      c.beginPath();
      c.ellipse(ex, ey - 36, w, 13, -0.1, Math.PI, 0);
      c.fill();
    }
    c.globalCompositeOperation = 'source-over';
    c.strokeStyle = OL;
    c.lineWidth = 5;
    c.lineCap = 'round';
    c.beginPath();
    for (const [ex, ey, w] of eyes) {
      c.moveTo(ex - w, ey - 26);
      c.lineTo(ex - w - 13, ey - 37);
      c.moveTo(ex - w + 5, ey - 33);
      c.lineTo(ex - w - 4, ey - 47);
    }
    c.stroke();
    if (expr !== 'aim') {
      c.fillStyle = '#e11d48';
      c.strokeStyle = OL;
      c.lineWidth = 3.5;
      c.beginPath();
      c.ellipse(272, 301, 24, 10, -0.12, 0, 6.3);
      c.fill();
      c.stroke();
      c.strokeStyle = '#7a0f2a';
      c.lineWidth = 2.5;
      c.beginPath();
      c.moveTo(250, 303);
      c.quadraticCurveTo(272, 306, 294, 298);
      c.stroke();
    }
  }
  if (beard) tinted(c, beard, s.hairC);

  tinted(c, hairL, s.hairC);
  if (hairX) c.drawImage(hairX, 0, 0, HEAD_PX, HEAD_PX);

  // vincha con los colores del país: va sobre el pelo y sigue la silueta de la cabeza
  if (s.acc === 3) {
    c.globalCompositeOperation = 'source-atop';
    c.save();
    c.translate(HEAD_CX, HEAD_CY);
    c.rotate(-0.08);
    c.fillStyle = OL;
    c.fillRect(-170, -96, 340, 46);
    c.fillStyle = s.band[0];
    c.fillRect(-170, -90, 340, 34);
    c.fillStyle = s.band[1];
    c.fillRect(-40, -90, 96, 34);
    c.fillStyle = 'rgba(255,255,255,.25)';
    c.fillRect(-170, -90, 340, 8);
    c.restore();
    c.globalCompositeOperation = 'source-over';
  }


  if (s.acc === 7) {
    c.strokeStyle = OL;
    c.lineWidth = 11;
    c.beginPath();
    c.arc(100, 318, 15, 0, 6.3);
    c.stroke();
    c.strokeStyle = '#fbbf24';
    c.lineWidth = 6;
    c.stroke();
  }
  if (A && accIm) {
    const [, ax, ay, aw, rot] = A;
    const ah = (aw * accIm.naturalHeight) / accIm.naturalWidth;
    c.save();
    c.translate(ax, ay);
    c.rotate(rot);
    if (s.acc === 1) {
      const t2 = document.createElement('canvas');
      t2.width = accIm.naturalWidth;
      t2.height = accIm.naturalHeight;
      const k = t2.getContext('2d')!;
      k.drawImage(accIm, 0, 0);
      k.globalCompositeOperation = 'multiply';
      k.fillStyle = s.capC;
      k.fillRect(0, 0, t2.width, t2.height);
      k.globalCompositeOperation = 'destination-in';
      k.drawImage(accIm, 0, 0);
      c.drawImage(t2, -aw / 2, -ah / 2, aw, ah);
    } else c.drawImage(accIm, -aw / 2, -ah / 2, aw, ah);
    c.restore();
  }
  cache.set(key, cv);
  if (cache.size > 64) cache.delete(cache.keys().next().value!);
  return cv;
}

// ───────────── torso ilustrado ─────────────
export interface TorsoSpec { skin: string; top: number; topC: string; flag: [string, string] }
/** Dónde está el torso dentro de su capa: centro x, hombros y, cadera y, ancho. */
export const TORSO = { cx: 208, top: 132, bottom: 345, w: 146 };
const TOPS = ['tee', 'jersey', 'tank', 'hoodie', 'shirt', 'dress', 'suit', 'crop', 'vest'];
const torsoCache = new Map<string, HTMLCanvasElement>();

export function torsoSprite(s: TorsoSpec): HTMLCanvasElement | null {
  const jersey = s.top === 1;
  const key = `${s.skin}|${s.top}|${jersey ? s.flag.join('') : s.topC}`;
  const hit = torsoCache.get(key);
  if (hit) return hit;
  if (!coreReady()) return null;
  const name = TOPS[s.top] ?? 'tee';
  const sk = art(`top_${name}_s`), cl = art(`top_${name}_t`), fx = art(`top_${name}_f`);
  if (!sk || !cl || !fx) return null;
  const cv = document.createElement('canvas');
  cv.width = cv.height = HEAD_PX;
  const c = cv.getContext('2d')!;
  tinted(c, sk, s.skin);
  tinted(c, cl, jersey ? s.flag[0] : s.topC);
  if (jersey) {
    // camiseta de la selección: bastones con el segundo color de la bandera
    const t = tintLayer(cl, s.flag[1]);
    const k = t.getContext('2d')!;
    k.globalCompositeOperation = 'destination-out';
    for (let x = TORSO.cx - 96; x < TORSO.cx + 96; x += 38) k.fillRect(x, 0, 19, HEAD_PX);
    k.globalCompositeOperation = 'source-over';
    c.drawImage(t, 0, 0);
  }
  c.drawImage(fx, 0, 0, HEAD_PX, HEAD_PX);
  torsoCache.set(key, cv);
  if (torsoCache.size > 64) torsoCache.delete(torsoCache.keys().next().value!);
  return cv;
}

// ───────────── piezas sueltas: brazos, piernas, zapatilla, pollera ─────────────
const partCache = new Map<string, HTMLCanvasElement>();

/**
 * Pieza teñida. `cloth` es el color de la tela; `split` (0..1) deja tela solo en esa fracción de arriba
 * y el resto de la tela pasa a color piel (manga corta, o brazo desnudo con 0).
 */
export function partSprite(name: string, skin: string, cloth: string, split = 1): HTMLCanvasElement | null {
  const key = `${name}|${skin}|${cloth}|${split}`;
  const hit = partCache.get(key);
  if (hit) return hit;
  if (!coreReady()) return null;
  const sk = art(name + '_s'), cl = art(name + '_t'), fx = art(name + '_f');
  if (!sk || !cl || !fx) return null;
  const w = cl.naturalWidth, h = cl.naturalHeight;
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const c = cv.getContext('2d')!;
  c.drawImage(tintLayer(sk, skin, w, h), 0, 0);
  if (split >= 1) c.drawImage(tintLayer(cl, cloth, w, h), 0, 0);
  else {
    c.drawImage(tintLayer(cl, skin, w, h), 0, 0);
    if (split > 0) {
      const cut = Math.round(h * split);
      c.drawImage(tintLayer(cl, cloth, w, h), 0, 0, w, cut, 0, 0, w, cut);
      c.fillStyle = OL;
      c.globalCompositeOperation = 'source-atop';
      c.fillRect(0, cut - 3, w, 5);
      c.globalCompositeOperation = 'source-over';
    }
  }
  c.drawImage(fx, 0, 0, w, h);
  partCache.set(key, cv);
  if (partCache.size > 256) partCache.delete(partCache.keys().next().value!);
  return cv;
}

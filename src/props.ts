import type { Terrain } from './sim/terrain.ts';
import { art } from './art.ts';

// Decorado sobre el terreno (árboles, faroles, etc.). Son objetos aparte: cada uno está anclado
// a un punto del suelo y desaparece cuando un cráter se lleva ese punto. Solo visual.

export interface Prop { x: number; y: number; kind: string; flip: number; k: number; sway: number; phase: number }

type Ctx = CanvasRenderingContext2D;
const OL = '#1b1026';

const SETS: Record<string, string[]> = {
  baires: ['jacaranda', 'lamp', 'bush', 'tree', 'sign', 'jacaranda'],
  nyc: ['lamp', 'hydrant', 'tree', 'sign', 'lamp', 'bush'],
  paris: ['lamp', 'tree', 'bush', 'tree', 'sign'],
  london: ['phonebox', 'lamp', 'tree', 'bush', 'lamp'],
  tokyo: ['sakura', 'lamp', 'sakura', 'bush', 'sign'],
  rio: ['palm', 'palm', 'bush', 'tree', 'lamp'],
  sydney: ['palm', 'tree', 'bush', 'lamp', 'sign'],
  dubai: ['palm', 'cactus', 'lamp', 'palm'],
  cairo: ['palm', 'cactus', 'cactus', 'lamp'],
};

function fo(c: Ctx, fill: string, lw = 1.3): void {
  c.fillStyle = fill;
  c.fill();
  c.lineWidth = lw;
  c.strokeStyle = OL;
  c.lineJoin = 'round';
  c.stroke();
}

/** Copa hecha de círculos: primero todos en oscuro un poco más grandes (contorno común), después el relleno. */
function blobs(c: Ctx, pts: [number, number, number][], cols: [string, string, string]): void {
  c.fillStyle = OL;
  for (const [x, y, r] of pts) { c.beginPath(); c.arc(x, y, r + 1.4, 0, 6.3); c.fill(); }
  c.fillStyle = cols[0];
  for (const [x, y, r] of pts) { c.beginPath(); c.arc(x, y, r, 0, 6.3); c.fill(); }
  c.fillStyle = cols[1];
  for (const [x, y, r] of pts) { c.beginPath(); c.arc(x + r * 0.12, y - r * 0.16, r * 0.8, 0, 6.3); c.fill(); }
  c.fillStyle = cols[2];
  for (const [x, y, r] of pts) { c.beginPath(); c.arc(x + r * 0.3, y - r * 0.38, r * 0.42, 0, 6.3); c.fill(); }
}

function tree(c: Ctx, cols: [string, string, string]): void {
  c.beginPath();
  c.moveTo(-5, 2); c.quadraticCurveTo(-2.4, -18, -3.4, -40);
  c.lineTo(3, -40); c.quadraticCurveTo(2.6, -18, 5.6, 2);
  c.closePath();
  fo(c, '#6b4a34');
  c.fillStyle = 'rgba(20,6,30,.25)';
  c.fillRect(-3.6, -40, 2.6, 42);
  c.strokeStyle = OL;
  c.lineWidth = 3.4;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(0, -30); c.lineTo(11, -44);
  c.moveTo(-1, -26); c.lineTo(-11, -42);
  c.stroke();
  c.strokeStyle = '#6b4a34';
  c.lineWidth = 1.6;
  c.stroke();
  blobs(c, [[-14, -48, 12], [13, -50, 13], [0, -62, 15], [-8, -70, 10], [10, -68, 10], [0, -46, 12]], cols);
}

function palm(c: Ctx): void {
  c.beginPath();
  c.moveTo(-3.6, 2);
  c.quadraticCurveTo(2, -36, 12, -66);
  c.lineTo(17, -65);
  c.quadraticCurveTo(8, -34, 4.4, 2);
  c.closePath();
  fo(c, '#8a6a48');
  c.strokeStyle = 'rgba(20,6,30,.3)';
  c.lineWidth = 1;
  c.beginPath();
  for (let i = 1; i < 9; i++) { const k = i / 9; const x = k * k * 14, y = -k * 64; c.moveTo(x - 4 + k * 2, y); c.lineTo(x + 4 + k, y - 2); }
  c.stroke();
  const frond = (ang: number, len: number, col: string) => {
    c.save();
    c.translate(14.5, -66);
    c.rotate(ang);
    c.beginPath();
    c.moveTo(0, 0);
    c.quadraticCurveTo(len * 0.5, -len * 0.42, len, len * 0.12);
    c.quadraticCurveTo(len * 0.5, -len * 0.14, 0, 3);
    c.closePath();
    fo(c, col, 1.2);
    c.restore();
  };
  frond(Math.PI + 0.5, 30, '#1f7a3e');
  frond(-0.4, 30, '#1f7a3e');
  frond(Math.PI + 0.05, 34, '#2fa04c');
  frond(0.1, 34, '#2fa04c');
  frond(Math.PI - 0.5, 30, '#46c060');
  frond(0.65, 30, '#46c060');
  frond(-Math.PI / 2 - 0.5, 24, '#46c060');
  frond(-Math.PI / 2 + 0.4, 24, '#63d877');
  c.beginPath();
  c.arc(13, -62, 2.6, 0, 6.3);
  fo(c, '#7a4a22', 1);
  c.beginPath();
  c.arc(17, -61, 2.6, 0, 6.3);
  fo(c, '#7a4a22', 1);
}

function lamp(c: Ctx): void {
  c.beginPath();
  c.roundRect(-3.4, -5, 6.8, 7, 1.4);
  fo(c, '#2c2540');
  c.beginPath();
  c.roundRect(-1.5, -58, 3, 54, 1.2);
  fo(c, '#3a3252');
  c.strokeStyle = OL;
  c.lineWidth = 4.4;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(0, -57); c.quadraticCurveTo(1, -66, 12, -65);
  c.stroke();
  c.strokeStyle = '#3a3252';
  c.lineWidth = 2.2;
  c.stroke();
  c.beginPath();
  c.moveTo(7, -65); c.lineTo(19, -65); c.lineTo(16.5, -60.5); c.lineTo(9.5, -60.5);
  c.closePath();
  fo(c, '#2c2540');
  c.beginPath();
  c.roundRect(10, -60.6, 6, 3.2, 1.4);
  fo(c, '#fff3b0', 0.9);
}

function bush(c: Ctx): void {
  blobs(c, [[-9, -5, 7.5], [8, -5.5, 8], [0, -10, 9.5]], ['#1f6b34', '#39a83f', '#74d85a']);
  c.fillStyle = '#ff5d8f';
  for (const [x, y] of [[-6, -9], [4, -13], [9, -6]]) { c.beginPath(); c.arc(x, y, 1.5, 0, 6.3); c.fill(); }
}

function hydrant(c: Ctx): void {
  c.beginPath();
  c.roundRect(-6.4, -2.4, 12.8, 4, 1.2);
  fo(c, '#b91c1c');
  c.beginPath();
  c.roundRect(-9, -11, 18, 5, 2);
  fo(c, '#dc2626');
  c.beginPath();
  c.roundRect(-4.6, -17, 9.2, 16, 2);
  fo(c, '#ef4444');
  c.beginPath();
  c.arc(0, -17, 4.6, Math.PI, 0);
  c.closePath();
  fo(c, '#ef4444');
  c.fillStyle = 'rgba(255,255,255,.35)';
  c.fillRect(-3.2, -16, 1.8, 13);
}

function phonebox(c: Ctx): void {
  c.beginPath();
  c.roundRect(-9, -40, 18, 42, 1.6);
  fo(c, '#d81f2a');
  c.beginPath();
  c.moveTo(-10.5, -40); c.quadraticCurveTo(0, -48, 10.5, -40);
  c.closePath();
  fo(c, '#b3141e');
  c.fillStyle = '#ffe9a8';
  for (let j = 0; j < 4; j++) for (let i = 0; i < 3; i++) c.fillRect(-6.6 + i * 4.6, -35 + j * 7.6, 3.6, 6);
  c.fillStyle = 'rgba(20,6,30,.2)';
  c.fillRect(-9, -40, 3.2, 42);
}

function cactus(c: Ctx): void {
  const arm = (pts: number[]) => {
    c.beginPath();
    c.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.strokeStyle = OL;
    c.lineWidth = 9.6;
    c.stroke();
    c.strokeStyle = '#3f9a4a';
    c.lineWidth = 7;
    c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.22)';
    c.lineWidth = 1.6;
    c.stroke();
  };
  arm([-4, -16, -12, -16, -12, -27]);
  arm([4, -22, 13, -22, 13, -34]);
  arm([0, 0, 0, -40]);
  c.fillStyle = '#ff7ab0';
  c.beginPath();
  c.arc(0, -44.6, 2.4, 0, 6.3);
  c.fill();
}

function sign(c: Ctx): void {
  c.beginPath();
  c.roundRect(-1.3, -34, 2.6, 36, 1);
  fo(c, '#8b93a3');
  c.beginPath();
  c.moveTo(-13, -40); c.lineTo(11, -40); c.lineTo(17, -34); c.lineTo(11, -28); c.lineTo(-13, -28);
  c.closePath();
  fo(c, '#2563eb');
  c.fillStyle = '#fff';
  c.fillRect(-9, -35.6, 15, 1.4);
  c.fillRect(-9, -32.6, 10, 1.4);
}

const DRAW: Record<string, (c: Ctx) => void> = {
  tree: (c) => tree(c, ['#1f6b34', '#39a83f', '#74d85a']),
  jacaranda: (c) => tree(c, ['#6d3fb0', '#9a63dc', '#c9a2f5']),
  sakura: (c) => tree(c, ['#d9568f', '#ff8fc0', '#ffd0e6']),
  palm, lamp, bush, hydrant, phonebox, cactus, sign,
};
const SWAY: Record<string, number> = { tree: 1, jacaranda: 1, sakura: 1, palm: 1.4, bush: 0.5, cactus: 0.15 };

const SPR_W = 120, SPR_H = 110, SPR_S = 2;
// decorado ilustrado: alto en unidades del mundo y en qué fracción del ancho está la base del tronco
const BMP: Record<string, [number, number]> = {
  tree: [66, 0.47], jacaranda: [60, 0.43], sakura: [58, 0.48], palm: [78, 0.29], lamp: [66, 0.39],
  bush: [19, 0.5], hydrant: [16, 0.5], phonebox: [36, 0.545], cactus: [38, 0.46], sign: [34, 0.52],
};
const BMP_S = 4;
/** Pre-dibuja cada tipo en un sprite ya teñido con la luz ambiente de la ciudad. */
export function propSprites(city: string, ambient: string | null): Map<string, HTMLCanvasElement> {
  const out = new Map<string, HTMLCanvasElement>();
  for (const kind of new Set(SETS[city] ?? SETS.baires)) {
    const cv = document.createElement('canvas');
    const im = BMP[kind] ? art('p_' + kind) : null;
    if (im) {
      cv.width = SPR_W * BMP_S;
      cv.height = SPR_H * BMP_S;
      const c = cv.getContext('2d')!;
      c.scale(BMP_S, BMP_S);
      c.translate(SPR_W / 2, SPR_H - 14);
      const [h, bx] = BMP[kind];
      const w = (h * im.naturalWidth) / im.naturalHeight;
      c.imageSmoothingQuality = 'high';
      c.drawImage(im, -w * bx, -h + 1.5, w, h);
      if (ambient) {
        c.setTransform(1, 0, 0, 1, 0, 0);
        c.globalCompositeOperation = 'source-atop';
        c.fillStyle = ambient;
        c.fillRect(0, 0, cv.width, cv.height);
      }
      out.set(kind, cv);
      continue;
    }
    cv.width = SPR_W * SPR_S;
    cv.height = SPR_H * SPR_S;
    const c = cv.getContext('2d')!;
    c.scale(SPR_S, SPR_S);
    c.translate(SPR_W / 2, SPR_H - 14);
    DRAW[kind](c);
    if (ambient) {
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.globalCompositeOperation = 'source-atop';
      c.fillStyle = ambient;
      c.fillRect(0, 0, cv.width, cv.height);
      if (kind === 'lamp') {
        // la lámpara sigue encendida aunque el ambiente sea oscuro
        c.globalCompositeOperation = 'source-over';
        c.scale(SPR_S, SPR_S);
        c.translate(SPR_W / 2, SPR_H - 14);
        c.fillStyle = '#fff3b0';
        c.beginPath();
        c.roundRect(10, -60.6, 6, 3.2, 1.4);
        c.fill();
      }
    }
    out.set(kind, cv);
  }
  return out;
}

export function makeProps(t: Terrain, seed: number, city: string, waterY: number, avoid: number[]): Prop[] {
  let s = (seed % 2147483646) + 1;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const set = SETS[city] ?? SETS.baires;
  const out: Prop[] = [];
  let x = 150 + rnd() * 60;
  while (x < t.w - 150) {
    const y = t.surfaceY(x, 0);
    const yl = t.surfaceY(x - 9, 0), yr = t.surfaceY(x + 9, 0);
    const px = x;
    if (y > 60 && y < waterY - 40 && Math.abs(yl - y) < 9 && Math.abs(yr - y) < 9 && !avoid.some((ax) => Math.abs(ax - px) < 30)) {
      const kind = set[Math.floor(rnd() * set.length)];
      out.push({ x, y, kind, flip: rnd() < 0.5 ? -1 : 1, k: 0.85 + rnd() * 0.35, sway: SWAY[kind] ?? 0, phase: rnd() * 6.28 });
      x += 60 + rnd() * 90;
    } else x += 18 + rnd() * 20;
  }
  return out;
}

export function drawProp(c: Ctx, p: Prop, spr: HTMLCanvasElement, time: number, wind: number): void {
  c.save();
  c.translate(p.x, p.y + 1.5);
  if (p.sway) c.rotate((Math.sin(time * 1.3 + p.phase) * 0.018 + wind * 0.03) * p.sway);
  c.scale(p.flip * p.k, p.k);
  c.drawImage(spr, -SPR_W / 2, -(SPR_H - 14), SPR_W, SPR_H);
  c.restore();
}

/** Posición de la luz de un farol en el mundo (para el resplandor). */
export function lampLight(p: Prop): [number, number] {
  // el farol ilustrado tiene la linterna más afuera y más abajo que el dibujado por código
  if (art('p_lamp')) return [p.x + p.flip * 19.5 * p.k, p.y - 48 * p.k];
  return [p.x + p.flip * 13 * p.k, p.y - 58 * p.k];
}

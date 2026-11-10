import { Rng } from './rng.ts';

const COS: number[] = [];
const SIN: number[] = [];
for (let i = 0; i < 12; i++) {
  COS.push(Math.cos((i * Math.PI) / 6));
  SIN.push(Math.sin((i * Math.PI) / 6));
}

/** Terreno destructible: máscara de solidez por píxel. Sin DOM. */
export class Terrain {
  w: number;
  h: number;
  mask: Uint8Array;

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.mask = new Uint8Array(w * h);
  }

  solid(x: number, y: number): boolean {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return false;
    return this.mask[y * this.w + x] === 1;
  }

  circleHits(cx: number, cy: number, r: number): boolean {
    if (this.solid(cx, cy)) return true;
    for (let i = 0; i < 12; i++) {
      if (this.solid(cx + COS[i] * r, cy + SIN[i] * r)) return true;
    }
    return false;
  }

  carve(cx: number, cy: number, r: number): void {
    const x0 = Math.max(0, Math.floor(cx - r));
    const x1 = Math.min(this.w - 1, Math.ceil(cx + r));
    const y0 = Math.max(0, Math.floor(cy - r));
    const y1 = Math.min(this.h - 1, Math.ceil(cy + r));
    const r2 = r * r;
    for (let y = y0; y <= y1; y++) {
      const dy = y - cy;
      for (let x = x0; x <= x1; x++) {
        const dx = x - cx;
        if (dx * dx + dy * dy <= r2) this.mask[y * this.w + x] = 0;
      }
    }
  }

  /** Normal aproximada de la superficie (apunta hacia el aire). [0,0] si no hay nada cerca. */
  normal(x: number, y: number, rad: number): [number, number] {
    let sx = 0;
    let sy = 0;
    for (let dy = -rad; dy <= rad; dy += 2) {
      for (let dx = -rad; dx <= rad; dx += 2) {
        if (dx * dx + dy * dy > rad * rad) continue;
        if (this.solid(x + dx, y + dy)) {
          sx -= dx;
          sy -= dy;
        }
      }
    }
    const l = Math.hypot(sx, sy);
    if (l < 0.001) return [0, 0];
    return [sx / l, sy / l];
  }

  /** Primer píxel sólido bajando desde `from`. -1 si no hay. */
  surfaceY(x: number, from: number): number {
    x = Math.floor(x);
    if (x < 0 || x >= this.w) return -1;
    for (let y = Math.max(0, Math.floor(from)); y < this.h; y++) {
      if (this.mask[y * this.w + x] === 1) return y;
    }
    return -1;
  }
}

export function generateTerrain(w: number, h: number, rng: Rng): Terrain {
  const t = new Terrain(w, h);
  const ph = [rng.range(0, 6.28), rng.range(0, 6.28), rng.range(0, 6.28), rng.range(0, 6.28)];
  const base = h * rng.range(0.52, 0.62);
  const a1 = rng.range(70, 130);
  const heights = new Float32Array(w);
  for (let x = 0; x < w; x++) {
    let y =
      base +
      a1 * Math.sin((x / 900) * 6.283 + ph[0]) +
      55 * Math.sin((x / 380) * 6.283 + ph[1]) +
      22 * Math.sin((x / 150) * 6.283 + ph[2]) +
      7 * Math.sin((x / 55) * 6.283 + ph[3]);
    const e = Math.min(x, w - x);
    if (e < 260) y += (1 - e / 260) ** 2 * 520;
    heights[x] = Math.max(190, y);
  }
  for (let x = 0; x < w; x++) {
    const top = Math.floor(heights[x]);
    for (let y = top; y < h; y++) t.mask[y * w + x] = 1;
  }
  // Plataformas flotantes
  const islands = rng.int(4, 6);
  for (let i = 0; i < islands; i++) {
    const cx = rng.range(350, w - 350);
    const rx = rng.range(70, 150);
    const ry = rng.range(16, 28);
    const cy = Math.max(140, heights[Math.floor(cx)] - rng.range(150, 260));
    const wob = rng.range(0, 6.28);
    for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      if (x < 0 || x >= w) continue;
      const nx = (x - cx) / rx;
      const half = ry * Math.sqrt(Math.max(0, 1 - nx * nx));
      const off = 4 * Math.sin(x / 23 + wob);
      for (let y = Math.floor(cy - half * 0.6 + off); y <= cy + half * 1.2 + off; y++) {
        if (y >= 0 && y < h && y < heights[x] - 50) t.mask[y * w + x] = 1;
      }
    }
  }
  // Cuevas
  const caves = rng.int(3, 5);
  for (let i = 0; i < caves; i++) {
    let cx = rng.range(350, w - 350);
    let cy = heights[Math.floor(cx)] + rng.range(70, 150);
    let ang = rng.range(-0.4, 0.4) + (rng.next() < 0.5 ? 0 : Math.PI);
    const steps = rng.int(8, 16);
    for (let s = 0; s < steps; s++) {
      t.carve(cx, cy, rng.range(20, 34));
      ang += rng.range(-0.5, 0.5);
      cx += Math.cos(ang) * 22;
      cy += Math.sin(ang) * 10;
      cy = Math.min(cy, h - 130);
    }
  }
  return t;
}

import type { Terrain } from './sim/terrain.ts';

const OUTLINE = '#1b1026';

/** Aspecto del terreno según la ciudad: materiales, pasto, luz ambiente y de dónde viene la luz. */
export interface TerrainLook {
  layers: [string, string, string, string]; // costra, suelo, subsuelo, roca
  grass: [string, string, string, string]; // sombra, medio, claro, punta
  rock: [string, string];
  flowers: string[];
  tuft: number; // densidad de briznas
  ambient: string | null;
  rim: string;
  light: [number, number]; // dirección hacia la luz
}

const BASE: TerrainLook = {
  layers: ['#3f241f', '#9a5f3e', '#774433', '#47293a'],
  grass: ['#1f6b34', '#39a83f', '#62cf48', '#c9f58a'],
  rock: ['#b3a79a', '#665a5c'],
  flowers: ['#fff7d6', '#ffd1e8', '#ffe066', '#c9b6ff'],
  tuft: 0.22,
  ambient: 'rgba(90,40,120,.14)',
  rim: '#ffc59a',
  light: [0.7, -0.7],
};
const SAND: Partial<TerrainLook> = {
  layers: ['#8f5f34', '#e0ad68', '#c58a4c', '#855640'],
  grass: ['#7c6c30', '#a8953f', '#cdb95c', '#f1e4a2'],
  rock: ['#e6cfa6', '#9a7a5c'],
  flowers: ['#fff3c4', '#ffb86b'],
  tuft: 0.1,
};

export const LOOKS: Record<string, TerrainLook> = {
  baires: BASE,
  nyc: { ...BASE, ambient: 'rgba(14,28,104,.44)', rim: '#a9c2ff', light: [-0.7, -0.7], flowers: ['#dbe7ff', '#b8c8ff'] },
  paris: { ...BASE, ambient: 'rgba(255,140,80,.12)', rim: '#ffe2aa' },
  london: { ...BASE, layers: ['#33262a', '#7d6257', '#62504c', '#3c3340'], grass: ['#1f5a3a', '#3a8a4a', '#5aac58', '#b4dc92'], ambient: 'rgba(50,86,110,.26)', rim: '#e3ecec', flowers: ['#ffffff', '#ffe066'] },
  tokyo: { ...BASE, ambient: 'rgba(74,8,116,.4)', rim: '#ff94d4', light: [-0.7, -0.7], flowers: ['#ffb7dd', '#ff7ac4', '#ffe1f1'] },
  rio: { ...BASE, layers: ['#4c2116', '#b55a32', '#8c3f29', '#4f2830'], grass: ['#0f6a3a', '#1faa4a', '#46d45a', '#c2f98a'], ambient: 'rgba(0,80,96,.1)', rim: '#ffe6a6', tuft: 0.34, flowers: ['#ff5d8f', '#ffd23f', '#ff8a2b', '#ffffff'] },
  sydney: { ...BASE, layers: ['#52301d', '#c27d47', '#a05c36', '#684040'], ambient: null, rim: '#ffffff', flowers: ['#ffffff', '#ffe066', '#ff9bb3'] },
  dubai: { ...BASE, ...SAND, ambient: 'rgba(255,110,60,.1)', rim: '#ffe3ae' },
  cairo: { ...BASE, ...SAND, ambient: 'rgba(255,110,70,.12)', rim: '#ffe3ae' },
};

function mkCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  return [cv, cv.getContext('2d')!];
}
function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hex(c: string): [number, number, number] {
  const n = parseInt(c.slice(1), 16);
  return [n >> 16, (n >> 8) & 255, n & 255];
}

/** Textura de detalle neutra (solo aclara u oscurece), repetible: ruido periódico en octavas. */
function detailTile(rnd: () => number, size: number): HTMLCanvasElement {
  const [cv, c] = mkCanvas(size, size);
  const img = c.createImageData(size, size);
  const octs = [4, 8, 16, 32, 64].map((n) => {
    const g = new Float32Array(n * n);
    for (let i = 0; i < g.length; i++) g[i] = rnd();
    return { n, g };
  });
  const sample = (o: { n: number; g: Float32Array }, x: number, y: number) => {
    const fx = (x / size) * o.n, fy = (y / size) * o.n;
    const x0 = Math.floor(fx), y0 = Math.floor(fy);
    let tx = fx - x0, ty = fy - y0;
    tx = tx * tx * (3 - 2 * tx);
    ty = ty * ty * (3 - 2 * ty);
    const x1 = (x0 + 1) % o.n, y1 = (y0 + 1) % o.n;
    const a = o.g[y0 * o.n + x0], b = o.g[y0 * o.n + x1], d = o.g[y1 * o.n + x0], e = o.g[y1 * o.n + x1];
    return a + (b - a) * tx + (d - a) * ty + (a - b - d + e) * tx * ty;
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const v = sample(octs[0], x, y) * 0.3 + sample(octs[1], x, y) * 0.26 + sample(octs[2], x, y) * 0.2 + sample(octs[3], x, y) * 0.14 + sample(octs[4], x, y) * 0.1 + (rnd() - 0.5) * 0.1;
      const i = (y * size + x) * 4;
      const light = v > 0.5;
      img.data[i] = light ? 255 : 26;
      img.data[i + 1] = light ? 236 : 8;
      img.data[i + 2] = light ? 205 : 32;
      img.data[i + 3] = Math.min(255, Math.abs(v - 0.5) * (light ? 300 : 420));
    }
  }
  c.putImageData(img, 0, 0);
  for (let i = 0; i < 90; i++) {
    const x = rnd() * size, y = rnd() * size, r = 1 + rnd() * 2.4;
    c.fillStyle = 'rgba(26,8,32,.4)';
    c.beginPath();
    c.ellipse(x, y + r * 0.45, r, r * 0.8, 0, 0, 6.3);
    c.fill();
    c.fillStyle = 'rgba(255,240,215,.5)';
    c.beginPath();
    c.ellipse(x, y, r, r * 0.8, rnd() * 3, 0, 6.3);
    c.fill();
  }
  return cv;
}

/**
 * Arte del terreno: toma la máscara de colisión y la pinta por capas de material según la
 * distancia a la superficie, con luz direccional, pasto y contorno. Se dibuja una vez;
 * después solo se le recortan los cráteres.
 */
export class TerrainArt {
  cv: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  s: number;
  w: number;
  h: number;
  look: TerrainLook;

  constructor(t: Terrain, seed: number, scale: number, look: TerrainLook) {
    const rnd = rng(seed ^ 0x9e3779b9);
    const { w, h } = t;
    const s = (this.s = scale);
    this.w = w;
    this.h = h;
    this.look = look;
    const W = w * s, H = h * s;
    const m = t.mask;

    // 1) máscara suavizada (caja 3x3) → alfa
    const [a1, a1c] = mkCanvas(w, h);
    const img = a1c.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let sum = 0;
        for (let dy = -1; dy <= 1; dy++) {
          const yy = y + dy;
          if (yy < 0) continue;
          const row = (yy >= h ? h - 1 : yy) * w;
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx;
            if (xx >= 0 && xx < w) sum += m[row + xx];
          }
        }
        img.data[(y * w + x) * 4 + 3] = (sum * 255) / 9;
      }
    }
    a1c.putImageData(img, 0, 0);

    // 2) escalar con interpolación y endurecer el borde → contorno liso y nítido
    const [cv, c] = mkCanvas(W, H);
    this.cv = cv;
    this.ctx = c;
    c.imageSmoothingEnabled = true;
    c.imageSmoothingQuality = 'high';
    c.drawImage(a1, 0, 0, W, H);
    const BAND = 500;
    for (let y0 = 0; y0 < H; y0 += BAND) {
      const bh = Math.min(BAND, H - y0);
      const d = c.getImageData(0, y0, W, bh);
      const px = d.data;
      for (let i = 3; i < px.length; i += 4) {
        const v = (px[i] - 100) * 4.6;
        px[i] = v < 0 ? 0 : v > 255 ? 255 : v;
      }
      c.putImageData(d, 0, y0);
    }
    const [shape, shapeC] = mkCanvas(W, H); // copia de la silueta para luces y contorno
    shapeC.drawImage(cv, 0, 0);

    // 3) capas de material según distancia a la superficie (transformada de distancia en baja resolución)
    const Q = 4;
    const gw = Math.ceil(w / Q), gh = Math.ceil(h / Q);
    const dist = new Float32Array(gw * gh);
    for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) dist[gy * gw + gx] = t.solid(gx * Q + 2, gy * Q + 2) ? 1e6 : 0;
    const at = (x: number, y: number) => (x < 0 || x >= gw || y < 0 ? 0 : y >= gh ? 1e6 : dist[y * gw + x]);
    for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
      const i = y * gw + x;
      if (!dist[i]) continue;
      dist[i] = Math.min(dist[i], at(x - 1, y) + 1, at(x, y - 1) + 1, at(x - 1, y - 1) + 1.41, at(x + 1, y - 1) + 1.41);
    }
    for (let y = gh - 1; y >= 0; y--) for (let x = gw - 1; x >= 0; x--) {
      const i = y * gw + x;
      if (!dist[i]) continue;
      dist[i] = Math.min(dist[i], at(x + 1, y) + 1, at(x, y + 1) + 1, at(x + 1, y + 1) + 1.41, at(x - 1, y + 1) + 1.41);
    }
    const L = look.layers.map(hex);
    const [low, lowC] = mkCanvas(gw, gh);
    const li = lowC.createImageData(gw, gh);
    const ph = [rnd() * 6.28, rnd() * 6.28, rnd() * 6.28];
    const mix = (a: number[], b: number[], k: number, o: number) => a[o] + (b[o] - a[o]) * k;
    const st = (e0: number, e1: number, v: number) => { const k = Math.max(0, Math.min(1, (v - e0) / (e1 - e0))); return k * k * (3 - 2 * k); };
    for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
      const wob = Math.sin(x / 13 + ph[0]) * 9 + Math.sin(x / 5.3 + y / 9 + ph[1]) * 4;
      const d = dist[y * gw + x] * Q + wob;
      const band = Math.sin(d / 9 + Math.sin(x / 21 + ph[2]) * 1.6) * 0.5 + 0.5; // vetas finas
      const k1 = st(7, 15, d), k2 = st(46, 74, d), k3 = st(130, 190, d);
      const i = (y * gw + x) * 4;
      for (let o = 0; o < 3; o++) {
        let v = mix(L[0], L[1], k1, o);
        v = v + (L[2][o] - v) * k2;
        v = v + (L[3][o] - v) * k3;
        li.data[i + o] = v * (0.93 + band * 0.1);
      }
      li.data[i + 3] = 255;
    }
    lowC.putImageData(li, 0, 0);
    c.globalCompositeOperation = 'source-in';
    c.drawImage(low, 0, 0, W, H);

    // 4) detalle fino encima
    c.globalCompositeOperation = 'source-atop';
    c.fillStyle = c.createPattern(detailTile(rnd, 256), 'repeat')!;
    c.globalAlpha = 0.55;
    c.fillRect(0, 0, W, H);
    c.globalAlpha = 1;

    c.save();
    c.scale(s, s);

    // rocas enterradas: sin sombra proyectada, con el borde inferior fundido en la tierra
    const R0 = hex(look.rock[0]), R1 = hex(look.rock[1]);
    for (let i = 0; i < 150; i++) {
      const x = rnd() * w, y = 170 + rnd() * (h - 170);
      if (dist[Math.min(gh - 1, Math.floor(y / Q)) * gw + Math.min(gw - 1, Math.floor(x / Q))] * Q < 12) continue;
      const r = 5 + rnd() * rnd() * 24;
      const n = 7 + Math.floor(rnd() * 4);
      const rot = rnd() * 6.28;
      c.beginPath();
      for (let k = 0; k < n; k++) {
        const a = rot + (k / n) * 6.283;
        const rr = r * (0.74 + rnd() * 0.36);
        const px = x + Math.cos(a) * rr * 1.25, py = y + Math.sin(a) * rr * 0.82;
        if (k) c.lineTo(px, py);
        else c.moveTo(px, py);
      }
      c.closePath();
      const g = c.createLinearGradient(x, y - r, x, y + r * 0.9);
      g.addColorStop(0, `rgba(${R0[0]},${R0[1]},${R0[2]},.95)`);
      g.addColorStop(0.55, `rgba(${R1[0]},${R1[1]},${R1[2]},.9)`);
      g.addColorStop(1, `rgba(${R1[0]},${R1[1]},${R1[2]},0)`);
      c.fillStyle = g;
      c.fill();
      c.strokeStyle = 'rgba(27,16,38,.3)';
      c.lineWidth = 1;
      c.stroke();
      c.strokeStyle = 'rgba(255,255,255,.3)';
      c.lineWidth = 1.3;
      c.beginPath();
      c.arc(x, y, r * 0.62, Math.PI * 1.15, Math.PI * 1.65);
      c.stroke();
    }

    // 5) oclusión ambiental cerca de los bordes
    const ao = (div: number, alpha: number) => {
      const [sm, smc] = mkCanvas(Math.ceil(w / div), Math.ceil(h / div));
      smc.fillStyle = '#12051c';
      smc.fillRect(0, 0, sm.width, sm.height);
      smc.globalCompositeOperation = 'destination-out';
      smc.drawImage(a1, 0, 0, sm.width, sm.height);
      c.globalAlpha = alpha;
      c.drawImage(sm, 0, 0, w, h);
      c.globalAlpha = 1;
    };
    ao(5, 0.42);
    c.restore();

    // 6) luz direccional: filo claro del lado de la luz, sombra del lado opuesto
    const edge = (dx: number, dy: number, color: string, alpha: number) => {
      const [e, ec] = mkCanvas(W, H);
      ec.drawImage(shape, 0, 0);
      ec.globalCompositeOperation = 'source-in';
      ec.fillStyle = color;
      ec.fillRect(0, 0, W, H);
      ec.globalCompositeOperation = 'destination-out';
      ec.drawImage(shape, dx, dy);
      c.globalAlpha = alpha;
      c.drawImage(e, 0, 0);
      c.globalAlpha = 1;
      e.width = e.height = 0;
    };
    const [lx, ly] = look.light;
    edge(-lx * 3.2 * s, -ly * 3.2 * s, look.rim, 0.5);
    edge(lx * 5 * s, ly * 5 * s, '#12051c', 0.42);

    c.save();
    c.scale(s, s);

    // 7) pasto: una banda continua que sigue la superficie (sin escalones)
    const tops: number[][] = [];
    for (let x = 0; x < w; x++) {
      const col: number[] = [];
      let air = 6;
      for (let y = 0; y < h; y++) {
        if (m[y * w + x]) {
          if (air >= 5) col.push(y);
          air = 0;
        } else air++;
      }
      tops.push(col);
    }
    const smooth = (x: number, y: number): number => {
      let sum = y, n = 1;
      for (let d = -3; d <= 3; d++) {
        if (!d) continue;
        const col = tops[x + d];
        if (!col) continue;
        for (const yy of col) if (Math.abs(yy - y) < 4 + Math.abs(d) * 2.5) { sum += yy; n++; break; }
      }
      return sum / n;
    };
    const tufts: [number, number][] = [];
    const p1 = rnd() * 6.28;
    const thick = (x: number) => 9.5 + Math.sin(x * 0.21 + p1) * 2.6 + Math.sin(x * 0.63) * 1.7;
    const bands: [string, number, number][] = [
      [look.grass[0], -1.8, 1e3], // sombra (espesor completo + 2.4)
      [look.grass[1], -1.8, 0],
      [look.grass[2], -1.8, -3.6],
      [look.grass[3], -1.8, -1e3], // punta: 1.7 px
    ];
    for (let x = 0; x < w - 1; x++) {
      for (const y of tops[x]) {
        const next = tops[x + 1].find((yy) => Math.abs(yy - y) < 7);
        const ya = smooth(x, y);
        const yb = next === undefined ? ya : smooth(x + 1, next);
        const ta = thick(x), tb = thick(x + 1);
        for (const [col, top, off] of bands) {
          const ba = off === 1e3 ? ta + 2.4 : off === -1e3 ? 1.7 + top * -1 - 1.8 : ta + off;
          const bb = off === 1e3 ? tb + 2.4 : off === -1e3 ? 1.7 + top * -1 - 1.8 : tb + off;
          c.fillStyle = col;
          c.beginPath();
          c.moveTo(x - 0.05, ya + top);
          c.lineTo(x + 1.05, yb + top);
          c.lineTo(x + 1.05, yb + top + bb);
          c.lineTo(x - 0.05, ya + top + ba);
          c.fill();
        }
        if (rnd() < look.tuft) tufts.push([x, ya]);
      }
    }
    // briznas y flores (sobresalen del borde)
    c.globalCompositeOperation = 'source-over';
    for (const [x, y] of tufts) {
      const n = 1 + Math.floor(rnd() * 3);
      for (let k = 0; k < n; k++) {
        const bx = x + (rnd() - 0.5) * 5;
        const lean = (rnd() - 0.5) * 6;
        const hgt = 4 + rnd() * 6.5;
        c.fillStyle = rnd() < 0.5 ? look.grass[2] : look.grass[1];
        c.beginPath();
        c.moveTo(bx - 1.3, y + 1.5);
        c.quadraticCurveTo(bx - 0.4 + lean * 0.3, y - hgt * 0.5, bx + lean, y - hgt);
        c.quadraticCurveTo(bx + 0.8 + lean * 0.3, y - hgt * 0.5, bx + 1.3, y + 1.5);
        c.fill();
      }
      if (rnd() < 0.09 && look.flowers.length) {
        const fx = x + (rnd() - 0.5) * 3, fy = y - 6 - rnd() * 3;
        c.strokeStyle = look.grass[1];
        c.lineWidth = 0.8;
        c.beginPath();
        c.moveTo(fx, y + 1);
        c.lineTo(fx, fy);
        c.stroke();
        c.fillStyle = look.flowers[Math.floor(rnd() * look.flowers.length)];
        c.beginPath();
        c.arc(fx, fy, 1.9, 0, 6.3);
        c.fill();
        c.fillStyle = '#f59e0b';
        c.beginPath();
        c.arc(fx, fy, 0.7, 0, 6.3);
        c.fill();
      }
    }
    c.restore();

    // 8) luz ambiente de la ciudad sobre todo el terreno
    if (look.ambient) {
      c.globalCompositeOperation = 'source-atop';
      c.fillStyle = look.ambient;
      c.fillRect(0, 0, W, H);
    }

    // 9) contorno oscuro alrededor de toda la silueta
    shapeC.globalCompositeOperation = 'copy';
    shapeC.drawImage(cv, 0, 0);
    shapeC.globalCompositeOperation = 'source-in';
    shapeC.fillStyle = OUTLINE;
    shapeC.fillRect(0, 0, W, H);
    c.globalCompositeOperation = 'destination-over';
    const o = 1.5 * s;
    for (let k = 0; k < 8; k++) c.drawImage(shape, Math.cos((k * Math.PI) / 4) * o, Math.sin((k * Math.PI) / 4) * o);
    c.globalCompositeOperation = 'source-over';
    shape.width = shape.height = 0;
  }

  /** Recorta un cráter: borde quemado + agujero + contorno. */
  carve(x: number, y: number, r: number): void {
    const c = this.ctx;
    c.save();
    c.scale(this.s, this.s);
    c.globalCompositeOperation = 'source-atop';
    const burn = Math.min(22, 6 + r * 0.32);
    const g = c.createRadialGradient(x, y, r, x, y, r + burn);
    g.addColorStop(0, 'rgba(14,6,10,.88)');
    g.addColorStop(0.45, 'rgba(40,16,12,.5)');
    g.addColorStop(1, 'rgba(40,16,12,0)');
    c.fillStyle = g;
    c.beginPath();
    c.arc(x, y, r + burn, 0, 6.3);
    c.fill();
    c.globalCompositeOperation = 'destination-out';
    c.beginPath();
    c.arc(x, y, r, 0, 6.3);
    c.fill();
    c.globalCompositeOperation = 'source-atop';
    c.strokeStyle = OUTLINE;
    c.lineWidth = 2.2;
    c.beginPath();
    c.arc(x, y, r + 1, 0, 6.3);
    c.stroke();
    c.restore();
  }
}

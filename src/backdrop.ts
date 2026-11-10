// Fondos: cada ciudad tiene su paleta de cielo y sus siluetas. Todo se pre-dibuja una vez
// en tiras anchas y después solo se desplaza en parallax.

export interface Backdrop {
  id: string;
  sky: [number, string][];
  sun: { top: string; bottom: string; glow: string; moon: boolean };
  haze: string; // "r,g,b"
  ground: string;
  stars: number;
  layers: { cv: HTMLCanvasElement; par: number; scale: number }[];
  clouds: HTMLCanvasElement[];
}

type Ctx = CanvasRenderingContext2D;
type Mark = (c: Ctx, col: string, lit: string) => void;

interface CityDef {
  sky: [number, string][];
  sun: Backdrop['sun'];
  haze: string;
  ground: string;
  stars: number;
  hills: [string, string];
  far: [string, string];
  mark: [string, string]; // gradiente de los monumentos
  near: [string, string];
  win: string;
  cloud: [string, string, string];
  marks: [Mark, number, number, boolean?][]; // dibujo, x (0..1 de la tira), escala, ¿delante de los edificios?
  hillMarks?: [Mark, number, number][];
}

export const CITY_IDS = ['baires', 'nyc', 'paris', 'london', 'tokyo', 'rio', 'sydney', 'dubai', 'cairo'];

function mk(w: number, h: number): [HTMLCanvasElement, Ctx] {
  const cv = document.createElement('canvas');
  cv.width = Math.max(1, Math.floor(w));
  cv.height = Math.max(1, Math.floor(h));
  return [cv, cv.getContext('2d')!];
}
function lcg(seed: number): () => number {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}
const poly = (c: Ctx, pts: number[]) => {
  c.beginPath();
  c.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
  c.closePath();
  c.fill();
};

// ───────────── monumentos (origen en la base, y negativo hacia arriba) ─────────────
const obelisco: Mark = (c, col, lit) => {
  c.fillStyle = col;
  poly(c, [-13, 0, -9, -290, 0, -322, 9, -290, 13, 0]);
  c.fillStyle = lit;
  c.fillRect(-2, -270, 4, 6);
  c.fillStyle = 'rgba(255,255,255,.14)';
  poly(c, [0, 0, 0, -322, 9, -290, 13, 0]);
};
const congreso: Mark = (c, col, lit) => {
  c.fillStyle = col;
  c.fillRect(-90, -70, 180, 70);
  c.fillRect(-36, -120, 72, 50);
  poly(c, [-100, -70, 0, -96, 100, -70]);
  c.beginPath();
  c.ellipse(0, -120, 30, 62, 0, Math.PI, 0);
  c.fill();
  c.fillRect(-3, -215, 6, 40);
  c.fillStyle = lit;
  for (let i = -3; i <= 3; i++) c.fillRect(i * 22 - 3, -52, 6, 34);
};
const empire: Mark = (c, col, lit) => {
  c.fillStyle = col;
  c.fillRect(-46, -170, 92, 170);
  c.fillRect(-34, -300, 68, 130);
  c.fillRect(-22, -372, 44, 72);
  c.fillRect(-12, -404, 24, 32);
  poly(c, [-6, -404, 0, -470, 6, -404]);
  c.fillStyle = lit;
  for (let y = -360; y < -20; y += 16) for (let x = -18; x <= 14; x += 10) if ((x * 7 + y * 3) % 5 !== 0) c.fillRect(x, y, 4, 8);
  c.fillRect(-12, -404, 24, 5);
};
const chrysler: Mark = (c, col, lit) => {
  c.fillStyle = col;
  c.fillRect(-30, -250, 60, 250);
  for (let i = 0; i < 6; i++) {
    c.beginPath();
    c.ellipse(0, -250 - i * 15, 26 - i * 4, 22, 0, Math.PI, 0);
    c.fill();
  }
  poly(c, [-3, -330, 0, -410, 3, -330]);
  c.fillStyle = lit;
  for (let i = 0; i < 5; i++) c.fillRect(-2, -262 - i * 15, 4, 5);
  for (let y = -230; y < -20; y += 18) for (let x = -22; x <= 18; x += 10) if ((x + y) % 3) c.fillRect(x, y, 4, 9);
};
const liberty: Mark = (c, col, lit) => {
  c.fillStyle = col;
  poly(c, [-34, 0, -26, -70, 26, -70, 34, 0]);
  c.fillRect(-18, -92, 36, 22);
  c.fillStyle = '#5fb8a4';
  poly(c, [-14, -92, -10, -170, 12, -170, 16, -92]);
  c.beginPath();
  c.arc(1, -182, 10, 0, 6.3);
  c.fill();
  for (let i = -2; i <= 2; i++) poly(c, [i * 4 - 1.5, -190, i * 7, -206, i * 4 + 2.5, -190]);
  poly(c, [8, -166, 20, -226, 27, -224, 15, -160]);
  c.fillStyle = lit;
  c.beginPath();
  c.arc(24, -234, 6, 0, 6.3);
  c.fill();
};
const eiffel: Mark = (c, col, lit) => {
  c.fillStyle = col;
  c.beginPath();
  c.moveTo(-88, 0);
  c.quadraticCurveTo(-30, -120, -9, -330);
  c.lineTo(-3, -430);
  c.lineTo(3, -430);
  c.lineTo(9, -330);
  c.quadraticCurveTo(30, -120, 88, 0);
  c.lineTo(58, 0);
  c.quadraticCurveTo(0, -150, -58, 0);
  c.closePath();
  c.fill();
  c.fillRect(-52, -108, 104, 12);
  c.fillRect(-28, -206, 56, 9);
  c.fillRect(-1.5, -470, 3, 42);
  c.strokeStyle = 'rgba(0,0,0,.22)';
  c.lineWidth = 2;
  for (let y = -90; y > -400; y -= 22) {
    const w = 60 * Math.pow((430 + y) / 430, 1.6) + 5;
    c.beginPath();
    c.moveTo(-w, y); c.lineTo(w, y - 11); c.moveTo(w, y); c.lineTo(-w, y - 11);
    c.stroke();
  }
  c.fillStyle = lit;
  c.fillRect(-52, -104, 104, 3);
  c.fillRect(-28, -203, 56, 2.5);
  c.fillRect(-2, -474, 4, 5);
};
const arco: Mark = (c, col, lit) => {
  c.fillStyle = col;
  c.fillRect(-58, -112, 116, 112);
  c.fillRect(-64, -122, 128, 12);
  c.globalCompositeOperation = 'destination-out';
  c.beginPath();
  c.moveTo(-24, 0); c.lineTo(-24, -50); c.arc(0, -50, 24, Math.PI, 0); c.lineTo(24, 0);
  c.fill();
  c.globalCompositeOperation = 'source-over';
  c.fillStyle = lit;
  c.fillRect(-58, -96, 116, 3);
};
const bigben: Mark = (c, col, lit) => {
  c.fillStyle = col;
  c.fillRect(-150, -84, 130, 84);
  for (let i = 0; i < 7; i++) poly(c, [-150 + i * 19, -84, -144 + i * 19, -104, -138 + i * 19, -84]);
  c.fillRect(-24, -250, 48, 250);
  c.fillRect(-29, -300, 58, 52);
  poly(c, [-29, -300, 0, -372, 29, -300]);
  c.fillRect(-1.5, -392, 3, 24);
  c.fillStyle = lit;
  c.beginPath();
  c.arc(0, -274, 17, 0, 6.3);
  c.fill();
  c.strokeStyle = col;
  c.lineWidth = 2.5;
  c.beginPath();
  c.moveTo(0, -274); c.lineTo(0, -287); c.moveTo(0, -274); c.lineTo(8, -270);
  c.stroke();
  c.fillStyle = lit;
  for (let i = 0; i < 6; i++) c.fillRect(-140 + i * 20, -60, 6, 26);
};
const eye: Mark = (c, col, lit) => {
  c.strokeStyle = col;
  c.lineWidth = 7;
  c.beginPath();
  c.arc(0, -150, 132, 0, 6.3);
  c.stroke();
  c.lineWidth = 1.6;
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * 6.283;
    c.beginPath();
    c.moveTo(0, -150);
    c.lineTo(Math.cos(a) * 132, -150 + Math.sin(a) * 132);
    c.stroke();
  }
  c.lineWidth = 7;
  c.beginPath();
  c.moveTo(-50, 0); c.lineTo(0, -150); c.lineTo(50, 0);
  c.stroke();
  c.fillStyle = lit;
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * 6.283;
    c.beginPath();
    c.ellipse(Math.cos(a) * 140, -150 + Math.sin(a) * 140, 5, 3.4, 0, 0, 6.3);
    c.fill();
  }
};
const towerBridge: Mark = (c, col, lit) => {
  c.fillStyle = col;
  for (const x of [-70, 70]) {
    c.fillRect(x - 21, -170, 42, 170);
    poly(c, [x - 21, -170, x, -226, x + 21, -170]);
    poly(c, [x - 23, -170, x - 17, -196, x - 11, -170]);
    poly(c, [x + 11, -170, x + 17, -196, x + 23, -170]);
  }
  c.fillRect(-190, -50, 380, 12);
  c.fillRect(-70, -150, 140, 9);
  c.fillRect(-70, -130, 140, 6);
  c.strokeStyle = col;
  c.lineWidth = 4;
  c.beginPath();
  c.moveTo(-91, -160); c.quadraticCurveTo(-150, -70, -196, -50);
  c.moveTo(91, -160); c.quadraticCurveTo(150, -70, 196, -50);
  c.stroke();
  c.fillStyle = lit;
  for (const x of [-70, 70]) for (let y = -150; y < -70; y += 26) c.fillRect(x - 4, y, 8, 14);
};
const tokyoTower: Mark = (c, _col, lit) => {
  const body = (color: string) => {
    c.fillStyle = color;
    c.beginPath();
    c.moveTo(-62, 0);
    c.quadraticCurveTo(-20, -130, -7, -300);
    c.lineTo(-2, -400);
    c.lineTo(2, -400);
    c.lineTo(7, -300);
    c.quadraticCurveTo(20, -130, 62, 0);
    c.lineTo(42, 0);
    c.quadraticCurveTo(0, -120, -42, 0);
    c.closePath();
    c.fill();
  };
  body('#e8453c');
  c.save();
  c.beginPath();
  for (let y = -80; y > -400; y -= 80) c.rect(-70, y - 36, 140, 36);
  c.clip();
  body('#f6efe6');
  c.restore();
  c.fillStyle = '#f6efe6';
  c.fillRect(-30, -128, 60, 14);
  c.fillRect(-13, -262, 26, 10);
  c.fillStyle = '#e8453c';
  c.fillRect(-1.5, -450, 3, 52);
  c.fillStyle = lit;
  c.fillRect(-30, -124, 60, 4);
  c.fillRect(-13, -259, 26, 3);
};
const pagoda: Mark = (c, col, lit) => {
  c.fillStyle = col;
  for (let i = 0; i < 5; i++) {
    const w = 64 - i * 9, y = -i * 40;
    c.fillRect(-w * 0.55, y - 30, w * 1.1, 30);
    c.beginPath();
    c.moveTo(-w - 12, y - 28);
    c.quadraticCurveTo(-w * 0.6, y - 34, -w * 0.5, y - 46);
    c.lineTo(w * 0.5, y - 46);
    c.quadraticCurveTo(w * 0.6, y - 34, w + 12, y - 28);
    c.closePath();
    c.fill();
  }
  c.fillRect(-2, -250, 4, 50);
  c.fillStyle = lit;
  for (let i = 0; i < 5; i++) c.fillRect(-5, -i * 40 - 20, 10, 12);
};
const fuji: Mark = (c, col) => {
  c.fillStyle = col;
  c.beginPath();
  c.moveTo(-520, 0);
  c.quadraticCurveTo(-200, -60, -70, -250);
  c.lineTo(70, -250);
  c.quadraticCurveTo(200, -60, 520, 0);
  c.closePath();
  c.fill();
  c.fillStyle = 'rgba(255,255,255,.88)';
  poly(c, [-70, -250, 70, -250, 112, -186, 80, -200, 52, -170, 22, -200, -6, -172, -40, -202, -74, -178, -110, -186]);
};
const cristo: Mark = (c, col, lit) => {
  c.fillStyle = col;
  c.beginPath();
  c.moveTo(-330, 0);
  c.quadraticCurveTo(-140, -40, -60, -200);
  c.quadraticCurveTo(0, -270, 50, -190);
  c.quadraticCurveTo(150, -40, 360, 0);
  c.closePath();
  c.fill();
  c.fillStyle = lit;
  c.fillRect(-8, -262, 12, 16);
  c.fillRect(-6, -318, 8, 58);
  c.fillRect(-36, -306, 68, 8);
  c.beginPath();
  c.arc(-2, -324, 6, 0, 6.3);
  c.fill();
};
const sugarloaf: Mark = (c, col) => {
  c.fillStyle = col;
  c.beginPath();
  c.moveTo(-240, 0);
  c.bezierCurveTo(-170, -20, -150, -230, -70, -250);
  c.bezierCurveTo(0, -262, 30, -110, 90, -84);
  c.bezierCurveTo(140, -128, 200, -110, 250, 0);
  c.closePath();
  c.fill();
};
const opera: Mark = (c, col, lit) => {
  c.fillStyle = col;
  c.fillRect(-190, -22, 380, 22);
  c.fillStyle = lit;
  const sail = (x: number, w: number, h: number, dir: number) => {
    c.beginPath();
    c.moveTo(x, -22);
    c.quadraticCurveTo(x + dir * w * 0.2, -22 - h * 1.05, x + dir * w, -22 - h);
    c.quadraticCurveTo(x + dir * w * 0.72, -22 - h * 0.3, x + dir * w * 0.62, -22);
    c.closePath();
    c.fill();
  };
  sail(-170, 96, 128, 1);
  sail(-112, 78, 100, 1);
  sail(-60, 60, 72, 1);
  sail(170, 104, 140, -1);
  sail(104, 78, 100, -1);
  sail(48, 56, 64, -1);
  c.fillStyle = 'rgba(0,0,0,.12)';
  c.fillRect(-190, -22, 380, 5);
};
const harbour: Mark = (c, col, lit) => {
  c.fillStyle = col;
  for (const x of [-250, 250]) {
    c.fillRect(x - 18, -120, 36, 120);
    c.fillRect(x - 22, -128, 44, 10);
  }
  c.fillRect(-330, -70, 660, 9);
  c.strokeStyle = col;
  c.lineWidth = 9;
  c.beginPath();
  c.moveTo(-232, -72); c.quadraticCurveTo(0, -330, 232, -72);
  c.stroke();
  c.lineWidth = 5;
  c.beginPath();
  c.moveTo(-232, -72); c.quadraticCurveTo(0, -250, 232, -72);
  c.stroke();
  c.lineWidth = 2;
  for (let x = -210; x <= 210; x += 28) {
    const k = 1 - (x / 232) * (x / 232);
    c.beginPath();
    c.moveTo(x, -70); c.lineTo(x, -72 - k * 129);
    c.stroke();
  }
  c.fillStyle = lit;
  c.fillRect(-3, -206, 6, 6);
};
const khalifa: Mark = (c, col, lit) => {
  c.fillStyle = col;
  const w = [44, 38, 32, 27, 22, 17, 13, 9, 6];
  w.forEach((ww, i) => {
    const y = -i * 58;
    c.fillRect(-ww + (i % 2 ? 4 : -2), y - 60, ww * 2 - (i % 3) * 3, 60);
  });
  poly(c, [-4, -520, 0, -610, 4, -520]);
  c.fillStyle = lit;
  for (let y = -500; y < -20; y += 24) c.fillRect(-1.5, y, 3, 9);
};
const arab: Mark = (c, col, lit) => {
  c.fillStyle = col;
  c.beginPath();
  c.moveTo(-44, 0);
  c.lineTo(-44, -230);
  c.quadraticCurveTo(70, -150, 50, 0);
  c.closePath();
  c.fill();
  c.fillRect(-48, -300, 5, 300);
  c.fillRect(-48, -196, 46, 6);
  c.fillStyle = lit;
  c.beginPath();
  c.moveTo(-38, -12);
  c.lineTo(-38, -208);
  c.quadraticCurveTo(46, -140, 34, -12);
  c.closePath();
  c.globalAlpha = 0.35;
  c.fill();
  c.globalAlpha = 1;
};
const pyramids: Mark = (c, col) => {
  for (const [x, h] of [[-250, 170], [40, 250], [300, 130]] as [number, number][]) {
    c.fillStyle = col;
    poly(c, [x - h * 0.82, 0, x, -h, x + h * 0.82, 0]);
    c.fillStyle = 'rgba(30,10,30,.28)';
    poly(c, [x, -h, x + h * 0.82, 0, x + h * 0.26, 0]);
  }
};
const minaret: Mark = (c, col, lit) => {
  c.fillStyle = col;
  c.fillRect(-80, -70, 120, 70);
  c.beginPath();
  c.arc(-20, -70, 44, Math.PI, 0);
  c.fill();
  c.fillRect(-22, -134, 4, 22);
  c.fillRect(52, -230, 22, 230);
  c.fillRect(46, -170, 34, 8);
  c.fillRect(46, -236, 34, 8);
  poly(c, [52, -236, 63, -290, 74, -236]);
  c.fillStyle = lit;
  c.fillRect(58, -220, 10, 16);
  for (let i = 0; i < 4; i++) c.fillRect(-70 + i * 28, -50, 8, 26);
};

// ───────────── ciudades ─────────────
const CITIES: Record<string, CityDef> = {
  baires: {
    sky: [[0, '#0a0d2e'], [0.35, '#241a5a'], [0.62, '#6b3590'], [0.82, '#e0577a'], [0.94, '#ff9a6b'], [1, '#ffd08a']],
    sun: { top: '#fff6cf', bottom: '#ffab5e', glow: '255,170,120', moon: false },
    haze: '255,170,130', ground: '#161338', stars: 1,
    hills: ['#6d4a94', '#4b3277'], far: ['#5b3f8c', '#46306f'], mark: ['#f3e3ee', '#a183bd'], near: ['#35245f', '#231744'], win: '#ffd68a',
    cloud: ['255,214,196', '214,140,190', '110,80,170'],
    marks: [[obelisco, 0.44, 1.05], [congreso, 0.58, 1.1, true], [obelisco, 0.2, 0.6]],
  },
  nyc: {
    sky: [[0, '#03061a'], [0.4, '#0b1a45'], [0.72, '#1f3f86'], [0.9, '#5a6fc0'], [1, '#f2a56b']],
    sun: { top: '#f4f7ff', bottom: '#cfd9f5', glow: '150,180,255', moon: true },
    haze: '120,150,230', ground: '#070b22', stars: 1.3,
    hills: ['#22346e', '#172452'], far: ['#1c2c63', '#131f4a'], mark: ['#3a4f95', '#22306a'], near: ['#0f1838', '#080d22'], win: '#ffdf7a',
    cloud: ['150,170,230', '90,110,190', '40,56,120'],
    marks: [[empire, 0.47, 1.1], [chrysler, 0.58, 1], [liberty, 0.34, 1.1], [empire, 0.72, 0.7]],
  },
  paris: {
    sky: [[0, '#232a66'], [0.4, '#6a4a94'], [0.68, '#d77a96'], [0.88, '#ffb07a'], [1, '#ffe3a8']],
    sun: { top: '#fffbe0', bottom: '#ffc46e', glow: '255,200,130', moon: false },
    haze: '255,196,150', ground: '#2a1c44', stars: 0.5,
    hills: ['#8a6aa8', '#6c4f90'], far: ['#7a5a98', '#5f447e'], mark: ['#4b3560', '#2f2044'], near: ['#402c58', '#291a3e'], win: '#ffe1a0',
    cloud: ['255,226,200', '240,160,170', '150,100,170'],
    marks: [[eiffel, 0.46, 1.15], [arco, 0.6, 1.2, true], [congreso, 0.36, 0.9, true]],
  },
  london: {
    sky: [[0, '#16222f'], [0.4, '#2f4a5e'], [0.72, '#6f8a94'], [0.9, '#c7b9a2'], [1, '#f0d2a6']],
    sun: { top: '#fff5dc', bottom: '#f3c690', glow: '240,210,170', moon: false },
    haze: '214,200,180', ground: '#101a26', stars: 0.2,
    hills: ['#52707e', '#3d5866'], far: ['#45616f', '#334b58'], mark: ['#2c4250', '#1b2b37'], near: ['#1f303c', '#131f29'], win: '#ffd98f',
    cloud: ['220,225,225', '150,165,175', '80,100,115'],
    marks: [[bigben, 0.5, 1.05], [eye, 0.33, 0.95], [towerBridge, 0.63, 1.1, true]],
  },
  tokyo: {
    sky: [[0, '#07031c'], [0.4, '#210b52'], [0.7, '#7a1f86'], [0.9, '#ff4f93'], [1, '#ffb27a']],
    sun: { top: '#fff0f6', bottom: '#ffc2dd', glow: '255,120,200', moon: true },
    haze: '255,110,180', ground: '#0c0624', stars: 0.9,
    hills: ['#4a2a86', '#35206a'], far: ['#3c2278', '#2a175c'], mark: ['#3a2470', '#261650'], near: ['#1a0f40', '#0e0828'], win: '#7df3ff',
    cloud: ['255,170,220', '190,90,200', '90,50,150'],
    marks: [[tokyoTower, 0.47, 1.1], [pagoda, 0.62, 1.05], [pagoda, 0.3, 0.8]],
    hillMarks: [[fuji, 0.62, 1]],
  },
  rio: {
    sky: [[0, '#0d2f66'], [0.4, '#1f6d9c'], [0.7, '#5fb7b0'], [0.88, '#ffb65c'], [1, '#ffe7a0']],
    sun: { top: '#fffbd6', bottom: '#ffb53e', glow: '255,190,90', moon: false },
    haze: '255,206,130', ground: '#0b2440', stars: 0.2,
    hills: ['#2f7f73', '#1f5f5a'], far: ['#2a6a72', '#1d5058'], mark: ['#f4f1e6', '#b9c7c0'], near: ['#123c48', '#0a2630'], win: '#ffe08a',
    cloud: ['255,240,210', '255,190,140', '120,150,180'],
    marks: [[congreso, 0.2, 0.6]],
    hillMarks: [[cristo, 0.44, 1.05], [sugarloaf, 0.66, 1.1], [sugarloaf, 0.2, 0.7]],
  },
  sydney: {
    sky: [[0, '#143a8c'], [0.45, '#3f86d6'], [0.78, '#9dd2f0'], [0.93, '#ffe6bd'], [1, '#fff3da']],
    sun: { top: '#ffffff', bottom: '#ffe9a8', glow: '255,240,190', moon: false },
    haze: '230,240,255', ground: '#0f2c5c', stars: 0,
    hills: ['#5b93c9', '#4578b0'], far: ['#4d82b8', '#3a699c'], mark: ['#ffffff', '#cfdcea'], near: ['#21416e', '#152c50'], win: '#fff1b8',
    cloud: ['255,255,255', '225,238,250', '150,185,225'],
    marks: [[harbour, 0.6, 0.95], [opera, 0.43, 1.25, true]],
  },
  dubai: {
    sky: [[0, '#241848'], [0.4, '#7a3f78'], [0.7, '#e2706a'], [0.9, '#ffad5c'], [1, '#ffe0a6']],
    sun: { top: '#fff8d8', bottom: '#ffb04a', glow: '255,180,100', moon: false },
    haze: '255,190,130', ground: '#2a1a3c', stars: 0.5,
    hills: ['#c98a68', '#a86a56'], far: ['#8e5a70', '#6f4460'], mark: ['#5a3a66', '#38234a'], near: ['#3c2648', '#261630'], win: '#ffe6a6',
    cloud: ['255,220,190', '240,150,130', '150,90,130'],
    marks: [[khalifa, 0.48, 1], [arab, 0.64, 1.05], [chrysler, 0.32, 0.8]],
  },
  cairo: {
    sky: [[0, '#1a2458'], [0.4, '#7a4a86'], [0.7, '#e0786e'], [0.9, '#ffbe6e'], [1, '#ffe9b4']],
    sun: { top: '#fffadc', bottom: '#ffb84e', glow: '255,190,110', moon: false },
    haze: '255,206,150', ground: '#33203a', stars: 0.6,
    hills: ['#d9a66e', '#b9824f'], far: ['#a8745e', '#8a5a50'], mark: ['#6a4658', '#472c40'], near: ['#48303e', '#2e1c2a'], win: '#ffe3a0',
    cloud: ['255,228,196', '244,170,140', '160,110,140'],
    marks: [[minaret, 0.4, 1.15, true], [minaret, 0.62, 0.9, true]],
    hillMarks: [[pyramids, 0.5, 1.1]],
  },
};

function skylineStrip(seed: number, w: number, h: number, top: string, bottom: string, win: string, near: boolean): HTMLCanvasElement {
  const [cv, c] = mk(w, h);
  const rnd = lcg(seed);
  let x = -20;
  while (x < w) {
    const bw = (near ? 46 : 30) + rnd() * (near ? 90 : 60);
    const bh = h * (0.2 + rnd() * rnd() * 0.76);
    const y = h - bh;
    const g = c.createLinearGradient(0, y, 0, h);
    g.addColorStop(0, top);
    g.addColorStop(1, bottom);
    c.fillStyle = g;
    const kind = rnd();
    const setback = kind >= 0.2 && kind < 0.42;
    c.beginPath();
    if (kind < 0.2) {
      c.moveTo(x, h); c.lineTo(x, y + 14); c.lineTo(x + bw, y); c.lineTo(x + bw, h);
    } else if (setback) {
      const sb = bw * 0.22;
      c.rect(x, y + 26, bw, bh);
      c.rect(x + sb, y, bw - sb * 2, 30);
    } else c.rect(x, y, bw, bh);
    c.fill();
    if (rnd() < 0.4) c.fillRect(x + bw * (0.3 + rnd() * 0.4), y - 16 - rnd() * 30, near ? 2.5 : 1.5, 50);
    if (near && rnd() < 0.3) {
      const tx = x + bw * (0.15 + rnd() * 0.5);
      c.fillRect(tx, y - 12, 16, 12);
      c.beginPath();
      c.moveTo(tx - 2, y - 12); c.lineTo(tx + 8, y - 20); c.lineTo(tx + 18, y - 12);
      c.fill();
    }
    const cw = near ? 12 : 8, ch = near ? 15 : 10;
    const cols = Math.floor((bw - 8) / cw), rows = Math.floor((bh - 14) / ch);
    const lit = 0.16 + rnd() * 0.3;
    c.fillStyle = win;
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        if (rnd() > lit) continue;
        c.globalAlpha = 0.3 + rnd() * 0.7;
        c.fillRect(x + 6 + i * cw, y + (setback ? 34 : 12) + j * ch, cw - (near ? 5 : 4), ch - (near ? 6 : 5));
      }
    }
    c.globalAlpha = 1;
    if (near && rnd() < 0.15 && bh > 110) {
      const col = rnd() < 0.5 ? '#ff5d9e' : '#38e8ff';
      const by = y + 20 + rnd() * 30;
      c.shadowColor = col;
      c.shadowBlur = 14;
      c.fillStyle = col;
      c.fillRect(x + 8, by, bw - 16, 15);
      c.shadowBlur = 0;
      c.fillStyle = 'rgba(20,8,40,.5)';
      for (let k = 0; k < 4; k++) c.fillRect(x + 13 + k * ((bw - 26) / 4), by + 5, (bw - 26) / 6, 5);
    }
    x += bw + rnd() * (near ? 14 : 6) - 2;
  }
  return cv;
}

function hillStrip(seed: number, w: number, h: number, top: string, bottom: string, marks: [Mark, number, number][]): HTMLCanvasElement {
  const [cv, c] = mk(w, h);
  const rnd = lcg(seed);
  const p = [rnd() * 6.28, rnd() * 6.28, rnd() * 6.28];
  const g = c.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  for (const [fn, fx, sc] of marks) {
    c.save();
    c.translate(w * fx, h);
    c.scale(sc, sc);
    c.fillStyle = g;
    fn(c, top, '#f4f1e6');
    c.restore();
  }
  c.fillStyle = g;
  c.beginPath();
  c.moveTo(0, h);
  for (let x = 0; x <= w; x += 8) {
    c.lineTo(x, h * 0.72 + Math.sin(x / 310 + p[0]) * h * 0.13 + Math.sin(x / 120 + p[1]) * h * 0.06 + Math.sin(x / 47 + p[2]) * h * 0.02);
  }
  c.lineTo(w, h);
  c.fill();
  return cv;
}

function markStrip(w: number, h: number, d: CityDef, front: boolean): HTMLCanvasElement {
  const [cv, c] = mk(w, h);
  for (const [fn, fx, sc, isFront] of d.marks) {
    if (!!isFront !== front) continue;
    const [tmp, tc] = mk(900, h);
    tc.translate(450, h);
    tc.scale(sc, sc);
    fn(tc, d.mark[0], d.win);
    // degradé vertical sobre la silueta (más claro arriba, se funde abajo con la bruma)
    tc.setTransform(1, 0, 0, 1, 0, 0);
    tc.globalCompositeOperation = 'source-atop';
    const g = tc.createLinearGradient(0, h * 0.25, 0, h);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, d.mark[1]);
    tc.globalAlpha = 0.75;
    tc.fillStyle = g;
    tc.fillRect(0, 0, 900, h);
    c.drawImage(tmp, w * fx - 450, 0);
  }
  return cv;
}

function cloudSprite(seed: number, tint: [string, string, string]): HTMLCanvasElement {
  const [cv, c] = mk(360, 140);
  const rnd = lcg(seed);
  for (let i = 0; i < 10; i++) {
    const x = 110 + rnd() * 140, y = 66 + rnd() * 20, r = 16 + rnd() * 20;
    const g = c.createRadialGradient(0, 0, 0, 0, 0, r);
    g.addColorStop(0, 'rgba(255,255,255,.95)');
    g.addColorStop(0.55, 'rgba(255,255,255,.6)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.save();
    c.translate(x, y);
    c.scale(2.6, 1.25);
    c.fillStyle = g;
    c.beginPath();
    c.arc(0, 0, r, 0, 6.3);
    c.fill();
    c.restore();
  }
  c.globalCompositeOperation = 'source-in';
  const g = c.createLinearGradient(0, 30, 0, 120);
  g.addColorStop(0, `rgb(${tint[0]})`);
  g.addColorStop(0.55, `rgb(${tint[1]})`);
  g.addColorStop(1, `rgb(${tint[2]})`);
  c.fillStyle = g;
  c.fillRect(0, 0, 360, 140);
  return cv;
}

const cache = new Map<string, Backdrop>();

export function buildBackdrop(id: string): Backdrop {
  const hit = cache.get(id);
  if (hit) return hit;
  const d = CITIES[id] ?? CITIES.baires;
  const seed = [...id].reduce((s, ch) => s * 31 + ch.charCodeAt(0), 7) % 100000;
  const b: Backdrop = {
    id,
    sky: d.sky,
    sun: d.sun,
    haze: d.haze,
    ground: d.ground,
    stars: d.stars,
    layers: [
      { cv: hillStrip(seed + 11, 2600, 360, d.hills[0], d.hills[1], d.hillMarks ?? []), par: 0.06, scale: 0.95 },
      { cv: skylineStrip(seed + 7, 3000, 250, d.far[0], d.far[1], d.win, false), par: 0.13, scale: 0.8 },
      { cv: markStrip(3000, 640, d, false), par: 0.19, scale: 0.9 },
      { cv: skylineStrip(seed + 23, 3600, 330, d.near[0], d.near[1], d.win, true), par: 0.3, scale: 1 },
      { cv: markStrip(3600, 640, d, true), par: 0.3, scale: 1 },
    ],
    clouds: [cloudSprite(seed + 3, d.cloud), cloudSprite(seed + 17, d.cloud), cloudSprite(seed + 41, d.cloud)],
  };
  cache.clear(); // una sola ciudad en memoria
  cache.set(id, b);
  return b;
}

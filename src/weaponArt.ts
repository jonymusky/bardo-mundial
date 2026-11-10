import { sprite, art, artUrl } from './art.ts';
// Arte de armas: proyectiles en vuelo, armas en la mano e íconos del HUD.
// Todo es vectorial con contorno y sombreado de volumen, en el mismo estilo que los personajes.

type Ctx = CanvasRenderingContext2D;
const OL = '#1b1026';

function fo(c: Ctx, fill: string | CanvasGradient, lw = 1.2): void {
  c.fillStyle = fill;
  c.fill();
  c.lineWidth = lw;
  c.strokeStyle = OL;
  c.lineJoin = 'round';
  c.stroke();
}
/** Cuerpo cilíndrico horizontal con brillo arriba y sombra abajo. */
function tube(c: Ctx, x: number, y: number, w: number, h: number, r: number, base: string, lw = 1.2): void {
  c.beginPath();
  c.roundRect(x, y, w, h, r);
  fo(c, base, lw);
  const g = c.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, 'rgba(255,255,255,.5)');
  g.addColorStop(0.35, 'rgba(255,255,255,0)');
  g.addColorStop(0.6, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(10,0,30,.38)');
  c.fillStyle = g;
  c.beginPath();
  c.roundRect(x + 0.5, y + 0.5, w - 1, h - 1, r);
  c.fill();
}
function ball(c: Ctx, x: number, y: number, r: number, base: string, lw = 1.2): void {
  c.beginPath();
  c.arc(x, y, r, 0, 6.3);
  fo(c, base, lw);
  const g = c.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
  g.addColorStop(0, 'rgba(255,255,255,.55)');
  g.addColorStop(0.5, 'rgba(255,255,255,0)');
  g.addColorStop(1, 'rgba(10,0,30,.35)');
  c.fillStyle = g;
  c.beginPath();
  c.arc(x, y, r - 0.4, 0, 6.3);
  c.fill();
}
function poly(c: Ctx, pts: number[], fill: string, lw = 1.2): void {
  c.beginPath();
  c.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
  c.closePath();
  fo(c, fill, lw);
}

// ───────────── proyectiles (origen en el centro, mirando a +x salvo indicación) ─────────────
function rocket(c: Ctx, homing: boolean): void {
  const body = homing ? '#8fd3ff' : '#f4f4f5';
  poly(c, [-11, -6.5, -5, -3, -5, 3, -11, 6.5, -8.5, 0], homing ? '#1d4ed8' : '#b91c1c');
  tube(c, -13, -2.2, 4, 4.4, 1, '#52525b');
  tube(c, -9, -3.4, 16, 6.8, 2.2, body);
  c.beginPath();
  c.moveTo(6.5, -3.4);
  c.quadraticCurveTo(14.5, -1.2, 15, 0);
  c.quadraticCurveTo(14.5, 1.2, 6.5, 3.4);
  c.closePath();
  fo(c, homing ? '#2563eb' : '#ef4444');
  c.fillStyle = homing ? '#1e3a8a' : '#27272a';
  c.fillRect(-2.5, -3.4, 1.8, 6.8);
  c.fillRect(2.6, -3.4, 0.9, 6.8);
  if (homing) {
    c.fillStyle = '#e0f2fe';
    c.beginPath();
    c.arc(12.6, 0, 1.4, 0, 6.3);
    c.fill();
  }
}

function booster(c: Ctx): void {
  // vertical: la punta mira hacia +y local (cae con los motores para arriba… ¡al revés que un aterrizaje!)
  for (const s of [-1, 1]) {
    poly(c, [s * 6.5, 6, s * 15, 22, s * 12, 23, s * 6.5, 14], '#27272a');
    c.beginPath();
    c.roundRect(s * 6.5 - (s < 0 ? 5 : 0), -24, 5, 8, 1);
    fo(c, '#3f3f46');
    c.strokeStyle = 'rgba(255,255,255,.35)';
    c.lineWidth = 0.6;
    c.beginPath();
    for (let i = 1; i < 3; i++) { c.moveTo(s * 6.5 - (s < 0 ? 5 : 0), -24 + i * 2.7); c.lineTo(s * 6.5 + (s < 0 ? 0 : 5), -24 + i * 2.7); }
    c.stroke();
  }
  for (const x of [-4, 0, 4]) {
    poly(c, [x - 1.8, -27, x + 1.8, -27, x + 2.6, -31, x - 2.6, -31], '#52525b', 0.9);
  }
  c.save();
  c.rotate(Math.PI / 2);
  tube(c, -27, -6.8, 48, 13.6, 3.2, '#fafafa', 1.3);
  c.restore();
  c.fillStyle = '#27272a';
  c.fillRect(-6.3, -26.4, 12.6, 6.5);
  c.fillRect(-6.3, 3, 12.6, 2.2);
  c.fillStyle = 'rgba(10,0,30,.16)';
  c.fillRect(-6.3, -20, 3.6, 40);
  c.fillStyle = '#71717a';
  for (let y = -12; y < 0; y += 4) c.fillRect(2.4, y, 2.2, 1.6);
}

function grenade(c: Ctx): void {
  c.strokeStyle = OL;
  c.lineWidth = 2.6;
  c.beginPath();
  c.arc(5.4, -7.6, 2.4, 0, 6.3);
  c.stroke();
  c.strokeStyle = '#d4d4d8';
  c.lineWidth = 1.1;
  c.stroke();
  poly(c, [-2.4, -9.6, 3, -9.6, 5.8, -3, 4.2, -2.2, 1.6, -6.4, -2.4, -6.4], '#a1a1aa', 1);
  ball(c, 0, 0.6, 6, '#4d7c0f');
  c.strokeStyle = 'rgba(10,0,30,.35)';
  c.lineWidth = 0.9;
  c.beginPath();
  for (const x of [-2.8, 0, 2.8]) { c.moveTo(x, -4.8 + Math.abs(x) * 0.4); c.lineTo(x, 6 - Math.abs(x) * 0.4); }
  for (const y of [-1.4, 2.4]) { c.moveTo(-5.6, y); c.lineTo(5.6, y); }
  c.stroke();
}

function battery(c: Ctx, hot: boolean, t: number): void {
  const swell = hot ? 1 + Math.sin(t * 30) * 0.06 : 1;
  c.save();
  c.scale(swell, 1);
  tube(c, -2.6, -11.5, 5.2, 3.4, 1, '#d4d4d8', 1);
  c.save();
  c.rotate(Math.PI / 2);
  tube(c, -8.6, -6.5, 16.4, 13, 2.6, '#27272a');
  c.restore();
  c.fillStyle = hot ? '#ff3d5a' : '#22c55e';
  c.beginPath();
  c.roundRect(-4.6, -6.4, 9.2, 10.6, 1.4);
  c.fill();
  c.fillStyle = '#fff';
  c.beginPath();
  c.moveTo(1.4, -5); c.lineTo(-2.4, 0.2); c.lineTo(-0.2, 0.2); c.lineTo(-1.4, 3.4); c.lineTo(2.4, -1.4); c.lineTo(0.3, -1.4);
  c.closePath();
  c.fill();
  c.fillStyle = 'rgba(255,255,255,.25)';
  c.fillRect(-5.4, -7.6, 2, 13.6);
  c.restore();
}

function drone(c: Ctx, t: number): void {
  c.strokeStyle = OL;
  c.lineWidth = 3.4;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(-11, -4.4); c.lineTo(11, -4.4);
  c.stroke();
  c.strokeStyle = '#52525b';
  c.lineWidth = 1.9;
  c.stroke();
  for (const x of [-11, 11]) {
    tube(c, x - 1.5, -7.2, 3, 3.6, 0.8, '#27272a', 0.9);
    const w = 7.5 + Math.sin(t * 70 + x) * 1.6;
    c.fillStyle = 'rgba(226,232,240,.55)';
    c.beginPath();
    c.ellipse(x, -8, w, 1.5, 0, 0, 6.3);
    c.fill();
    c.strokeStyle = 'rgba(255,255,255,.7)';
    c.lineWidth = 0.6;
    c.beginPath();
    c.moveTo(x - w, -8); c.lineTo(x + w, -8);
    c.stroke();
  }
  tube(c, -7.5, -5.6, 15, 7.6, 3.4, '#334155');
  ball(c, 0, 3.6, 2.9, '#18181b', 1);
  c.fillStyle = Math.floor(t * 10) % 2 ? '#ff3d5a' : '#7f1d1d';
  c.beginPath();
  c.arc(0, 3.6, 1.2, 0, 6.3);
  c.fill();
  // carga explosiva
  tube(c, -4, 6, 8, 4, 1.8, '#f59e0b', 0.9);
  c.fillStyle = OL;
  c.fillRect(-1.5, 6.3, 0.9, 3.4);
  c.fillRect(1, 6.3, 0.9, 3.4);
}

function box(c: Ctx, s: number): void {
  c.beginPath();
  c.roundRect(-s, -s * 0.84, s * 2, s * 1.68, 1.4);
  fo(c, '#c9976a');
  c.fillStyle = '#e9d3ae';
  c.fillRect(-s * 0.2, -s * 0.84 + 0.6, s * 0.4, s * 1.68 - 1.2);
  c.fillStyle = 'rgba(40,16,12,.22)';
  c.fillRect(-s + 0.6, s * 0.42, s * 2 - 1.2, s * 0.42 - 0.6);
  c.fillStyle = 'rgba(255,255,255,.3)';
  c.fillRect(-s + 0.6, -s * 0.84 + 0.6, s * 2 - 1.2, s * 0.22);
  if (s > 6) {
    c.fillStyle = '#fafaf9';
    c.fillRect(s * 0.3, -s * 0.5, s * 0.55, s * 0.62);
    c.fillStyle = OL;
    for (let i = 0; i < 4; i++) c.fillRect(s * 0.36 + i * 1.1, -s * 0.42, 0.55, s * 0.36);
  }
}

function parcel(c: Ctx, t: number): void {
  c.rotate(Math.sin(t * 3) * 0.12);
  c.strokeStyle = 'rgba(255,255,255,.85)';
  c.lineWidth = 0.9;
  c.beginPath();
  for (const x of [-22, -11, 0, 11, 22]) { c.moveTo(x * 0.36, -8); c.lineTo(x, -30 - (11 - Math.abs(x) * 0.5) * 0.2); }
  c.stroke();
  c.beginPath();
  c.moveTo(-24, -30);
  c.bezierCurveTo(-23, -55, 23, -55, 24, -30);
  c.quadraticCurveTo(18, -34, 12, -30);
  c.quadraticCurveTo(6, -34, 0, -30);
  c.quadraticCurveTo(-6, -34, -12, -30);
  c.quadraticCurveTo(-18, -34, -24, -30);
  c.closePath();
  fo(c, '#ff8a2b', 1.3);
  c.fillStyle = '#fff3b0';
  for (const x of [-18, 6]) {
    c.beginPath();
    c.moveTo(x, -31.5);
    c.quadraticCurveTo(x * 0.9 + 1, -46, x * 0.5 + 3, -48.6);
    c.quadraticCurveTo(x * 0.6 + 9, -46, x + 12, -31.5);
    c.quadraticCurveTo(x + 6, -34.5, x, -31.5);
    c.fill();
  }
  c.fillStyle = 'rgba(255,255,255,.3)';
  c.beginPath();
  c.ellipse(-8, -44, 9, 3, -0.3, 0, 6.3);
  c.fill();
  box(c, 9.5);
}

function dog(c: Ctx, age: number): void {
  const lp = Math.sin(age * 26);
  const leg = (x: number, ph: number, back: boolean) => {
    const sw = lp * ph * 3;
    const kx = x + (back ? -2 : 2) + sw * 0.3, ky = 2.6;
    c.lineCap = 'round';
    c.strokeStyle = OL;
    c.lineWidth = 3.6;
    c.beginPath();
    c.moveTo(x, -1); c.lineTo(kx, ky); c.lineTo(x + sw, 6.2);
    c.stroke();
    c.strokeStyle = back ? '#27272a' : '#3f3f46';
    c.lineWidth = 2;
    c.stroke();
    ball(c, x, -1, 1.7, '#18181b', 0.8);
  };
  leg(-6.5, -1, true);
  leg(5.5, 1, true);
  tube(c, -10, -8, 20, 8.4, 3, '#facc15');
  c.fillStyle = '#18181b';
  c.beginPath();
  c.roundRect(-5.5, -6.2, 9, 3, 1);
  c.fill();
  c.fillStyle = '#facc15';
  c.fillRect(-4.4, -5.2, 2, 1);
  leg(-4, 1, false);
  leg(8, -1, false);
  // cabeza con sensores
  c.strokeStyle = OL;
  c.lineWidth = 3;
  c.beginPath();
  c.moveTo(8, -6); c.lineTo(11.5, -10);
  c.stroke();
  tube(c, 8.6, -14, 8.4, 6, 2, '#3f3f46');
  c.fillStyle = Math.floor(age * 7) % 2 ? '#ff3d5a' : '#7f1d1d';
  c.beginPath();
  c.arc(14.2, -11, 1.5, 0, 6.3);
  c.fill();
  c.fillStyle = '#7dd3fc';
  c.fillRect(10.4, -12, 1.8, 1.8);
}

export interface ProjLook { sprite: string; vx: number; vy: number; age: number; fuse: number; dir: number }

/** Versión en imagen del proyectil. Devuelve false si la imagen todavía no cargó. */
function projSprite(c: Ctx, p: ProjLook, t: number, ang: number): boolean {
  switch (p.sprite) {
    case 'rocket':
      c.rotate(ang);
      return sprite(c, 'rocket', 21, 0.55, 0.5);
    case 'homing':
      c.rotate(ang);
      return sprite(c, 'missile', 21, 0.55, 0.5);
    case 'orbital':
      c.rotate(ang);
      return sprite(c, 'booster', 50, 0.6, 0.5);
    case 'grenade':
      c.rotate(p.vx || p.vy ? p.age * 8 * Math.sign(p.vx || 1) : 0.2);
      return sprite(c, 'grenade', 10.5, 0.5, 0.6);
    case 'battery': {
      if (!art('battery')) return false;
      const hot = p.fuse < 1.5;
      if (hot) c.translate(Math.sin(t * 70) * 0.5, 0);
      sprite(c, 'battery', 15, 0.5, 0.62);
      if (Math.floor(p.fuse * (hot ? 8 : 3)) % 2 === 0) {
        c.globalCompositeOperation = 'lighter';
        c.fillStyle = hot ? 'rgba(255,90,40,.55)' : 'rgba(255,160,60,.3)';
        c.beginPath();
        c.arc(0, -1.5, hot ? 5 : 3.6, 0, 6.3);
        c.fill();
        c.globalCompositeOperation = 'source-over';
      }
      return true;
    }
    case 'drone':
      c.rotate(Math.max(-0.45, Math.min(0.45, p.vx / 420)));
      c.scale(p.vx < 0 ? -1 : 1, 1);
      c.translate(0, Math.sin(t * 9) * 0.6);
      return sprite(c, 'drone', 25, 0.5, 0.45);
    case 'parcel': {
      if (!art('parcel') || !art('parachute')) return false;
      c.rotate(Math.sin(t * 2.2) * 0.12);
      c.save();
      c.translate(0, -8);
      sprite(c, 'parachute', 34, 0.5, 1);
      c.restore();
      sprite(c, 'parcel', 16, 0.5, 0.5);
      return true;
    }
    case 'mini':
      c.rotate(p.age * 9);
      return sprite(c, 'parcel', 9, 0.5, 0.5);
    case 'dog':
      c.scale(p.dir, 1);
      c.translate(0, -Math.abs(Math.sin(p.age * 14)) * 1.2);
      c.rotate(Math.sin(p.age * 14) * 0.06);
      return sprite(c, 'robodog', 23, 0.5, 0.78);
  }
  return false;
}

/** Dibuja un proyectil en (0,0). El llamador ya hizo translate. */
export function drawProjectile(c: Ctx, p: ProjLook, t: number): void {
  const ang = Math.atan2(p.vy, p.vx);
  c.save();
  if (projSprite(c, p, t, ang)) {
    c.restore();
    return;
  }
  switch (p.sprite) {
    case 'rocket':
    case 'homing':
      c.rotate(ang);
      rocket(c, p.sprite === 'homing');
      break;
    case 'orbital':
      c.rotate(ang - Math.PI / 2);
      booster(c);
      break;
    case 'grenade':
      c.rotate(p.vx || p.vy ? p.age * 8 * Math.sign(p.vx || 1) : 0.2);
      grenade(c);
      break;
    case 'battery':
      battery(c, Math.floor(p.fuse * (p.fuse < 1.5 ? 8 : 3)) % 2 === 0, p.fuse < 1.5 ? t : 0);
      break;
    case 'drone':
      c.rotate(Math.max(-0.45, Math.min(0.45, p.vx / 420)));
      drone(c, t);
      break;
    case 'parcel':
      parcel(c, t);
      break;
    case 'mini':
      c.rotate(p.age * 9);
      box(c, 4.6);
      break;
    case 'dog':
      c.scale(p.dir, 1);
      dog(c, p.age);
      break;
  }
  c.restore();
}

// ───────────── armas en la mano (origen en la mano, apuntando a +x) ─────────────
function phone(c: Ctx, screen: string, t: number, glyph: (c: Ctx) => void): void {
  c.save();
  c.rotate(-1.15);
  c.beginPath();
  c.roundRect(-1.4, -4.8, 7.2, 10.6, 1.6);
  fo(c, '#18181b', 1);
  c.fillStyle = screen;
  c.globalAlpha = 0.8 + Math.sin(t * 6) * 0.2;
  c.fillRect(-0.4, -3.6, 5.2, 8.2);
  c.globalAlpha = 1;
  c.translate(2.2, 0.5);
  glyph(c);
  c.restore();
}

// imagen, ancho en unidades, punto de agarre (0..1) y giro extra
const HELD: Record<string, [string, number, number, number, number]> = {
  bazooka: ['bazooka', 33, 0.4, 0.62, 0],
  homing: ['launcher', 30, 0.3, 0.7, 0],
  shotgun: ['shotgun', 31, 0.3, 0.55, 0],
  punch: ['glove', 13, 0.22, 0.5, 0],
  grenade: ['grenade', 9, 0.4, 0.8, 0.3],
  battery: ['battery', 13, 0.25, 0.7, 0],
  laser: ['designator', 18, 0.22, 0.72, 0],
  dog: ['tablet', 12, 0.3, 0.6, -0.5],
  parcel: ['tablet', 12, 0.3, 0.6, -0.5],
  drones: ['tablet', 12, 0.3, 0.6, -0.5],
  orbital: ['tablet', 12, 0.3, 0.6, -0.5],
  dome: ['tablet', 12, 0.3, 0.6, -0.5],
};
const ICON: Record<string, string> = {
  bazooka: 'bazooka', shotgun: 'shotgun', punch: 'glove', grenade: 'grenade', battery: 'battery', homing: 'launcher',
  dog: 'robodog', parcel: 'parcel', drones: 'drone', orbital: 'booster', laser: 'satellite', dome: 'interceptor', jetpack: 'jetpack',
};

/** Arma sostenida. `id` es el id del arma. Las piezas se extienden hacia +x desde la mano. */
export function drawHeld(c: Ctx, id: string, t: number): void {
  const H = HELD[id];
  if (H && art(H[0])) {
    c.save();
    c.rotate(H[4]);
    sprite(c, H[0], H[1], H[2], H[3]);
    c.restore();
    return;
  }
  switch (id) {
    case 'bazooka':
      tube(c, -13.5, -3.6, 5, 7.2, 1.6, '#2f3a2a', 1);
      tube(c, -10, -2.9, 22, 5.8, 1.6, '#5b6b45', 1);
      tube(c, 10.4, -3.9, 4.2, 7.8, 1.4, '#2f3a2a', 1);
      c.fillStyle = '#facc15';
      c.fillRect(3.4, -2.6, 1.6, 5.2);
      poly(c, [-3, -2.9, -1, -6.2, 3.4, -6.2, 3.4, -2.9], '#3f4a36', 1);
      c.fillStyle = '#7dd3fc';
      c.fillRect(0, -5.4, 2.4, 1.6);
      poly(c, [-2, 2.9, 1.6, 2.9, 0.8, 7, -2.4, 7], '#2f3a2a', 1);
      c.beginPath();
      c.moveTo(14.4, -2); c.quadraticCurveTo(18.4, 0, 14.4, 2); c.closePath();
      fo(c, '#ef4444', 1);
      break;
    case 'homing':
      tube(c, -10, -4.4, 21, 8.8, 2, '#475569', 1);
      tube(c, 10.4, -3.4, 3.6, 6.8, 1, '#1e293b', 1);
      c.beginPath();
      c.roundRect(-5, -8.6, 9, 4.6, 1.2);
      fo(c, '#1e293b', 1);
      c.fillStyle = Math.floor(t * 4) % 2 ? '#22d3ee' : '#67e8f9';
      c.fillRect(-3.8, -7.6, 6.6, 2.6);
      c.fillStyle = '#f97316';
      c.fillRect(5, -4.4, 1.4, 8.8);
      poly(c, [-3, 4.4, 1, 4.4, 0.2, 8, -3.2, 8], '#1e293b', 1);
      break;
    case 'shotgun':
      poly(c, [-10.5, -1.6, -3, -1.6, -3, 2.2, -8, 4.4, -11, 3.2], '#8a5a2b', 1);
      tube(c, -3.6, -2.5, 18.5, 2.5, 0.8, '#52525b', 0.9);
      tube(c, -3.6, -0.2, 18.5, 2.5, 0.8, '#3f3f46', 0.9);
      tube(c, 2.4, 1.2, 6.4, 2.8, 1, '#a16207', 0.9);
      poly(c, [-4.6, -3, 1, -3, 1, 2.8, -4.6, 2.8], '#27272a', 0.9);
      break;
    case 'punch':
      c.beginPath();
      c.roundRect(-3.4, -3.2, 4.4, 6.4, 1.2);
      fo(c, '#fafaf9', 1);
      ball(c, 4.6, -0.4, 5.2, '#ef4444');
      ball(c, 3.2, 3.6, 2.4, '#ef4444', 1);
      break;
    case 'grenade':
      c.save();
      c.translate(3.4, -1.4);
      c.scale(0.9, 0.9);
      grenade(c);
      c.restore();
      break;
    case 'battery':
      c.save();
      c.translate(3.6, -2.4);
      c.scale(0.82, 0.82);
      battery(c, false, 0);
      c.restore();
      break;
    case 'dog':
      // control remoto con antena
      c.save();
      c.rotate(-0.9);
      c.strokeStyle = OL;
      c.lineWidth = 1.8;
      c.beginPath();
      c.moveTo(4.4, -4.6); c.lineTo(7.4, -12.4);
      c.stroke();
      ball(c, 7.6, -12.8, 1.5, '#ef4444', 0.8);
      c.beginPath();
      c.roundRect(-2.4, -4.8, 9.4, 8.6, 2);
      fo(c, '#facc15', 1);
      ball(c, 0.6, -1, 1.5, '#18181b', 0.7);
      c.fillStyle = '#ef4444';
      c.fillRect(3.4, -2.6, 2.4, 2.4);
      c.restore();
      break;
    case 'parcel':
      phone(c, '#fb923c', t, (g) => { g.fillStyle = '#fff'; g.fillRect(-1.6, -1.6, 3.2, 3.2); });
      break;
    case 'drones':
      phone(c, '#94a3b8', t, (g) => { g.fillStyle = '#fff'; g.fillRect(-2.2, -0.5, 4.4, 1); g.fillRect(-0.5, -2.2, 1, 4.4); });
      break;
    case 'orbital':
      phone(c, '#e5e7eb', t, (g) => { g.fillStyle = '#18181b'; g.beginPath(); g.moveTo(0, -2.8); g.lineTo(1.5, 2.4); g.lineTo(-1.5, 2.4); g.fill(); });
      break;
    case 'laser':
      phone(c, '#fb7185', t, (g) => { g.strokeStyle = '#fff'; g.lineWidth = 0.8; g.beginPath(); g.arc(0, 0, 1.9, 0, 6.3); g.moveTo(-3, 0); g.lineTo(3, 0); g.moveTo(0, -3); g.lineTo(0, 3); g.stroke(); });
      break;
    case 'dome':
      phone(c, '#34d399', t, (g) => { g.strokeStyle = '#fff'; g.lineWidth = 0.8; g.beginPath(); g.arc(0, 1.6, 2.8, Math.PI, 0); g.stroke(); });
      break;
  }
}

// ───────────── íconos del HUD ─────────────
function satellite(c: Ctx): void {
  for (const s of [-1, 1]) {
    c.beginPath();
    c.rect(s * 4.5 - (s < 0 ? 11 : 0), -3.6, 11, 7.2);
    fo(c, '#2563eb', 1);
    c.strokeStyle = 'rgba(255,255,255,.5)';
    c.lineWidth = 0.6;
    c.beginPath();
    for (let i = 1; i < 4; i++) { const x = s * 4.5 + s * i * 2.75; c.moveTo(x, -3.6); c.lineTo(x, 3.6); }
    c.moveTo(s * 4.5, 0); c.lineTo(s * 15.5, 0);
    c.stroke();
  }
  tube(c, -4.5, -5, 9, 10, 2, '#e5e7eb');
  ball(c, 0, 6.6, 2.4, '#fb7185', 0.9);
}

const iconCache = new Map<string, string>();

/** Ícono del arma como data-URL (se genera una vez). */
export function weaponIcon(id: string): string {
  if (ICON[id]) return artUrl(ICON[id]);
  const hit = iconCache.get(id);
  if (hit) return hit;
  const S = 96;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const c = cv.getContext('2d')!;
  c.translate(S / 2, S / 2);
  c.lineCap = 'round';
  const look = (sprite: string, vx: number, vy: number): ProjLook => ({ sprite, vx, vy, age: 0.11, fuse: 3, dir: 1 });
  const held = (wid: string, k: number, rot: number, dx = 0, dy = 0) => { c.translate(dx, dy); c.rotate(rot); c.scale(k, k); drawHeld(c, wid, 0); };
  switch (id) {
    case 'bazooka': held('bazooka', 2.5, -0.5, -6, 4); break;
    case 'shotgun': held('shotgun', 3, -0.45, -8, 4); break;
    case 'punch': held('punch', 4.6, -0.3, -10, 4); break;
    case 'grenade': c.scale(4.3, 4.3); c.translate(-0.6, 1.6); grenade(c); break;
    case 'battery': c.scale(3.5, 3.5); c.translate(0, 2); battery(c, false, 0); break;
    case 'homing':
      c.strokeStyle = '#ff5d6c';
      c.lineWidth = 4;
      c.beginPath();
      c.arc(18, -18, 15, 0, 6.3);
      c.moveTo(18, -40); c.lineTo(18, -26); c.moveTo(18, -10); c.lineTo(18, 4);
      c.moveTo(-4, -18); c.lineTo(10, -18); c.moveTo(26, -18); c.lineTo(40, -18);
      c.stroke();
      c.translate(-8, 10);
      c.scale(2.7, 2.7);
      drawProjectile(c, look('homing', 1, -1), 0);
      break;
    case 'dog': c.scale(2.9, 2.9); c.translate(-3, 4); dog(c, 0.11); break;
    case 'parcel': c.scale(1.72, 1.72); c.translate(0, 20); parcel(c, 0); break;
    case 'drones': c.scale(3.1, 3.1); c.translate(0, -1); drone(c, 0); break;
    case 'orbital':
      c.rotate(0.5);
      c.scale(1.72, 1.72);
      c.fillStyle = '#ff8a2b';
      c.beginPath();
      c.moveTo(-6, -30); c.quadraticCurveTo(0, -52, 6, -30);
      c.fill();
      c.translate(0, 4);
      booster(c);
      break;
    case 'laser':
      c.strokeStyle = 'rgba(255,77,109,.45)';
      c.lineWidth = 13;
      c.beginPath();
      c.moveTo(8, -8); c.lineTo(34, 40);
      c.stroke();
      c.strokeStyle = '#fff';
      c.lineWidth = 4;
      c.stroke();
      c.translate(-8, -16);
      c.rotate(-0.5);
      c.scale(2.3, 2.3);
      satellite(c);
      break;
    case 'dome':
      c.strokeStyle = '#38bdf8';
      c.lineWidth = 5;
      c.setLineDash([9, 7]);
      c.beginPath();
      c.arc(0, 30, 38, Math.PI * 1.05, Math.PI * 1.95);
      c.stroke();
      c.setLineDash([]);
      c.translate(0, 26);
      c.scale(2.6, 2.6);
      for (let i = 0; i < 3; i++) {
        c.save();
        c.translate(-5 + i * 5, 0);
        c.rotate(-0.3 + i * 0.3);
        tube(c, -1.9, -13, 3.8, 12, 1.4, '#e2e8f0', 0.9);
        c.restore();
      }
      tube(c, -9.5, -1.4, 19, 6, 1.8, '#475569');
      break;
    case 'jetpack':
      c.scale(3, 3);
      c.fillStyle = '#ff8a2b';
      for (const x of [-5, 5]) {
        c.beginPath();
        c.moveTo(x - 3, 8); c.quadraticCurveTo(x, 20, x + 3, 8);
        c.fill();
      }
      c.fillStyle = '#fff3b0';
      for (const x of [-5, 5]) {
        c.beginPath();
        c.moveTo(x - 1.6, 8); c.quadraticCurveTo(x, 14, x + 1.6, 8);
        c.fill();
      }
      c.save();
      c.rotate(Math.PI / 2);
      tube(c, -11, 1.4, 19, 7.4, 3, '#94a3b8');
      tube(c, -11, -8.8, 19, 7.4, 3, '#94a3b8');
      c.restore();
      tube(c, -3.4, -6, 6.8, 9, 1.6, '#ef4444');
      break;
    case 'skip':
      c.lineJoin = 'round';
      poly(c, [-28, -22, -2, 0, -28, 22], '#e5e7eb', 4);
      poly(c, [-2, -22, 24, 0, -2, 22], '#e5e7eb', 4);
      c.beginPath();
      c.roundRect(24, -22, 9, 44, 3);
      fo(c, '#e5e7eb', 4);
      break;
  }
  const url = cv.toDataURL();
  iconCache.set(id, url);
  return url;
}

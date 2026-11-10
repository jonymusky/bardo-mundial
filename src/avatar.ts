import { drawHeld } from './weaponArt.ts';
import { headSprite, torsoSprite, partSprite, TORSO, HEAD_PX, HEAD_CX, HEAD_CY, HEAD_R } from './headArt.ts';
import { sprite, art } from './art.ts';

// Avatares: datos + dibujo procedural. Todo es cosmético; nada afecta la jugabilidad.

export interface AvatarSpec {
  country: string;
  identity: number;
  skin: number;
  body: number;
  hair: number;
  hairColor: number;
  face: number;
  top: number;
  topColor: number;
  bottom: number;
  bottomColor: number;
  acc: number;
}

export interface Country {
  code: string;
  name: string;
  flag: string;
  colors: [string, string];
  names: string[];
}

export const COUNTRIES: Country[] = [
  { code: 'AR', name: 'Argentina', flag: '🇦🇷', colors: ['#75aadb', '#ffffff'], names: ['Juli', 'Santi', 'Cami', 'Nacho', 'Flor', 'Tincho', 'Lu', 'Fede'] },
  { code: 'BR', name: 'Brasil', flag: '🇧🇷', colors: ['#f7d417', '#1f9d49'], names: ['Rafa', 'Bia', 'Duda', 'Caio', 'Lara', 'Gabi', 'Téo', 'Malu'] },
  { code: 'UY', name: 'Uruguay', flag: '🇺🇾', colors: ['#6ab4e8', '#ffffff'], names: ['Seba', 'Vale', 'Maxi', 'Agus', 'Rodri', 'Cata'] },
  { code: 'CL', name: 'Chile', flag: '🇨🇱', colors: ['#d52b1e', '#0039a6'], names: ['Benja', 'Anto', 'Javi', 'Cote', 'Vicho', 'Pancha'] },
  { code: 'MX', name: 'México', flag: '🇲🇽', colors: ['#0b7a43', '#ffffff'], names: ['Memo', 'Ximena', 'Chuy', 'Lupita', 'Paco', 'Fer'] },
  { code: 'CO', name: 'Colombia', flag: '🇨🇴', colors: ['#fcd116', '#003893'], names: ['Juanes', 'Dani', 'Caro', 'Andre', 'Sebas', 'Majo'] },
  { code: 'US', name: 'Estados Unidos', flag: '🇺🇸', colors: ['#1c2f6b', '#c8102e'], names: ['Sam', 'Alex', 'Jordan', 'Riley', 'Casey', 'Taylor'] },
  { code: 'ES', name: 'España', flag: '🇪🇸', colors: ['#c60b1e', '#ffc400'], names: ['Pau', 'Noa', 'Iker', 'Alba', 'Hugo', 'Leire'] },
  { code: 'IT', name: 'Italia', flag: '🇮🇹', colors: ['#1565c0', '#ffffff'], names: ['Gio', 'Fran', 'Luca', 'Chiara', 'Ale', 'Marti'] },
  { code: 'FR', name: 'Francia', flag: '🇫🇷', colors: ['#1d3a8a', '#ffffff'], names: ['Camille', 'Lou', 'Sacha', 'Noé', 'Maël', 'Inès'] },
  { code: 'DE', name: 'Alemania', flag: '🇩🇪', colors: ['#ffffff', '#111111'], names: ['Kim', 'Toni', 'Luca', 'Mika', 'Jona', 'Nele'] },
  { code: 'GB', name: 'Reino Unido', flag: '🇬🇧', colors: ['#ffffff', '#c8102e'], names: ['Charlie', 'Frankie', 'Robin', 'Ash', 'Billie', 'Max'] },
  { code: 'IL', name: 'Israel', flag: '🇮🇱', colors: ['#ffffff', '#0038b8'], names: ['Noa', 'Tal', 'Gal', 'Omer', 'Shai', 'Yuval'] },
  { code: 'JP', name: 'Japón', flag: '🇯🇵', colors: ['#1a2a6c', '#ffffff'], names: ['Haru', 'Ren', 'Aoi', 'Sora', 'Yuki', 'Hina'] },
  { code: 'KR', name: 'Corea del Sur', flag: '🇰🇷', colors: ['#d8232a', '#ffffff'], names: ['Min', 'Jun', 'Hana', 'Yuna', 'Jae', 'Seo'] },
  { code: 'IN', name: 'India', flag: '🇮🇳', colors: ['#1d6fd1', '#ff9933'], names: ['Ari', 'Dev', 'Isha', 'Kiran', 'Nia', 'Rohan'] },
  { code: 'NG', name: 'Nigeria', flag: '🇳🇬', colors: ['#128a4a', '#ffffff'], names: ['Ade', 'Chidi', 'Ngozi', 'Tobi', 'Zainab', 'Emeka'] },
  { code: 'ZA', name: 'Sudáfrica', flag: '🇿🇦', colors: ['#0b7a43', '#ffb612'], names: ['Thabo', 'Lerato', 'Sipho', 'Naledi', 'Kagiso', 'Zola'] },
  { code: 'AU', name: 'Australia', flag: '🇦🇺', colors: ['#ffcd00', '#00843d'], names: ['Kai', 'Jess', 'Lachie', 'Tilly', 'Bailey', 'Indi'] },
  { code: 'UA', name: 'Ucrania', flag: '🇺🇦', colors: ['#ffd500', '#005bbb'], names: ['Sasha', 'Daryna', 'Taras', 'Olena', 'Bohdan', 'Mila'] },
];
export const COUNTRY_BY_CODE: Record<string, Country> = Object.fromEntries(COUNTRIES.map((c) => [c.code, c]));

export const SKINS = ['#fbe0cb', '#f1c9a5', '#e0ac7e', '#c68a5c', '#9b6238', '#6b4226', '#49301f'];
export const HAIR_COLORS = ['#1c1410', '#4a2e1b', '#8a5a2b', '#d9a441', '#f3e3b0', '#b33a24', '#9aa0a8', '#ff4fa3', '#3aa0ff', '#3fd08a', '#8b5cf6'];
export const COLORS = ['#ef4444', '#f97316', '#facc15', '#22c55e', '#14b8a6', '#3b82f6', '#6366f1', '#a855f7', '#ec4899', '#f5f5f4', '#9ca3af', '#27272a', '#7c4a1e', '#1e3a5f'];
// Cantidad de opciones por categoría (las etiquetas están en i18n.ts)
export const COUNTS = { identity: 7, body: 3, hair: 9, face: 6, top: 9, bottom: 5, acc: 9 };

export function randomAvatar(rnd: () => number, country?: string): AvatarSpec {
  const r = (n: number) => Math.floor(rnd() * n);
  return {
    country: country ?? COUNTRIES[r(COUNTRIES.length)].code,
    identity: r(COUNTS.identity),
    skin: r(SKINS.length),
    body: r(COUNTS.body),
    hair: r(COUNTS.hair),
    hairColor: r(HAIR_COLORS.length),
    face: rnd() < 0.45 ? 0 : r(COUNTS.face),
    top: r(COUNTS.top),
    topColor: r(COLORS.length),
    bottom: r(COUNTS.bottom),
    bottomColor: r(COLORS.length),
    acc: rnd() < 0.35 ? 0 : r(COUNTS.acc),
  };
}

export function randomName(rnd: () => number, country: string): string {
  const c = COUNTRY_BY_CODE[country] ?? COUNTRIES[0];
  return c.names[Math.floor(rnd() * c.names.length)];
}

function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(v * f)));
  return `rgb(${ch(n >> 16)},${ch((n >> 8) & 255)},${ch(n & 255)})`;
}

export interface PoseOpts {
  facing: number;
  walk: number; // fase del paso
  stride: number; // 0 = quieto, 1 = caminando
  aim: number | null; // elevación en radianes, o null con los brazos sueltos
  tool: string; // 'none', 'jet' o el id del arma en la mano
  hurt: boolean;
  air: boolean;
  thrust: boolean;
  t: number;
}

const OL = '#1d1326';
const OLW = 0.95;

/**
 * Dibuja una persona centrada en (0,0): pies en y≈+8, cabeza en y≈-15.
 * El llamador hace translate/scale. Todo lleva contorno oscuro para leerse sobre cualquier fondo.
 */
export function drawAvatar(ctx: CanvasRenderingContext2D, a: AvatarSpec, o: PoseOpts): void {
  const skin = SKINS[a.skin] ?? SKINS[0];
  const skinD = shade(skin, 0.8);
  const hairC = HAIR_COLORS[a.hairColor] ?? HAIR_COLORS[0];
  const hairL = shade(hairC, 1.35);
  const topC = COLORS[a.topColor] ?? COLORS[0];
  const topD = shade(topC, 0.74);
  const botC = COLORS[a.bottomColor] ?? COLORS[5];
  const botD = shade(botC, 0.74);
  const country = COUNTRY_BY_CODE[a.country] ?? COUNTRIES[0];
  const ts = torsoSprite({ skin, top: a.top, topC, flag: [country.colors[0], country.colors[1]] });
  const bw = (ts ? [7.2, 8.5, 10.2] : [8, 10, 12.6])[a.body] ?? 10;
  const hw = bw / 2;
  const dress = a.top === 5;
  const st = o.air ? 0 : o.stride;
  const bob = o.air ? 0 : Math.abs(Math.cos(o.walk)) * 0.8 * st + Math.sin(o.t * 2.6 + a.skin * 1.7) * 0.28 * (1 - st);
  const blink = !o.hurt && (o.t * 0.31 + a.hair * 0.37 + a.skin * 0.21) % 1 > 0.955;

  const fo = (fill: string) => {
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = OLW;
    ctx.strokeStyle = OL;
    ctx.stroke();
  };
  const limb = (pts: number[], w: number, col: string) => {
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.strokeStyle = OL;
    ctx.lineWidth = w + OLW * 1.9;
    ctx.stroke();
    ctx.strokeStyle = col;
    ctx.lineWidth = w;
    ctx.stroke();
    // segundo tono: sombra del lado de atrás, como el sombreado de la cabeza y el torso
    ctx.save();
    ctx.translate(-w * 0.2, w * 0.06);
    ctx.strokeStyle = 'rgba(27,16,38,.2)';
    ctx.lineWidth = w * 0.42;
    ctx.stroke();
    ctx.restore();
  };
  const torso = (y: number, len: number) => {
    ctx.beginPath();
    ctx.moveTo(-hw - 0.7, y + 3.2);
    ctx.quadraticCurveTo(-hw - 0.7, y, -hw + 2.6, y);
    ctx.lineTo(hw - 2.6, y);
    ctx.quadraticCurveTo(hw + 0.7, y, hw + 0.7, y + 3.2);
    ctx.lineTo(hw - 0.5, y + len - 2);
    ctx.quadraticCurveTo(hw - 0.5, y + len, hw - 2.4, y + len);
    ctx.lineTo(-hw + 2.4, y + len);
    ctx.quadraticCurveTo(-hw + 0.5, y + len, -hw + 0.5, y + len - 2);
    ctx.closePath();
  };
  const part = (pts: number[], f: number): number[] => [pts[0], pts[1], pts[0] + (pts[2] - pts[0]) * f, pts[1] + (pts[3] - pts[1]) * f];

  /** Pieza ilustrada estirada entre dos puntos: `over` es cuánto sobresale arriba y abajo, `kx` afina el ancho. */
  const bitLimb = (spr: HTMLCanvasElement, x0: number, y0: number, x1: number, y1: number, top: number, bottom: number, kx = 1) => {
    const len = Math.hypot(x1 - x0, y1 - y0);
    const h = len + top + bottom;
    const w = ((h * spr.width) / spr.height) * kx;
    ctx.save();
    ctx.translate(x0, y0);
    ctx.rotate(Math.atan2(y1 - y0, x1 - x0) - Math.PI / 2);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(spr, -w / 2, -top, w, h);
    ctx.restore();
  };
  const sleeveK = a.top === 3 || a.top === 4 || a.top === 6 ? 1 : a.top === 0 || a.top === 1 ? 0.42 : 0;
  const armK = sleeveK === 1 ? 1.18 : 0.94;
  const armSpr = (back: boolean) => {
    const cloth = a.top === 1 ? country.colors[0] : topC;
    // manga larga con pliegues y puño; para manga corta o brazo desnudo, el brazo liso
    return partSprite(sleeveK === 1 ? 'arm_long' : 'arm_plain', back ? skinD : skin, back ? shade(cloth, 0.74) : cloth, sleeveK);
  };

  ctx.save();
  ctx.scale(o.facing, 1);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // ── jetpack (detrás) ──
  if (o.tool === 'jet') {
    if (o.thrust) {
      const f = 7 + Math.sin(o.t * 46) * 2.6;
      ctx.fillStyle = '#fb923c';
      ctx.beginPath();
      ctx.moveTo(-hw - 6, 3);
      ctx.quadraticCurveTo(-hw - 3.2, 3 + f * 2, -hw - 0.6, 3);
      ctx.fill();
      ctx.fillStyle = '#fff3b0';
      ctx.beginPath();
      ctx.moveTo(-hw - 4.8, 3);
      ctx.quadraticCurveTo(-hw - 3.2, 3 + f * 1.1, -hw - 1.8, 3);
      ctx.fill();
    }
    if (art('jetpack')) {
      ctx.save();
      ctx.translate(-hw - 3.2, -3 + bob);
      sprite(ctx, 'jetpack', 12, 0.45, 0.5);
      ctx.restore();
    } else {
      ctx.beginPath();
      ctx.roundRect(-hw - 6.2, -8.5 + bob, 5.6, 11.5, 2.2);
      fo('#8b93a3');
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(-hw - 5, -6 + bob, 3.2, 1.6);
    }
  }

  // ── pelo por detrás / capucha ──
  const hy = -15.2 + bob;
  const aimingTool = o.aim !== null && o.tool !== 'none' && o.tool !== 'jet';
  const hs = headSprite(
    { skin, hairC, hair: a.hair, face: a.face, acc: a.acc, capC: topD, band: [country.colors[0], country.colors[1]] },
    o.hurt ? 'hurt' : aimingTool ? 'aim' : blink ? 'blink' : 'n',
  );
  if (hs) {
    // el pelo viene con la cabeza ilustrada
  } else if (a.hair === 2) {
    ctx.beginPath();
    ctx.moveTo(-6.8, hy - 4);
    ctx.quadraticCurveTo(-10.5, hy + 4, -8.2, hy + 13.5);
    ctx.quadraticCurveTo(-4, hy + 15.5, 0.5, hy + 12);
    ctx.lineTo(2, hy - 4);
    ctx.closePath();
    fo(hairC);
  } else if (a.hair === 7) {
    ctx.beginPath();
    ctx.roundRect(-8.6, hy - 5, 11.5, 13, 5);
    fo(hairC);
  } else if (a.hair === 4) {
    ctx.beginPath();
    ctx.arc(0.2, hy - 1.6, 10.8, 0, 6.3);
    fo(hairC);
  } else if (a.hair === 8) {
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const an = Math.PI * (0.62 + i * 0.2);
      ctx.moveTo(0.3 + Math.cos(an) * 7.4 + 3.6, hy - 0.6 + Math.sin(an) * 7.4);
      ctx.arc(0.3 + Math.cos(an) * 7.4, hy - 0.6 + Math.sin(an) * 7.4, 3.6, 0, 6.3);
    }
    fo(hairC);
  } else if (a.hair === 6) {
    ctx.beginPath();
    ctx.ellipse(-9.4, hy + 3.2, 2.9, 5.6, 0.35, 0, 6.3);
    fo(hairC);
    ctx.beginPath();
    ctx.arc(-7.6, hy - 1.6, 1.5, 0, 6.3);
    fo('#f472b6');
  }
  if (a.top === 3 && !ts) {
    ctx.beginPath();
    if (hs) ctx.ellipse(-4.6, hy + 7.4, 5.2, 3.6, 0.3, 0, 6.3);
    else ctx.arc(-1.6, hy + 2.2, 8.4, 0, 6.3);
    fo(topD);
  }

  // ── piernas ──
  const legSkin = a.bottom === 1 || a.bottom === 2 || dress;
  const legW = a.bottom === 3 ? 2.9 : 3.5;
  const legCol = legSkin ? skin : botC;
  for (let i = 0; i < 2; i++) {
    const back = i === 0;
    const hx = back ? -2.4 : 2.2;
    const ph = o.walk + (back ? Math.PI : 0);
    let fx: number, fy: number, kx: number, ky: number;
    if (o.air) {
      fx = hx + (back ? -3.4 : 3.6);
      fy = 6.4;
      kx = hx + (back ? -0.6 : 3);
      ky = 4.4;
    } else {
      const sw = Math.sin(ph) * 3.3 * st;
      const lift = Math.max(0, Math.cos(ph)) * 1.9 * st;
      fx = hx + sw;
      fy = 7.3 - lift;
      kx = hx + sw * 0.5 + 0.9 + lift * 0.5;
      ky = 4.3 - lift * 0.4;
    }
    const legName = dress || a.bottom === 2 ? 'leg_bare' : a.bottom === 1 ? 'leg_short' : a.bottom === 4 ? 'leg_ripped' : 'leg_pants';
    const legSpr = partSprite(legName, back ? skinD : skin, back ? botD : botC);
    const shoeSpr = partSprite('shoe', skin, back ? shade(topC, 0.6) : topC);
    if (legSpr && shoeSpr) {
      bitLimb(legSpr, hx, 0.9 + bob * 0.5, fx + 0.3, fy, 0.2, 0.5, a.bottom === 3 ? 1.02 : 1.22);
      ctx.save();
      ctx.translate(fx, fy);
      if (o.air) ctx.rotate(0.3);
      ctx.drawImage(shoeSpr, -2.3, -1.5, 7.6, (7.6 * shoeSpr.height) / shoeSpr.width);
      ctx.restore();
      continue;
    }
    const pts = [hx, 1.6 + bob * 0.5, kx, ky, fx, fy];
    limb(pts, legW, back ? (legSkin ? skinD : botD) : legCol);
    if (a.bottom === 1 && !dress) limb([hx, 1.6 + bob * 0.5, hx + (kx - hx) * 0.75, 1.6 + (ky - 1.6) * 0.75], legW + 0.6, back ? botD : botC);
    if (a.bottom === 4 && !dress) {
      ctx.strokeStyle = skin;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(kx - 1, ky);
      ctx.lineTo(kx + 1, ky);
      ctx.stroke();
    }
    // zapatilla
    ctx.save();
    ctx.translate(fx, fy);
    if (o.air) ctx.rotate(0.3);
    ctx.beginPath();
    ctx.moveTo(-1.9, -0.9);
    ctx.quadraticCurveTo(1.4, -1.6, 3.4, 0.2);
    ctx.quadraticCurveTo(5.2, 0.7, 5, 2.3);
    ctx.lineTo(-1.9, 2.3);
    ctx.closePath();
    fo(back ? shade(topC, 0.6) : topC);
    ctx.fillStyle = '#fafaf9';
    ctx.fillRect(-1.7, 1.4, 6.5, 0.9);
    ctx.fillRect(2.9, 0.2, 2, 0.8);
    ctx.restore();
  }

  // ── brazo de atrás ──
  const sleeve = a.top === 3 || a.top === 4 || a.top === 6 ? 1 : a.top === 0 || a.top === 1 ? 0.45 : 0;
  const sy = -6.2 + bob;
  {
    const sw = Math.sin(o.walk) * 2.6 * st;
    const pts = o.air ? [-hw + 1.6, sy, -hw - 3.5, sy - 4.5] : [-hw + 1.6, sy, -hw - 0.6 - sw, sy + 7];
    const as = armSpr(true);
    if (as) bitLimb(as, pts[0], pts[1], pts[2], pts[3], 1, 1.5, armK);
    else {
      limb(pts, 2.9, skinD);
      if (sleeve) limb(part(pts, sleeve), 3.3, a.top === 1 ? shade(country.colors[0], 0.74) : topD);
      ctx.beginPath();
      ctx.arc(pts[2], pts[3], 1.9, 0, 6.3);
      fo(skinD);
    }
  }

  // ── torso ──
  const ty = -8.6 + bob;
  const tl = a.top === 7 ? 7 : 11;
  if (ts) {
    const k = (bw + 0.9) / TORSO.w;
    const ky = 13.6 / (TORSO.bottom - TORSO.top);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(ts, -TORSO.cx * k + 0.2, 3 + bob * 0.6 - TORSO.bottom * ky, HEAD_PX * k, HEAD_PX * ky);
  } else {
  if (a.top === 7) {
    torso(ty, 11);
    fo(skin);
  }
  // cuello
  ctx.beginPath();
  ctx.roundRect(-1.6, ty - 2.4, 4.2, 4.4, 1.4);
  fo(skinD);
  torso(ty, tl);
  fo(topC);
  ctx.save();
  torso(ty, tl);
  ctx.clip();
  if (a.top === 1) {
    ctx.fillStyle = country.colors[0];
    ctx.fillRect(-hw, ty, bw, tl);
    ctx.fillStyle = country.colors[1];
    for (let x = -hw + 1.4; x < hw; x += 4.2) ctx.fillRect(x, ty, 2, tl);
  } else if (a.top === 2) {
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(-hw, ty + 1, 2.6, 0, 6.3);
    ctx.arc(hw, ty + 1, 2.6, 0, 6.3);
    ctx.fill();
  } else if (a.top === 4) {
    ctx.fillStyle = 'rgba(255,255,255,.9)';
    ctx.beginPath();
    ctx.moveTo(-0.8, ty);
    ctx.lineTo(4.4, ty);
    ctx.lineTo(1.8, ty + 3.2);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    for (let y = ty + 4.4; y < ty + tl; y += 2.5) ctx.fillRect(1.4, y, 1, 1);
  } else if (a.top === 6) {
    ctx.fillStyle = '#fafaf9';
    ctx.beginPath();
    ctx.moveTo(-0.6, ty);
    ctx.lineTo(4.4, ty);
    ctx.lineTo(1.9, ty + 7);
    ctx.fill();
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.moveTo(1.2, ty + 0.6);
    ctx.lineTo(2.8, ty + 0.6);
    ctx.lineTo(2.4, ty + 6);
    ctx.lineTo(1.5, ty + 6);
    ctx.fill();
  } else if (a.top === 8) {
    ctx.fillStyle = 'rgba(0,0,0,.28)';
    ctx.fillRect(-hw, ty + 3.2, bw, 1.2);
    ctx.fillRect(-hw, ty + 7, bw, 1.2);
    ctx.fillStyle = 'rgba(0,0,0,.22)';
    ctx.fillRect(0.6, ty + 4.6, 3.2, 2.2);
    ctx.fillRect(-3.6, ty + 4.6, 3.2, 2.2);
  } else if (a.top === 3) {
    ctx.fillStyle = 'rgba(0,0,0,.2)';
    ctx.beginPath();
    ctx.roundRect(-2.4, ty + 6.2, 6.4, 3, 1.2);
    ctx.fill();
    ctx.fillStyle = '#fafaf9';
    ctx.fillRect(1, ty + 1, 0.7, 4);
    ctx.fillRect(3, ty + 1, 0.7, 3.4);
  } else if (a.top === 0) {
    ctx.fillStyle = 'rgba(255,255,255,.28)';
    ctx.beginPath();
    ctx.arc(1.6, ty + 5.2, 1.9, 0, 6.3);
    ctx.fill();
  }
  // volumen: sombra del lado de atrás y luz arriba
  const tg = ctx.createLinearGradient(-hw - 1, 0, hw + 1, 0);
  tg.addColorStop(0, 'rgba(20,6,30,.34)');
  tg.addColorStop(0.38, 'rgba(20,6,30,0)');
  tg.addColorStop(0.75, 'rgba(255,255,255,.14)');
  tg.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = tg;
  ctx.fillRect(-hw - 1, ty, bw + 2, tl);
  ctx.fillStyle = 'rgba(20,6,30,.2)';
  ctx.fillRect(-hw - 1, ty + tl - 2.2, bw + 2, 2.2);
  ctx.restore();
  }

  // ── pollera / vestido / cintura ──
  const skirtSpr = dress || a.bottom === 2 ? partSprite('skirt', skin, dress ? topC : botC) : null;
  if (skirtSpr) {
    const w = bw + 4.8;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(skirtSpr, -w / 2 + 0.2, 0.2 + bob, w, w * 0.44);
  } else if (dress || a.bottom === 2) {
    ctx.beginPath();
    ctx.moveTo(-hw, 0.2 + bob);
    ctx.lineTo(hw, 0.2 + bob);
    ctx.lineTo(hw + 2.6, 5.4 + bob * 0.5);
    ctx.quadraticCurveTo(0, 6.6 + bob * 0.5, -hw - 2.6, 5.4 + bob * 0.5);
    ctx.closePath();
    fo(dress ? topC : botC);
    ctx.strokeStyle = 'rgba(20,6,30,.22)';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(-1.6, 1 + bob);
    ctx.lineTo(-2.6, 5.4);
    ctx.moveTo(1.8, 1 + bob);
    ctx.lineTo(2.6, 5.4);
    ctx.stroke();
  } else if (!ts) {
    ctx.beginPath();
    ctx.roundRect(-hw, 0.2 + bob, bw, 3, 1.3);
    fo(botC);
  }

  // ── brazo de adelante + lo que tenga en la mano ──
  const frontArm = () => {
    const sx = hw - 2.2;
    if (o.aim !== null && o.tool !== 'none' && o.tool !== 'jet') {
      const c = Math.cos(o.aim);
      const s = -Math.sin(o.aim);
      const hx2 = sx + c * 6.8, hy2 = sy + s * 6.8;
      const held = () => {
        ctx.save();
        ctx.translate(hx2, hy2);
        ctx.rotate(Math.atan2(s, c));
        drawHeld(ctx, o.tool, o.t);
        ctx.restore();
      };
      const pts = [sx, sy, hx2, hy2];
      const as = armSpr(false);
      if (as) {
        // la mano va sobre la empuñadura; el guante de box, sobre la mano
        if (o.tool !== 'punch') held();
        bitLimb(as, sx, sy, hx2, hy2, 1, 1.5, armK);
        if (o.tool === 'punch') held();
      } else {
        held();
        limb(pts, 3, skin);
        if (sleeve) limb(part(pts, sleeve), 3.4, a.top === 1 ? country.colors[0] : topC);
        ctx.beginPath();
        if (o.tool !== 'punch') {
          ctx.arc(hx2, hy2, 2.1, 0, 6.3);
          fo(skin);
        }
      }
    } else {
      const sw = Math.sin(o.walk) * 2.6 * st;
      const pts = o.air ? [sx, sy, sx + 5.5, sy - 5] : [sx, sy, sx + 1.2 + sw, sy + 7.2];
      const as = armSpr(false);
      if (as) bitLimb(as, pts[0], pts[1], pts[2], pts[3], 1, 1.5, armK);
      else {
        limb(pts, 3, skin);
        if (sleeve) limb(part(pts, sleeve), 3.4, a.top === 1 ? country.colors[0] : topC);
        ctx.beginPath();
        ctx.arc(pts[2], pts[3], 2.1, 0, 6.3);
        fo(skin);
      }
    }
  };
  // con la cabeza ilustrada (más grande), el brazo suelto va por detrás del mentón
  const armFirst = !!hs && !aimingTool;
  if (armFirst) frontArm();

  // ── cabeza ──
  if (hs) {
    const k = 7.9 / HEAD_R;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(hs, 0.4 - HEAD_CX * k, hy + 0.4 - HEAD_CY * k, HEAD_PX * k, HEAD_PX * k);
  } else {
  ctx.beginPath();
  ctx.arc(0.4, hy, 7.3, 0, 6.3);
  fo(skin);
  ctx.save();
  ctx.beginPath();
  ctx.arc(0.4, hy, 7.3, 0, 6.3);
  ctx.clip();
  const hg = ctx.createRadialGradient(3.4, hy - 3.4, 1, 0.4, hy, 8.4);
  hg.addColorStop(0, 'rgba(255,255,255,.26)');
  hg.addColorStop(0.45, 'rgba(255,255,255,0)');
  hg.addColorStop(1, 'rgba(20,6,30,.3)');
  ctx.fillStyle = hg;
  ctx.fillRect(-8, hy - 8, 17, 17);
  ctx.fillStyle = 'rgba(20,6,30,.16)';
  ctx.beginPath();
  ctx.ellipse(0.6, hy + 7.6, 6, 2.2, 0, 0, 6.3);
  ctx.fill();
  ctx.fillStyle = 'rgba(244,63,94,.22)';
  ctx.beginPath();
  ctx.arc(5.6, hy + 2.6, 1.8, 0, 6.3);
  ctx.fill();
  // barba
  if (a.face === 1 || a.face === 4) {
    ctx.fillStyle = hairC;
    ctx.beginPath();
    ctx.moveTo(-8, hy + 1.6);
    ctx.quadraticCurveTo(0, hy + 0.2, 8, hy + 1.2);
    ctx.lineTo(8, hy + 9);
    ctx.lineTo(-8, hy + 9);
    ctx.fill();
  }
  if (a.face === 5) {
    ctx.fillStyle = hairC;
    ctx.beginPath();
    ctx.ellipse(3.6, hy + 5.6, 3, 2.6, 0, 0, 6.3);
    ctx.fill();
  }
  ctx.restore();

  // oreja y nariz
  if (a.hair !== 2 && a.hair !== 7 && a.hair !== 4) {
    ctx.beginPath();
    ctx.ellipse(-5.2, hy + 0.8, 1.5, 2, 0, 0, 6.3);
    fo(skinD);
  }
  ctx.fillStyle = skinD;
  ctx.beginPath();
  ctx.ellipse(6.9, hy + 1.2, 1.3, 1, 0, 0, 6.3);
  ctx.fill();

  // ojos
  const ex1 = 1.5, ex2 = 5.3, ey = hy - 1;
  if (o.hurt) {
    ctx.strokeStyle = OL;
    ctx.lineWidth = 1;
    for (const ex of [ex1, ex2]) {
      ctx.beginPath();
      ctx.moveTo(ex - 1.2, ey - 1.2);
      ctx.lineTo(ex + 1.2, ey + 1.2);
      ctx.moveTo(ex + 1.2, ey - 1.2);
      ctx.lineTo(ex - 1.2, ey + 1.2);
      ctx.stroke();
    }
  } else if (blink) {
    ctx.strokeStyle = OL;
    ctx.lineWidth = 0.9;
    for (const ex of [ex1, ex2]) {
      ctx.beginPath();
      ctx.arc(ex, ey - 0.4, 1.5, 0.15, Math.PI - 0.15);
      ctx.stroke();
    }
  } else {
    for (const ex of [ex1, ex2]) {
      ctx.beginPath();
      ctx.ellipse(ex, ey, ex === ex1 ? 1.9 : 1.7, 2.3, 0, 0, 6.3);
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.lineWidth = 0.6;
      ctx.strokeStyle = OL;
      ctx.stroke();
      ctx.fillStyle = OL;
      ctx.beginPath();
      ctx.arc(ex + 0.6, ey + 0.15, 1.12, 0, 6.3);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(ex + 0.95, ey - 0.35, 0.4, 0, 6.3);
      ctx.fill();
    }
    if (a.face === 3 || a.face === 4) {
      ctx.strokeStyle = OL;
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(ex1 - 1.6, ey - 1.6);
      ctx.lineTo(ex1 - 2.8, ey - 2.6);
      ctx.moveTo(ex2 + 1.4, ey - 1.6);
      ctx.lineTo(ex2 + 2.5, ey - 2.6);
      ctx.stroke();
      ctx.fillStyle = 'rgba(168,85,247,.45)';
      ctx.beginPath();
      ctx.ellipse(ex1, ey - 2.3, 1.9, 0.9, 0, Math.PI, 0);
      ctx.ellipse(ex2, ey - 2.3, 1.7, 0.9, 0, Math.PI, 0);
      ctx.fill();
    }
  }
  // cejas: concentradas al apuntar
  if (!o.hurt) {
    ctx.strokeStyle = a.hair === 0 ? OL : shade(hairC, 0.7);
    ctx.lineWidth = 0.95;
    const tilt = o.aim !== null && o.tool !== 'none' && o.tool !== 'jet' ? 0.9 : 0;
    ctx.beginPath();
    ctx.moveTo(ex1 - 1.6, ey - 3.5 - tilt * 0.6);
    ctx.lineTo(ex1 + 1.5, ey - 3.5 + tilt * 0.7);
    ctx.moveTo(ex2 - 1.3, ey - 3.5 + tilt * 0.7);
    ctx.lineTo(ex2 + 1.6, ey - 3.5 - tilt * 0.6);
    ctx.stroke();
  }
  // boca
  if (a.face === 3 || a.face === 4) {
    ctx.beginPath();
    ctx.ellipse(3.6, hy + 3.6, 1.9, o.hurt ? 1.5 : 0.95, 0, 0, 6.3);
    ctx.fillStyle = '#e11d48';
    ctx.fill();
    ctx.lineWidth = 0.5;
    ctx.strokeStyle = OL;
    ctx.stroke();
  } else if (o.hurt) {
    ctx.beginPath();
    ctx.ellipse(3.6, hy + 3.9, 1.5, 1.7, 0, 0, 6.3);
    ctx.fillStyle = '#4a1024';
    ctx.fill();
  } else {
    ctx.strokeStyle = '#4a1024';
    ctx.lineWidth = 0.95;
    ctx.beginPath();
    ctx.arc(3.5, hy + 2.5, 2, 0.25, Math.PI - 0.55);
    ctx.stroke();
  }
  if (a.face === 2) {
    ctx.strokeStyle = hairC;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(1.2, hy + 2.5);
    ctx.quadraticCurveTo(3.6, hy + 1, 6.2, hy + 2.5);
    ctx.stroke();
  }

  // ── pelo (frente) ──
  const cap = () => {
    ctx.beginPath();
    ctx.arc(0.4, hy, 7.6, Math.PI * 0.93, Math.PI * 1.97);
    ctx.quadraticCurveTo(4.5, hy - 5.2, 1, hy - 3.8);
    ctx.quadraticCurveTo(-3.5, hy - 3, -7.1, hy + 1);
    ctx.closePath();
  };
  const shine = () => {
    ctx.strokeStyle = hairL;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0.4, hy, 5.6, Math.PI * 1.25, Math.PI * 1.6);
    ctx.stroke();
    ctx.globalAlpha = 1;
  };
  switch (a.hair) {
    case 0:
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = hairC;
      ctx.beginPath();
      ctx.arc(0.4, hy, 7.2, Math.PI * 1.02, Math.PI * 1.92);
      ctx.fill();
      ctx.globalAlpha = 1;
      break;
    case 1:
    case 2:
    case 6:
      cap();
      fo(hairC);
      shine();
      break;
    case 7:
      cap();
      fo(hairC);
      ctx.beginPath();
      ctx.roundRect(-1.5, hy - 7.4, 9, 3.6, 1.6);
      fo(hairC);
      shine();
      break;
    case 3:
      ctx.beginPath();
      ctx.arc(-2.4, hy - 8.6, 3.7, 0, 6.3);
      fo(hairC);
      cap();
      fo(hairC);
      shine();
      break;
    case 4:
      ctx.beginPath();
      ctx.arc(0.4, hy - 1.4, 9.4, Math.PI * 0.97, Math.PI * 2.02);
      ctx.quadraticCurveTo(3, hy - 4.6, 0, hy - 3.6);
      ctx.quadraticCurveTo(-4, hy - 3, -8.6, hy + 0.6);
      ctx.closePath();
      fo(hairC);
      shine();
      break;
    case 5:
      ctx.beginPath();
      ctx.moveTo(-5.5, hy - 4.6);
      for (let i = 0; i < 5; i++) {
        ctx.lineTo(-4.2 + i * 2.5, hy - 13.4 + Math.abs(i - 2) * 0.9);
        ctx.lineTo(-3 + i * 2.5, hy - 7);
      }
      ctx.lineTo(7, hy - 4.6);
      ctx.closePath();
      fo(hairC);
      break;
    case 8:
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const cx = -4.6 + i * 2.6, cy = hy - 6.2 + Math.abs(i - 2) * 0.8;
        ctx.moveTo(cx + 3, cy);
        ctx.arc(cx, cy, 3, 0, 6.3);
      }
      fo(hairC);
      break;
  }

  // ── accesorios ──
  switch (a.acc) {
    case 1:
      ctx.beginPath();
      ctx.arc(0.4, hy - 1.6, 7.7, Math.PI, 0);
      ctx.closePath();
      fo(topD);
      ctx.beginPath();
      ctx.roundRect(1, hy - 3, 11, 2.3, 1.1);
      fo(topD);
      ctx.fillStyle = 'rgba(255,255,255,.75)';
      ctx.beginPath();
      ctx.arc(1.6, hy - 5.6, 1.5, 0, 6.3);
      ctx.fill();
      break;
    case 2:
      ctx.strokeStyle = OL;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-6.6, hy - 1.6);
      ctx.lineTo(0, hy - 1.6);
      ctx.stroke();
      ctx.beginPath();
      ctx.roundRect(-0.9, hy - 3.2, 4.4, 3.9, 1.5);
      ctx.roundRect(3.9, hy - 3.2, 4.1, 3.9, 1.5);
      fo('#18181b');
      ctx.fillStyle = 'rgba(125,211,252,.6)';
      ctx.fillRect(0, hy - 2.5, 1.6, 1);
      ctx.fillRect(4.7, hy - 2.5, 1.5, 1);
      break;
    case 3:
      ctx.beginPath();
      ctx.rect(-6.9, hy - 5.4, 14.4, 2.3);
      fo(country.colors[0]);
      ctx.fillStyle = country.colors[1];
      ctx.fillRect(-1.2, hy - 5, 3.6, 1.5);
      break;
    case 4:
      ctx.beginPath();
      ctx.ellipse(0.4, hy - 4.8, 12, 2.3, 0, 0, 6.3);
      fo('#8a5a2b');
      ctx.beginPath();
      ctx.roundRect(-5.2, hy - 11.6, 11.2, 7.4, 3);
      fo('#8a5a2b');
      ctx.fillStyle = '#3b2412';
      ctx.fillRect(-5.2, hy - 6.8, 11.2, 1.6);
      break;
    case 5:
      ctx.strokeStyle = OL;
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.arc(-0.2, hy - 0.6, 8.3, Math.PI * 1.08, Math.PI * 1.9);
      ctx.stroke();
      ctx.strokeStyle = '#3f3f46';
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.beginPath();
      ctx.roundRect(-5.4, hy - 2.6, 4, 6.2, 1.8);
      fo('#ef4444');
      break;
    case 6:
      ctx.beginPath();
      ctx.arc(0.4, hy - 1.2, 8.3, Math.PI, 0);
      ctx.lineTo(9.6, hy - 0.2);
      ctx.lineTo(-8.4, hy - 0.2);
      ctx.closePath();
      fo('#5b6b45');
      ctx.fillStyle = 'rgba(255,255,255,.2)';
      ctx.beginPath();
      ctx.arc(1.5, hy - 2.6, 5.4, Math.PI * 1.2, Math.PI * 1.7);
      ctx.lineTo(1.5, hy - 2.6);
      ctx.fill();
      break;
    case 7:
      ctx.strokeStyle = OL;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(-3.6, hy + 4.4, 1.9, 0, 6.3);
      ctx.stroke();
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 1;
      ctx.stroke();
      break;
    case 8:
      ctx.beginPath();
      ctx.moveTo(-5.2, hy - 5.6);
      ctx.lineTo(-5.6, hy - 11.6);
      ctx.lineTo(-2.4, hy - 8.4);
      ctx.lineTo(0.4, hy - 12.6);
      ctx.lineTo(3.2, hy - 8.4);
      ctx.lineTo(6.4, hy - 11.6);
      ctx.lineTo(6, hy - 5.6);
      ctx.closePath();
      fo('#fbbf24');
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(0.4, hy - 7.4, 1, 0, 6.3);
      ctx.fill();
      break;
  }

  }

  if (!armFirst) frontArm();
  ctx.restore();
}

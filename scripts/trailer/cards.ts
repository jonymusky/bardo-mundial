// Placas del tráiler (logo, elenco, cierre). Página solo de desarrollo: se dibuja un cuadro por llamada,
// en función del tiempo, para capturarlas igual que al juego.
import { drawAvatar, type AvatarSpec } from '../../src/avatar.ts';
import { art, preloadArt, CORE_ART, coreReady } from '../../src/art.ts';

const W = 1920, H = 1080;
const cv = document.getElementById('c') as HTMLCanvasElement;
const c = cv.getContext('2d')!;
const FONT = "ui-rounded, 'SF Pro Rounded', system-ui, -apple-system, sans-serif";
preloadArt([...CORE_ART, 'bg_baires', 'bg_paris', 'bg_tokyo', 'fire', 'smoke']);

const clamp = (v: number) => Math.max(0, Math.min(1, v));
const ease = (t: number) => 1 - Math.pow(1 - clamp(t), 3);
/** Entrada con rebote: pasa de largo y vuelve. */
const pop = (t: number) => { const x = clamp(t); return 1 + 2.7 * Math.pow(x - 1, 3) + 1.7 * Math.pow(x - 1, 2); };

function backdrop(name: string, t: number, dark: number): void {
  const im = art(name);
  c.fillStyle = '#120b2a';
  c.fillRect(0, 0, W, H);
  if (im) {
    // cubre todo el cuadro, anclado abajo, con un acercamiento lento
    const k = Math.max(W / im.naturalWidth, H / im.naturalHeight) * (1.1 + t * 0.03);
    const w = im.naturalWidth * k, h = im.naturalHeight * k;
    c.drawImage(im, (W - w) / 2 - t * 26, H - h + 40, w, h);
  }
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, `rgba(13,8,34,${dark * 0.75})`);
  g.addColorStop(0.55, `rgba(13,8,34,${dark})`);
  g.addColorStop(1, `rgba(13,8,34,${Math.min(1, dark + 0.2)})`);
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);
}

function logo(cx: number, cy: number, size: number, t: number): void {
  const word = (text: string, y: number, delay: number, fill: string | CanvasGradient) => {
    const k = pop((t - delay) / 0.42);
    if (t < delay) return;
    c.save();
    c.translate(cx, y);
    c.transform(1, 0, -0.16, 1, 0, 0);
    c.scale(k, k);
    c.font = `900 ${size}px ${FONT}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.lineJoin = 'round';
    c.fillStyle = '#1b1026';
    c.fillText(text, size * 0.045, size * 0.075);
    c.strokeStyle = '#1b1026';
    c.lineWidth = size * 0.11;
    c.strokeText(text, 0, 0);
    c.fillStyle = fill;
    c.fillText(text, 0, 0);
    c.restore();
  };
  const g = c.createLinearGradient(0, cy, 0, cy + size);
  g.addColorStop(0, '#ffd166');
  g.addColorStop(1, '#ff7a3d');
  word('BARDO', cy - size * 0.46, 0, '#ffffff');
  word('MUNDIAL', cy + size * 0.46, 0.18, g);
}

function burst(x: number, y: number, t: number, r: number): void {
  const im = art('fire');
  if (!im || t < 0 || t > 0.5) return;
  const k = ease(t / 0.5);
  c.globalAlpha = 1 - k;
  c.save();
  c.translate(x, y);
  c.rotate(k * 0.6);
  const s = r * (0.5 + k);
  c.drawImage(im, -s, -s, s * 2, s * 2);
  c.restore();
  c.globalAlpha = 1;
}

const CAST: AvatarSpec[] = [
  { country: 'AR', identity: 1, skin: 1, body: 1, hair: 2, hairColor: 5, face: 3, top: 5, topColor: 8, bottom: 2, bottomColor: 8, acc: 0 },
  { country: 'AR', identity: 0, skin: 4, body: 2, hair: 4, hairColor: 0, face: 1, top: 3, topColor: 5, bottom: 0, bottomColor: 13, acc: 5 },
  { country: 'AR', identity: 2, skin: 2, body: 1, hair: 7, hairColor: 7, face: 4, top: 7, topColor: 2, bottom: 3, bottomColor: 11, acc: 2 },
  { country: 'AR', identity: 5, skin: 5, body: 0, hair: 5, hairColor: 9, face: 0, top: 8, topColor: 3, bottom: 4, bottomColor: 5, acc: 0 },
  { country: 'AR', identity: 0, skin: 0, body: 1, hair: 8, hairColor: 2, face: 2, top: 6, topColor: 12, bottom: 0, bottomColor: 11, acc: 8 },
];
const CYCLE: (keyof AvatarSpec)[] = ['hair', 'top', 'acc', 'hairColor', 'skin', 'bottom', 'topColor'];
const MODS: Record<string, number> = { hair: 9, top: 9, acc: 9, hairColor: 8, skin: 6, bottom: 5, topColor: 14 };

function lineup(t: number): void {
  backdrop('bg_paris', t / 3.6, 0.5);
  const beat = 0.3;
  const n = Math.floor(t / beat);
  for (let i = 0; i < CAST.length; i++) {
    const a = { ...CAST[i] };
    // en cada golpe cambia una característica de uno de los cinco
    let last = -1;
    for (let b = 1; b <= n; b++) {
      if ((b * 3) % CAST.length !== i) continue;
      const key = CYCLE[b % CYCLE.length];
      if (key === 'top' && ((a.top + 1 + b) % 9) === 1) continue;
      (a[key] as number) = ((a[key] as number) + 1 + b) % MODS[key];
      last = b;
    }
    const since = last < 0 ? 9 : t - last * beat;
    const k = 17 * (1 + 0.1 * Math.max(0, 1 - since / 0.22));
    const enter = pop((t - i * 0.07) / 0.4);
    const x = W / 2 + (i - 2) * 330, y = 700;
    c.fillStyle = 'rgba(10,4,30,.4)';
    c.beginPath();
    c.ellipse(x, y + 8 * 17 + 22, 120, 20, 0, 0, 6.3);
    c.fill();
    c.save();
    c.translate(x, y + (1 - enter) * 500);
    c.scale(k, k);
    drawAvatar(c, a, { facing: i < 2 ? 1 : i > 2 ? -1 : 1, walk: 0, stride: 0, aim: null, tool: 'none', hurt: false, air: false, thrust: false, t: t + i });
    c.restore();
  }
}

function logoCard(t: number): void {
  backdrop('bg_baires', t / 2.4, 0.62);
  burst(W / 2, H / 2, t, 900);
  logo(W / 2, H / 2, 250, t - 0.06);
}

function endCard(t: number): void {
  backdrop('bg_tokyo', t / 3.6, 0.7);
  logo(W / 2, 290, 180, t);
  const a = ease((t - 0.7) / 0.5);
  c.globalAlpha = a;
  c.font = `800 62px ${FONT}`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  const url = 'bardo-mundial.jonymusky.com';
  const tw = c.measureText(url).width + 96;
  c.fillStyle = '#ffb23e';
  c.beginPath();
  c.roundRect(W / 2 - tw / 2, 560 + (1 - a) * 30, tw, 116, 58);
  c.fill();
  c.fillStyle = '#1b1026';
  c.fillText(url, W / 2, 620 + (1 - a) * 30);
  c.globalAlpha = 1;
  for (let i = 0; i < 2; i++) {
    const e = pop((t - 0.5 - i * 0.12) / 0.4);
    if (t < 0.5 + i * 0.12) continue;
    c.save();
    c.translate(i ? W - 330 : 330, 900 + (1 - e) * 400);
    c.scale(13, 13);
    drawAvatar(c, CAST[i ? 3 : 1], { facing: i ? -1 : 1, walk: 0, stride: 0, aim: 0.15, tool: i ? 'homing' : 'bazooka', hurt: false, air: false, thrust: false, t });
    c.restore();
  }
}

const CARDS: Record<string, (t: number) => void> = { logo: logoCard, lineup, end: endCard };
(window as unknown as Record<string, unknown>).card = (name: string, t: number) => {
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalAlpha = 1;
  c.lineCap = 'round';
  CARDS[name](t);
};
(window as unknown as Record<string, unknown>).cardsReady = () => coreReady() && !!art('bg_baires') && !!art('bg_paris') && !!art('bg_tokyo') && !!art('fire');

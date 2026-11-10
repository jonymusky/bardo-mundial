import { Game, DOME_R, type GameEvent, type Human, type Proj } from './sim/game.ts';
import { drawAvatar, COUNTRY_BY_CODE } from './avatar.ts';
import { TerrainArt, LOOKS } from './terrainArt.ts';
import { makeProps, propSprites, drawProp, lampLight, type Prop } from './props.ts';
import { drawProjectile } from './weaponArt.ts';
import { buildBackdrop, type Backdrop } from './backdrop.ts';
import { sfx as realSfx } from './audio.ts';
import { t } from './i18n.ts';
import { art } from './art.ts';
import { Lighting, MAX_LIGHTS, type Light, type LightEnv } from './lighting.ts';

const NOOP = () => {};
const MUTE = new Proxy(realSfx, { get: () => NOOP });
const OL = '#1b1026';
/** Escala visual de las personas (la colisión sigue siendo un círculo de radio 8). */
const HUMAN_K = 1.42;
const FONT = 'ui-rounded, system-ui, sans-serif';

// kind: 0 = sprite suave, 1 = escombro, 2 = chispa, 3 = bocanada de borde duro (fuego/humo de historieta)
interface Part { kind: number; x: number; y: number; vx: number; vy: number; life: number; max: number; s0: number; s1: number; spr: number; add: boolean; g: number; drag: number; rot: number; vr: number; color: string; c2: string; alpha: number }
interface Float { text: string; x: number; y: number; life: number; max: number; color: string; size: number }
interface Ring { x: number; y: number; r: number; life: number; flash: boolean; star?: number }
interface Anim { phase: number; v: number; sq: number; rec: number; spin: number; wasG: boolean }
interface Flash { x: number; y: number; r: number; i: number; life: number; max: number; col: [number, number, number] }
interface Wave { x: number; y: number; r: number; life: number }
/** Dónde cae el sol o la luna en cada fondo pintado (0..1 del ancho), para el destello en el mar. */
const SUN_U: Record<string, number> = { baires: 0.84, nyc: 0.04, paris: 0.81, london: 0.5, tokyo: 0.06, rio: 0.9, sydney: 0.87, dubai: 0.81, cairo: 0.82 };
const WARM: [number, number, number] = [1, 0.74, 0.42];
const HOT: [number, number, number] = [1, 0.86, 0.6];
const COLD: [number, number, number] = [0.5, 0.78, 1];
const RED: [number, number, number] = [1, 0.3, 0.4];
interface Beam { x: number; y: number; x2: number; y2: number; life: number; max: number; w: number; color: string }

function mk(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const cv = document.createElement('canvas');
  cv.width = Math.max(1, Math.floor(w));
  cv.height = Math.max(1, Math.floor(h));
  return [cv, cv.getContext('2d')!];
}
function soft(stops: [number, string][]): HTMLCanvasElement {
  const [cv, c] = mk(64, 64);
  const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  for (const [o, col] of stops) g.addColorStop(o, col);
  c.fillStyle = g;
  c.fillRect(0, 0, 64, 64);
  return cv;
}
const S_FIRE = 0, S_EMBER = 1, S_SMOKE = 2, S_DUST = 3, S_WATER = 4, S_BLUE = 5, S_WHITE = 6;

export class View {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  game: Game | null = null;
  art: TerrainArt | null = null;
  bd: Backdrop;
  cam = { x: 1200, y: 500, zoom: 1 };
  vw = 800;
  vh = 600;
  manualT = 0;
  shake = 0;
  flash = 0;
  time = 0;
  mouse = { x: 0, y: 0, inside: false };
  showAim = false;
  /** Partida de fondo del menú: sin sonido ni carteles. */
  silent = false;
  parts: Part[] = [];
  floats: Float[] = [];
  rings: Ring[] = [];
  beams: Beam[] = [];
  banner = { text: '', sub: '', life: 0, max: 1 };
  private sprites: HTMLCanvasElement[];
  private clouds: { x: number; y: number; s: number; k: number }[] = [];
  private stars: { x: number; y: number; r: number; p: number }[] = [];
  private strides = new Map<number, Anim>();
  private props: Prop[] = [];
  private propSpr = new Map<string, HTMLCanvasElement>();
  private glowCv: HTMLCanvasElement;
  private gctx: CanvasRenderingContext2D;
  private vignette: HTMLCanvasElement | null = null;
  // iluminación: el mundo va a una capa aparte que WebGL ilumina; lo que emite luz y la interfaz van encima
  private fx: Lighting;
  private worldCv: HTMLCanvasElement;
  private wctx: CanvasRenderingContext2D;
  private overCv: HTMLCanvasElement;
  private octx: CanvasRenderingContext2D;
  private dpr = 1;
  private propCity = 'baires';
  private flashes: Flash[] = [];
  private waves: Wave[] = [];
  private env: LightEnv = { ambient: [1, 1, 1], sun: [0, 0, 0], dir: [0.7, -0.7] };
  private night = false;
  /** Modo cine (tráiler): sin etiquetas, mira ni carteles. */
  cine = false;
  /** Se puede apagar para comparar (o si el equipo no da). */
  lit = true;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.sprites = [
      soft([[0, 'rgba(255,255,235,1)'], [0.25, 'rgba(255,222,120,.95)'], [0.6, 'rgba(255,120,40,.5)'], [1, 'rgba(255,60,20,0)']]),
      soft([[0, 'rgba(255,190,90,1)'], [0.5, 'rgba(240,80,40,.55)'], [1, 'rgba(160,30,20,0)']]),
      soft([[0, 'rgba(70,62,78,.85)'], [0.6, 'rgba(54,46,62,.5)'], [1, 'rgba(40,34,48,0)']]),
      soft([[0, 'rgba(176,132,98,.8)'], [0.6, 'rgba(150,106,78,.4)'], [1, 'rgba(120,84,60,0)']]),
      soft([[0, 'rgba(235,248,255,.95)'], [0.5, 'rgba(150,210,250,.5)'], [1, 'rgba(90,160,230,0)']]),
      soft([[0, 'rgba(230,245,255,1)'], [0.4, 'rgba(110,190,255,.7)'], [1, 'rgba(40,110,255,0)']]),
      soft([[0, 'rgba(255,255,255,1)'], [0.5, 'rgba(255,255,255,.45)'], [1, 'rgba(255,255,255,0)']]),
    ];
    this.bd = buildBackdrop('baires');
    [this.glowCv, this.gctx] = mk(8, 8);
    [this.worldCv, this.wctx] = mk(8, 8);
    [this.overCv, this.octx] = mk(8, 8);
    this.fx = new Lighting();
    // el decorado se pre-dibuja por partida: si el arte llega después, se rearma
    let pending = 0;
    window.addEventListener('artload', () => {
      clearTimeout(pending);
      pending = window.setTimeout(() => {
        if (this.game) this.propSpr = propSprites(this.propCity, (LOOKS[this.propCity] ?? LOOKS.baires).ambient);
      }, 150);
    });
    if (this.fx.ok) {
      for (const cv of [this.fx.canvas, this.overCv]) {
        cv.className = 'layer';
        canvas.after(cv);
      }
      canvas.after(this.fx.canvas);
    }
    let s = 99;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 11; i++) this.clouds.push({ x: rnd() * 4200 - 600, y: rnd(), s: 0.7 + rnd() * 1.3, k: i % 3 });
    for (let i = 0; i < 150; i++) this.stars.push({ x: rnd(), y: rnd() * rnd(), r: 0.5 + rnd() * 1.2, p: rnd() * 6.28 });
    this.resize();
  }

  resize(): void {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.vw = window.innerWidth;
    this.vh = window.innerHeight;
    this.canvas.width = Math.floor(this.vw * dpr);
    this.canvas.height = Math.floor(this.vh * dpr);
    this.canvas.style.width = this.vw + 'px';
    this.canvas.style.height = this.vh + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.dpr = dpr;
    for (const cv of [this.worldCv, this.overCv]) {
      cv.width = this.canvas.width;
      cv.height = this.canvas.height;
    }
    this.fx.resize(this.canvas.width, this.canvas.height, this.vw, this.vh);
    this.cam.zoom = Math.max(this.minZoom(), Math.min(1.9, this.vh / 560));
    const [v, vc] = mk(256, 256);
    const g = vc.createRadialGradient(128, 128, 70, 128, 128, 182);
    g.addColorStop(0, 'rgba(10,4,30,0)');
    g.addColorStop(1, 'rgba(10,4,30,.5)');
    vc.fillStyle = g;
    vc.fillRect(0, 0, 256, 256);
    this.vignette = v;
    this.glowCv.width = Math.ceil(this.vw / 4);
    this.glowCv.height = Math.ceil(this.vh / 4);
  }

  minZoom(): number {
    return Math.max(this.vw / 2900, this.vh / 1500, 0.35);
  }

  setGame(g: Game, city: string): void {
    this.game = g;
    this.parts = [];
    this.floats = [];
    this.rings = [];
    this.beams = [];
    this.strides.clear();
    this.flashes = [];
    this.waves = [];
    this.banner.life = 0;
    this.bd = buildBackdrop(city);
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    const look = LOOKS[city] ?? LOOKS.baires;
    this.art = new TerrainArt(g.terrain, g.rng.s, coarse ? 1 : 2, look);
    this.props = makeProps(g.terrain, g.rng.s, city, g.waterY, g.humans.map((h) => h.x));
    this.propSpr = propSprites(city, look.ambient);
    this.propCity = city;
    this.night = this.bd.sun.moon;
    this.env = this.night
      ? { ambient: [0.6, 0.62, 0.8], sun: [0.32, 0.36, 0.5], dir: look.light }
      : { ambient: [0.76, 0.74, 0.78], sun: [0.36, 0.35, 0.3], dir: look.light };
    this.fx.setMask(g.terrain.mask, g.terrain.w, g.terrain.h);
    this.cam.x = g.w / 2;
    this.cam.y = g.h / 2;
  }

  announce(text: string, sub: string, secs: number): void {
    this.banner = { text, sub, life: secs, max: secs };
  }

  toWorld(sx: number, sy: number): [number, number] {
    return [(sx - this.vw / 2) / this.cam.zoom + this.cam.x, (sy - this.vh / 2) / this.cam.zoom + this.cam.y];
  }
  pan(dx: number, dy: number): void {
    this.cam.x -= dx / this.cam.zoom;
    this.cam.y -= dy / this.cam.zoom;
    this.manualT = 4;
  }
  zoomBy(f: number): void {
    this.cam.zoom = Math.max(this.minZoom(), Math.min(3, this.cam.zoom * f));
  }
  focusNow(): void {
    this.manualT = 0;
  }

  // ───────────── partículas ─────────────
  private p(o: Partial<Part> & { x: number; y: number; life: number }): void {
    this.parts.push({ kind: 0, vx: 0, vy: 0, max: o.life, s0: 4, s1: 4, spr: S_SMOKE, add: false, g: 0, drag: 0, rot: 0, vr: 0, color: '#fff', c2: '#fff', alpha: 1, ...o });
  }
  private spray(x: number, y: number, n: number, speed: number, up: number, mkp: (a: number, v: number) => Partial<Part> & { life: number }): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283;
      const v = speed * (0.25 + Math.random() * 0.75);
      this.p({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - up, ...mkp(a, v) });
    }
  }

  private boom(x: number, y: number, r: number): void {
    this.rings.push({ x, y, r, life: 1, flash: true });
    this.rings.push({ x, y, r: r * 1.15, life: 1, flash: false, star: Math.random() * 6.28 });
    this.rings.push({ x, y, r: r * 1.8, life: 1, flash: false });
    // humo (detrás), después fuego
    for (let i = 0; i < r / 4.5 + 4; i++) {
      const a = Math.random() * 6.283, d = Math.random() * r * 0.7;
      this.p({ kind: 3, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, vx: Math.cos(a) * r * 0.9, vy: Math.sin(a) * r * 0.9 - 30 - Math.random() * 40, life: 1.1 + Math.random() * 1.1, s0: r * (0.16 + Math.random() * 0.12), s1: r * (0.34 + Math.random() * 0.2), g: -0.05, drag: 1.6, color: '#463a58', c2: '#6c5f80' });
    }
    this.spray(x, y, Math.floor(r / 4) + 5, r * 3, 10, () => ({ kind: 3, life: 0.32 + Math.random() * 0.3, s0: r * (0.22 + Math.random() * 0.2), s1: 0, drag: 3.2, color: '#ff5a36', c2: '#ffb23e' }));
    this.spray(x, y, Math.floor(r / 5) + 4, r * 2, 10, () => ({ kind: 3, life: 0.22 + Math.random() * 0.26, s0: r * (0.18 + Math.random() * 0.16), s1: 0, drag: 3.6, color: '#ffc94d', c2: '#fff6c8' }));
    // luz (solo aporta al resplandor)
    this.spray(x, y, 5, r * 1.6, 0, () => ({ spr: S_FIRE, add: true, life: 0.3 + Math.random() * 0.25, s0: r * 0.55, s1: r * 0.1, drag: 2.5, alpha: 0.55 }));
    this.spray(x, y, Math.floor(r / 2), r * 7, r * 2, () => ({ kind: 2, add: true, life: 0.35 + Math.random() * 0.5, g: 0.9, color: Math.random() < 0.5 ? '#ffe9a8' : '#ffb347', s0: 1 + Math.random() * 1.2, drag: 0.6 }));
    const L = this.art?.look;
    const dirt = L ? [L.layers[1], L.layers[2], L.layers[0], L.grass[1]] : ['#7a4a30'];
    this.spray(x, y, Math.floor(r / 3), r * 5.5, r * 3, () => ({ kind: 1, life: 0.9 + Math.random() * 0.9, g: 1, s0: 1.8 + Math.random() * 3.2, color: dirt[Math.floor(Math.random() * dirt.length)], rot: Math.random() * 6, vr: (Math.random() - 0.5) * 16 }));
    this.flashes.push({ x, y, r: r * 4.2 + 90, i: 1.5, life: 0.6, max: 0.6, col: HOT });
    this.waves.push({ x, y, r, life: 1 });
    this.shake = Math.max(this.shake, Math.min(26, r / 3.4));
    this.flash = Math.max(this.flash, Math.min(0.36, r / 260));
  }

  consume(events: GameEvent[]): void {
    const g = this.game;
    if (!g) return;
    const sfx = this.silent ? MUTE : realSfx;
    for (const e of events) {
      switch (e.t) {
        case 'carve':
          this.art?.carve(e.x, e.y, e.r);
          this.fx.patchMask(g.terrain.mask, e.x, e.y, e.r);
          break;
        case 'explosion':
          this.boom(e.x, e.y, e.r);
          sfx.boom(e.r);
          break;
        case 'damage':
          this.floats.push({ text: `-${e.amount}`, x: e.x + (Math.random() - 0.5) * 12, y: e.y, life: 1.5, max: 1.5, color: e.amount >= 40 ? '#ff5d6c' : e.amount >= 20 ? '#ffb23e' : '#ffe9a8', size: 14 + Math.min(14, e.amount / 4) });
          sfx.hurt();
          break;
        case 'death':
          this.floats.push({ text: e.drowned ? '🌊' : '💀', x: e.x, y: e.y - 30, life: 2.2, max: 2.2, color: '#fff', size: 26 });
          this.floats.push({ text: g.humans[e.id].name, x: e.x, y: e.y - 58, life: 2.2, max: 2.2, color: '#e5e7eb', size: 12 });
          if (!e.drowned) {
            this.spray(e.x, e.y - 8, 14, 90, 30, () => ({ spr: S_WHITE, life: 0.8 + Math.random() * 0.5, s0: 5, s1: 14, drag: 2, alpha: 0.7 }));
            this.spray(e.x, e.y - 8, 16, 200, 80, () => ({ kind: 2, add: true, life: 0.6, g: 0.5, color: '#fff', s0: 1.4 }));
          }
          sfx.death();
          break;
        case 'splash':
          this.spray(e.x, e.y, 10, 60, 40, () => ({ spr: S_WATER, life: 0.7 + Math.random() * 0.4, s0: 6, s1: 20, drag: 1.5, alpha: 0.8 }));
          this.spray(e.x, e.y, 26, 240, 220, () => ({ kind: 2, life: 0.9 + Math.random() * 0.4, g: 1, color: '#cfeeff', s0: 1.8 }));
          this.rings.push({ x: e.x, y: e.y, r: 34, life: 1, flash: false });
          sfx.splash();
          break;
        case 'fire':
          if (e.weapon === 'shotgun') sfx.shotgun();
          else if (e.weapon === 'laser') sfx.laser();
          else if (e.weapon === 'punch' || e.weapon === 'skip') void 0;
          else if (e.weapon === 'orbital' || e.weapon === 'drones' || e.weapon === 'parcel') sfx.whoosh();
          else if (e.weapon === 'jetpack') sfx.jet();
          else if (e.weapon === 'grenade') sfx.throw();
          else if (e.weapon === 'battery' || e.weapon === 'dog' || e.weapon === 'dome') sfx.drop();
          else sfx.shoot();
          if (e.weapon === 'bazooka' || e.weapon === 'homing' || e.weapon === 'grenade' || e.weapon === 'shotgun') {
            this.p({ x: e.x, y: e.y, spr: S_FIRE, add: true, life: 0.14, s0: 16, s1: 4 });
            this.flashes.push({ x: e.x, y: e.y, r: 130, i: 1.1, life: 0.16, max: 0.16, col: HOT });
            this.spray(e.x, e.y, 7, 60, 10, () => ({ spr: S_SMOKE, life: 0.6 + Math.random() * 0.4, s0: 4, s1: 13, drag: 2.5, alpha: 0.55 }));
          }
          { const an = this.strides.get(g.activeId); if (an && e.weapon !== 'skip' && e.weapon !== 'jetpack') an.rec = e.weapon === 'shotgun' || e.weapon === 'bazooka' || e.weapon === 'homing' ? 1 : 0.5; }
          this.manualT = 0;
          break;
        case 'jump':
          this.spray(e.x, e.y + 8, 5, 40, 0, () => ({ spr: S_DUST, life: 0.4, s0: 3, s1: 9, drag: 3, alpha: 0.6 }));
          sfx.jump();
          break;
        case 'bounce':
          this.spray(e.x, e.y, 3, 30, 0, () => ({ spr: S_DUST, life: 0.3, s0: 2, s1: 7, drag: 3, alpha: 0.5 }));
          sfx.bounce();
          break;
        case 'punch':
          this.rings.push({ x: e.x, y: e.y, r: 20, life: 0.7, flash: true });
          this.spray(e.x, e.y, 9, 220, 0, () => ({ kind: 2, add: true, life: 0.25, color: '#fff', s0: 1.6 }));
          this.shake = Math.max(this.shake, 7);
          sfx.punch();
          break;
        case 'intercept':
          this.rings.push({ x: e.x, y: e.y, r: 34, life: 1, flash: false });
          this.p({ x: e.x, y: e.y, spr: S_BLUE, add: true, life: 0.4, s0: 46, s1: 10 });
          this.flashes.push({ x: e.x, y: e.y, r: 220, i: 1.3, life: 0.45, max: 0.45, col: COLD });
          this.spray(e.x, e.y, 22, 260, 0, () => ({ kind: 2, add: true, life: 0.5, g: 0.3, color: '#bfe4ff', s0: 1.5 }));
          this.floats.push({ text: t('fx.intercepted'), x: e.x, y: e.y - 26, life: 1.7, max: 1.7, color: '#9fd8ff', size: 14 });
          sfx.intercept();
          break;
        case 'tracer':
          this.beams.push({ x: e.x, y: e.y, x2: e.x2, y2: e.y2, life: 0.2, max: 0.2, w: 2.4, color: '#ffe9a8' });
          break;
        case 'beam':
          this.beams.push({ x: e.x, y: e.y, x2: e.x2, y2: e.y2, life: 0.9, max: 0.9, w: 20, color: '#ff4d6d' });
          for (let y = e.y2; y > e.y2 - 320; y -= 18) this.p({ x: e.x + (Math.random() - 0.5) * 10, y, spr: S_EMBER, add: true, life: 0.6 + Math.random() * 0.5, s0: 12, s1: 26, vy: -40 });
          this.flashes.push({ x: e.x2, y: e.y2, r: 300, i: 1.6, life: 0.9, max: 0.9, col: RED });
          this.flashes.push({ x: e.x2, y: e.y2 - 170, r: 240, i: 1, life: 0.9, max: 0.9, col: RED });
          this.shake = 16;
          this.flash = 0.3;
          break;
        case 'turn': {
          const h = g.humans[e.id];
          const flag = h.avatar ? (COUNTRY_BY_CODE[h.avatar.country]?.flag ?? '') : '';
          if (this.banner.life < 0.6) this.announce(`${flag} ${h.name}`, g.teams[e.team].name, 2.2);
          this.manualT = 0;
          sfx.turn();
          break;
        }
        case 'sudden':
          this.announce(t('fx.sudden'), t('fx.suddenSub'), 3.2);
          break;
        case 'over':
          break;
      }
    }
  }

  private updateCamera(dt: number): void {
    const g = this.game!;
    if (this.manualT > 0) this.manualT -= dt;
    else {
      let fx: number | null = null;
      let fy = 0;
      const mov = g.projs.filter((p) => !p.rest);
      const p = mov.length ? mov[mov.length - 1] : g.projs[0];
      if (p) { fx = p.x; fy = Math.max(p.y, -150); }
      else {
        const flying = g.humans.find((h) => h.alive && !h.grounded && h.knocked);
        const h = flying ?? g.active();
        if (h) { fx = h.x; fy = h.y - 50; }
      }
      if (fx !== null) {
        const k = 1 - Math.exp(-dt * 3.6);
        this.cam.x += (fx - this.cam.x) * k;
        this.cam.y += (fy - this.cam.y) * k;
      }
    }
    const hw = this.vw / 2 / this.cam.zoom;
    const hh = this.vh / 2 / this.cam.zoom;
    const x0 = hw - 250, x1 = g.w + 250 - hw;
    this.cam.x = x0 > x1 ? g.w / 2 : Math.max(x0, Math.min(x1, this.cam.x));
    const y0 = hh - 450, y1 = g.h + 10 - hh;
    this.cam.y = y0 > y1 ? (y0 + y1) / 2 : Math.max(y0, Math.min(y1, this.cam.y));
  }

  // ───────────── cuadro ─────────────
  draw(dt: number): void {
    const c = this.ctx;
    const g = this.game;
    this.time += dt;
    const { vw, vh } = this;
    if (!g) {
      c.fillStyle = '#0d0f24';
      c.fillRect(0, 0, vw, vh);
      return;
    }
    this.updateCamera(dt);
    const z = this.cam.zoom;
    const shx = this.shake > 0.3 ? (Math.random() - 0.5) * this.shake : 0;
    const shy = this.shake > 0.3 ? (Math.random() - 0.5) * this.shake : 0;
    this.shake *= Math.pow(0.015, dt);

    this.backdrop(c, g, z, dt);

    const lit = this.lit && this.fx.ok;
    if (this.overCv.isConnected) {
      const vis = lit ? '' : 'none';
      if (this.fx.canvas.style.display !== vis) this.fx.canvas.style.display = this.overCv.style.display = vis;
    }
    // w: capa del mundo (recibe luz). o: lo que brilla por sí mismo y la interfaz.
    const w = lit ? this.wctx : c;
    const o = lit ? this.octx : c;
    if (lit) for (const k of [w, o]) {
      k.setTransform(1, 0, 0, 1, 0, 0);
      k.clearRect(0, 0, this.canvas.width, this.canvas.height);
      k.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    }
    const left = this.cam.x - vw / 2 / z - 40;
    const right = this.cam.x + vw / 2 / z + 40;
    const bottom = this.cam.y + vh / 2 / z + 40;
    const enter = (k: CanvasRenderingContext2D) => {
      k.save();
      k.translate(vw / 2 + shx, vh / 2 + shy);
      k.scale(z, z);
      k.translate(-this.cam.x, -this.cam.y);
    };

    enter(w);
    this.water(w, g, left, right, bottom, false);
    for (const d of g.domes) this.dome(w, g, d);
    if (this.art) {
      w.imageSmoothingEnabled = true;
      w.imageSmoothingQuality = 'medium';
      w.drawImage(this.art.cv, 0, 0, g.w, g.h);
    }
    this.drawProps(w, g);
    for (const h of g.humans) if (h.alive) this.human(w, g, h, dt);
    for (const p of g.projs) this.proj(w, p, dt);
    for (const it of g.interceptors) {
      this.p({ x: it.x, y: it.y, spr: S_BLUE, add: true, life: 0.28, s0: 7, s1: 2 });
      w.fillStyle = '#fff';
      w.beginPath();
      w.arc(it.x, it.y, 2.4, 0, 6.3);
      w.fill();
    }
    this.water(w, g, left, right, bottom, true);
    w.restore();

    if (lit) this.fx.render({
      world: this.worldCv, vw, vh, camX: this.cam.x, camY: this.cam.y, zoom: z, offX: vw / 2 + shx, offY: vh / 2 + shy,
      lights: this.collectLights(g, left, right),
      shocks: this.waves.map((s) => {
        const t = 1 - s.life;
        return { x: (s.x - this.cam.x) * z + vw / 2 + shx, y: (s.y - this.cam.y) * z + vh / 2 + shy, r: (s.r * 0.4 + t * s.r * 3.4) * z, k: s.life * s.life * Math.min(16, 4 + s.r / 7) * z };
      }),
      env: this.env,
    });
    for (let i = this.flashes.length - 1; i >= 0; i--) if ((this.flashes[i].life -= dt) <= 0) this.flashes.splice(i, 1);
    for (let i = this.waves.length - 1; i >= 0; i--) if ((this.waves[i].life -= dt * 2.1) <= 0) this.waves.splice(i, 1);

    enter(o);
    this.drawBeams(o, dt);
    this.drawParts(o, dt);
    this.drawRings(o, dt);
    if (!this.cine) {
      this.aimOverlay(o, g);
      for (const h of g.humans) if (h.alive) this.label(o, g, h);
    }
    this.drawFloats(o, dt);
    o.restore();
    this.drawGlow(o, shx, shy, z);

    if (this.flash > 0.01) {
      o.fillStyle = `rgba(255,236,200,${this.flash})`;
      o.fillRect(0, 0, vw, vh);
      this.flash *= Math.pow(0.002, dt);
    }
    if (this.vignette) o.drawImage(this.vignette, 0, 0, vw, vh);
    if (!this.cine) this.drawBanner(o, dt);
  }

  /** Descarta efectos acumulados (después de adelantar la simulación sin dibujar). */
  resetFx(): void {
    this.parts = [];
    this.rings = [];
    this.floats = [];
    this.beams = [];
    this.flashes = [];
    this.waves = [];
    this.shake = 0;
    this.flash = 0;
  }

  /** Luces puntuales del cuadro: fogonazos, proyectiles, propulsores, faroles, cúpulas. */
  private collectLights(g: Game, left: number, right: number): Light[] {
    const out: Light[] = [];
    for (const f of this.flashes) {
      const k = f.life / f.max;
      out.push({ x: f.x, y: f.y, r: f.r * (0.7 + 0.3 * k), i: f.i * k * k, col: f.col });
    }
    for (const p of g.projs) {
      const moving = Math.hypot(p.vx, p.vy) > 40;
      if (p.def.sprite === 'orbital') out.push({ x: p.x, y: p.y, r: 260, i: 1.2, col: HOT });
      else if (p.def.sprite === 'rocket' || p.def.sprite === 'homing' || p.def.sprite === 'drone') out.push({ x: p.x, y: p.y, r: 130, i: 0.8, col: WARM });
      else if (p.def.mode === 'timed' || p.def.mode === 'walker') out.push({ x: p.x, y: p.y - 4, r: 70, i: 0.35 + 0.35 * Math.max(0, Math.sin(this.time * (p.fuse < 1.5 ? 22 : 9))), col: RED });
      else if (moving) out.push({ x: p.x, y: p.y, r: 70, i: 0.3, col: WARM });
    }
    for (const it of g.interceptors) out.push({ x: it.x, y: it.y, r: 110, i: 0.9, col: COLD });
    for (const h of g.humans) if (h.alive && h.jet && h.thrusting) out.push({ x: h.x - h.facing * 9, y: h.y + 14, r: 130, i: 0.9 + Math.random() * 0.2, col: WARM });
    for (const d of g.domes) out.push({ x: d.x, y: d.y - 10, r: 150, i: 0.5, col: COLD });
    const lamp = this.night ? 1 : 0.22;
    for (const p of this.props) {
      if (p.kind !== 'lamp' || p.x < left - 160 || p.x > right + 160) continue;
      const [lx, ly] = lampLight(p);
      out.push({ x: lx, y: ly + 6, r: 190 * p.k, i: lamp, col: WARM });
    }
    if (out.length > MAX_LIGHTS) out.sort((a, b) => b.i * b.r - a.i * a.r).length = MAX_LIGHTS;
    return out;
  }

  private backdrop(c: CanvasRenderingContext2D, g: Game, z: number, dt: number): void {
    const { vw, vh, bd } = this;
    const horizon = vh / 2 + (g.waterY - this.cam.y) * z * 0.4 + 30;
    const sky = c.createLinearGradient(0, Math.min(0, horizon - 900), 0, horizon);
    for (const [o, col] of bd.sky) sky.addColorStop(o, col);
    c.fillStyle = sky;
    c.fillRect(0, 0, vw, vh);

    // fondo pintado de la ciudad (si ya cargó); si no, el cielo y las siluetas por código
    const painted = art('bg_' + bd.id);
    let pw = 0, ph = 0, px = 0;
    if (painted) {
      pw = Math.max(vw * 1.2, 1500);
      ph = (pw * painted.naturalHeight) / painted.naturalWidth;
      px = Math.max(vw - pw, Math.min(0, (vw - pw) / 2 - (this.cam.x - 1200) * 0.11 * z));
      c.imageSmoothingEnabled = true;
      c.imageSmoothingQuality = 'medium';
      const top = horizon - ph;
      if (top > 0) c.drawImage(painted, 0, 0, painted.naturalWidth, 2, px, 0, pw, top + 1);
      c.drawImage(painted, px, top, pw, ph);
    }

    if (!painted && bd.stars > 0) {
      c.fillStyle = '#fff';
      for (const s of this.stars) {
        const sy = s.y * horizon * 0.75;
        const a = (0.35 + Math.sin(this.time * 1.7 + s.p) * 0.3) * Math.max(0, 1 - sy / (horizon * 0.62)) * bd.stars;
        if (a <= 0.02) continue;
        c.globalAlpha = Math.min(1, a);
        c.fillRect(s.x * vw, sy, s.r, s.r);
      }
      c.globalAlpha = 1;
    }

    // sol o luna
    const k = 0.6 + z * 0.4;
    const moon = bd.sun.moon;
    const sx = painted ? px + pw * (SUN_U[bd.id] ?? 0.8) : vw * (moon ? 0.24 : 0.7) - (this.cam.x - 1200) * 0.03;
    const sy = horizon - (moon ? 330 : 80) * k;
    const sr = (moon ? 38 : 62) * k;
    if (!painted) {
    c.globalCompositeOperation = 'lighter';
    const glow = c.createRadialGradient(sx, sy, sr * 0.5, sx, sy, sr * (moon ? 4 : 5.5));
    glow.addColorStop(0, `rgba(${bd.sun.glow},${moon ? 0.35 : 0.55})`);
    glow.addColorStop(0.4, `rgba(${bd.sun.glow},.14)`);
    glow.addColorStop(1, `rgba(${bd.sun.glow},0)`);
    c.fillStyle = glow;
    c.fillRect(0, 0, vw, vh);
    c.globalCompositeOperation = 'source-over';
    const disc = c.createLinearGradient(0, sy - sr, 0, sy + sr);
    disc.addColorStop(0, bd.sun.top);
    disc.addColorStop(1, bd.sun.bottom);
    c.fillStyle = disc;
    c.beginPath();
    c.arc(sx, sy, sr, 0, 6.3);
    c.fill();
    if (moon) {
      c.fillStyle = 'rgba(90,100,150,.22)';
      for (const [mx, my, mr] of [[-0.3, -0.2, 0.22], [0.25, 0.3, 0.16], [0.3, -0.35, 0.1], [-0.2, 0.4, 0.12]]) {
        c.beginPath();
        c.arc(sx + mx * sr, sy + my * sr, mr * sr, 0, 6.3);
        c.fill();
      }
    }

    }
    if (!painted) for (const cl of this.clouds) {
      cl.x += (5 + g.wind * 22) * cl.s * dt;
      if (cl.x > 3800) cl.x = -700;
      if (cl.x < -700) cl.x = 3800;
      const ck = (0.45 + z * 0.3) * cl.s;
      const cx = (cl.x - 1200 - (this.cam.x - 1200) * 0.1) * 0.55 + vw / 2;
      const cy = horizon - (190 + cl.y * 520) * (0.5 + z * 0.35);
      c.globalAlpha = 0.45 + cl.y * 0.3;
      c.drawImage(bd.clouds[cl.k], cx - 180 * ck, cy - 70 * ck, 360 * ck, 140 * ck);
    }
    c.globalAlpha = 1;

    const layers = () => {
      if (painted) {
        c.drawImage(painted, px, horizon - ph, pw, ph);
        return;
      }
      for (const L of bd.layers) {
        const sc = L.scale * (0.55 + z * 0.4);
        const w = L.cv.width * sc, h = L.cv.height * sc;
        let x = vw / 2 - w / 2 - (this.cam.x - 1200) * L.par * z;
        if (w > vw) x = Math.max(vw - w, Math.min(0, x));
        c.drawImage(L.cv, x, horizon - h + 2, w, h);
      }
    };
    if (!painted) layers();
    const haze = c.createLinearGradient(0, horizon - 200, 0, horizon);
    haze.addColorStop(0, `rgba(${bd.haze},0)`);
    haze.addColorStop(1, `rgba(${bd.haze},${painted ? 0.16 : 0.42})`);
    c.fillStyle = haze;
    c.fillRect(0, horizon - 200, vw, 200);
    // mar: color base, cielo y ciudad reflejados, destello bajo el sol
    c.fillStyle = bd.ground;
    c.fillRect(0, horizon, vw, vh - horizon + 1);
    if (horizon < vh) {
      c.save();
      c.beginPath();
      c.rect(0, horizon, vw, vh - horizon);
      c.clip();
      const sea = c.createLinearGradient(0, horizon, 0, horizon + 300);
      sea.addColorStop(0, `rgba(${bd.haze},.6)`);
      sea.addColorStop(0.35, `rgba(${bd.haze},.2)`);
      sea.addColorStop(1, `rgba(${bd.haze},0)`);
      c.fillStyle = sea;
      c.fillRect(0, horizon, vw, 300);
      c.save();
      c.translate(0, horizon);
      c.scale(1, -0.62);
      c.translate(0, -horizon);
      c.globalAlpha = painted ? 0.42 : 0.3;
      layers();
      c.restore();
      c.globalCompositeOperation = 'lighter';
      const gl = c.createLinearGradient(0, horizon, 0, horizon + 260);
      gl.addColorStop(0, `rgba(${bd.sun.glow},.5)`);
      gl.addColorStop(1, `rgba(${bd.sun.glow},0)`);
      c.fillStyle = gl;
      for (let i = 0; i < 11; i++) {
        const wI = sr * (0.35 + i * 0.1) * (0.7 + Math.sin(this.time * 2.3 + i * 1.7) * 0.3);
        c.globalAlpha = 0.55 - i * 0.04;
        c.fillRect(sx - wI + Math.sin(this.time * 1.4 + i * 2.1) * 9, horizon + 5 + i * i * 2 + i * 3, wI * 2, 1.2);
      }
      c.globalAlpha = 1;
      c.globalCompositeOperation = 'source-over';
      c.strokeStyle = bd.ground;
      c.globalAlpha = 0.22;
      c.lineWidth = 1.4;
      c.beginPath();
      for (let i = 0; i < 26; i++) {
        const yy = horizon + 5 + i * i * 0.5;
        const off = ((i * 97) % 160) + Math.sin(this.time * 0.7 + i) * 14;
        for (let xx = -160 + off; xx < vw; xx += 150 + ((i * 31) % 90)) { c.moveTo(xx, yy); c.lineTo(xx + 50 + ((i * 17) % 60), yy); }
      }
      c.stroke();
      c.restore();
    }
  }

  private wave(x: number, front: boolean): number {
    const p = front ? 1.9 : 0;
    const a = front ? 4.5 : 6.5;
    return Math.sin(x / 52 + this.time * 1.5 + p) * a + Math.sin(x / 21 - this.time * 2.2 + p) * a * 0.35;
  }

  private water(c: CanvasRenderingContext2D, g: Game, left: number, right: number, bottom: number, front: boolean): void {
    const wy = g.waterY;
    c.beginPath();
    c.moveTo(left, bottom);
    for (let x = left; x <= right + 12; x += 12) c.lineTo(x, wy + this.wave(x, front));
    c.lineTo(right + 12, bottom);
    c.closePath();
    const gr = c.createLinearGradient(0, wy - 8, 0, wy + 170);
    if (front) {
      gr.addColorStop(0, 'rgba(120,205,255,.5)');
      gr.addColorStop(0.2, 'rgba(46,128,220,.62)');
      gr.addColorStop(1, 'rgba(12,30,96,.92)');
    } else {
      gr.addColorStop(0, '#3f8fdc');
      gr.addColorStop(0.3, '#1f4f9e');
      gr.addColorStop(1, '#0b1a4e');
    }
    c.fillStyle = gr;
    c.fill();
    c.beginPath();
    for (let x = left; x <= right + 12; x += 12) {
      const y = wy + this.wave(x, front);
      if (x === left) c.moveTo(x, y);
      else c.lineTo(x, y);
    }
    c.strokeStyle = front ? 'rgba(235,250,255,.75)' : 'rgba(170,220,255,.5)';
    c.lineWidth = front ? 2.2 : 1.6;
    c.stroke();
    if (front) {
      c.strokeStyle = `rgba(${this.bd.haze},.26)`;
      c.lineWidth = 1.6;
      c.lineCap = 'round';
      c.beginPath();
      for (let i = 0; i < 30; i++) {
        const bx = Math.floor(left / 110) * 110 + i * 110 + ((i * 53) % 70);
        if (bx > right) break;
        const by = wy + 16 + ((i * 37) % 5) * 15;
        const len = 20 + ((i * 29) % 30) + Math.sin(this.time * 2 + i) * 8;
        c.moveTo(bx - len / 2, by);
        c.lineTo(bx + len / 2, by);
      }
      c.stroke();
    }
  }

  private dome(c: CanvasRenderingContext2D, g: Game, d: { team: number; x: number; y: number; charges: number }): void {
    const col = g.teams[d.team].color;
    const pulse = 0.5 + Math.sin(this.time * 3) * 0.5;
    const gr = c.createRadialGradient(d.x, d.y, DOME_R * 0.55, d.x, d.y, DOME_R);
    gr.addColorStop(0, 'rgba(120,200,255,0)');
    gr.addColorStop(1, 'rgba(120,200,255,.13)');
    c.fillStyle = gr;
    c.beginPath();
    c.arc(d.x, d.y, DOME_R, 0, 6.3);
    c.fill();
    c.strokeStyle = col;
    c.globalAlpha = 0.35 + pulse * 0.25;
    c.lineWidth = 2;
    c.setLineDash([14, 10]);
    c.lineDashOffset = -this.time * 22;
    c.stroke();
    c.setLineDash([]);
    c.globalAlpha = 1;
    c.lineWidth = 1.2;
    c.strokeStyle = OL;
    for (let i = 0; i < 3; i++) {
      c.save();
      c.translate(d.x - 6 + i * 6, d.y + 2);
      c.rotate(-0.3 + i * 0.3);
      c.globalAlpha = i < d.charges ? 1 : 0.25;
      c.fillStyle = '#cbd5e1';
      c.beginPath();
      c.roundRect(-2, -17, 4, 16, 1.5);
      c.fill();
      c.stroke();
      c.fillStyle = col;
      c.fillRect(-2, -17, 4, 3);
      c.restore();
    }
    c.globalAlpha = 1;
    c.fillStyle = '#475569';
    c.beginPath();
    c.roundRect(d.x - 11, d.y + 1, 22, 8, 2);
    c.fill();
    c.stroke();
  }

  private human(c: CanvasRenderingContext2D, g: Game, h: Human, dt: number): void {
    const isActive = h.id === g.activeId && (g.phase === 'aim' || g.phase === 'retreat');
    const w = g.weapon();
    let sd = this.strides.get(h.id);
    if (!sd) this.strides.set(h.id, (sd = { phase: h.walkPhase, v: 0, sq: 0, rec: 0, spin: 0, wasG: h.grounded }));
    if (sd.phase !== h.walkPhase) {
      if (!this.silent && Math.floor(sd.phase / Math.PI) !== Math.floor(h.walkPhase / Math.PI)) realSfx.step();
      sd.v = Math.min(1, sd.v + dt * 10);
      sd.phase = h.walkPhase;
    } else sd.v = Math.max(0, sd.v - dt * 7);
    // aplastarse al aterrizar, estirarse al saltar, retroceso al disparar, voltereta al salir volando
    if (h.grounded && !sd.wasG) {
      sd.sq = 0.34;
      this.spray(h.x, h.y + 8, 5, 46, 0, () => ({ kind: 3, life: 0.35, s0: 2.6, s1: 4.6, drag: 3, color: '#b9a48c', c2: '#e2d3bf' }));
    } else if (!h.grounded && sd.wasG) sd.sq = -0.2;
    sd.wasG = h.grounded;
    sd.sq *= Math.exp(-dt * 9);
    sd.rec *= Math.exp(-dt * 9);
    if (!h.grounded && h.knocked) sd.spin += dt * Math.sign(h.vx || 1) * (5 + Math.hypot(h.vx, h.vy) / 55);
    else sd.spin = 0;

    if (h.grounded) {
      c.fillStyle = 'rgba(20,6,30,.3)';
      c.beginPath();
      c.ellipse(h.x, h.y + 9, 10, 2.6, 0, 0, 6.3);
      c.fill();
    }
    if (h.jet && h.thrusting && dt > 0) {
      this.p({ x: h.x - h.facing * 9, y: h.y + 6, vx: (Math.random() - 0.5) * 30, vy: 120, spr: S_FIRE, add: true, life: 0.25, s0: 6, s1: 1 });
      if (Math.random() < 0.5) this.p({ x: h.x - h.facing * 9, y: h.y + 12, vy: 60, spr: S_SMOKE, life: 0.7, s0: 4, s1: 12, alpha: 0.5 });
    }
    if (!h.avatar) return;
    const aiming = isActive && g.phase === 'aim' && !h.jet;
    c.save();
    c.translate(h.x - h.facing * sd.rec * 3.5, h.y + 8.6);
    if (sd.spin) {
      c.translate(0, -20);
      c.rotate(sd.spin);
      c.translate(0, 20);
    } else c.rotate(-h.facing * (sd.rec * 0.2 + (aiming ? h.elev * 0.07 : 0)));
    c.scale(HUMAN_K * (1 + sd.sq * 0.5), HUMAN_K * (1 - sd.sq));
    c.translate(0, -8);
    drawAvatar(c, h.avatar, {
      facing: h.facing,
      walk: h.walkPhase,
      stride: sd.v,
      aim: aiming ? h.elev : null,
      tool: h.jet ? 'jet' : aiming && w.kind !== 'skip' && w.kind !== 'jetpack' ? w.id : 'none',
      hurt: h.hurtT > 0 || h.hp <= 0,
      air: !h.grounded,
      thrust: h.thrusting,
      t: this.time,
    });
    c.restore();
    if (h.hurtT > 0.36) {
      c.globalCompositeOperation = 'lighter';
      c.globalAlpha = (h.hurtT - 0.36) * 6;
      c.drawImage(this.sprites[S_WHITE], h.x - 26, h.y - 34, 52, 52);
      c.globalAlpha = 1;
      c.globalCompositeOperation = 'source-over';
    }
  }

  private drawProps(c: CanvasRenderingContext2D, g: Game): void {
    const left = this.cam.x - this.vw / 2 / this.cam.zoom - 90;
    const right = this.cam.x + this.vw / 2 / this.cam.zoom + 90;
    for (let i = this.props.length - 1; i >= 0; i--) {
      const p = this.props[i];
      if (!g.terrain.solid(p.x, p.y + 3)) {
        // el suelo debajo desapareció: el objeto vuela en pedazos
        this.props.splice(i, 1);
        const cols = p.kind === 'lamp' || p.kind === 'sign' ? ['#3a3252', '#8b93a3'] : p.kind === 'hydrant' || p.kind === 'phonebox' ? ['#ef4444', '#b91c1c'] : ['#39a83f', '#74d85a', '#6b4a34'];
        this.spray(p.x, p.y - 26 * p.k, 16, 190, 130, () => ({ kind: 1, life: 0.9 + Math.random() * 0.8, g: 1, s0: 1.8 + Math.random() * 2.6, color: cols[Math.floor(Math.random() * cols.length)], rot: Math.random() * 6, vr: (Math.random() - 0.5) * 18 }));
        continue;
      }
      if (p.x < left || p.x > right) continue;
      const spr = this.propSpr.get(p.kind);
      if (spr) drawProp(c, p, spr, this.time, g.wind);
      if (p.kind === 'lamp') {
        const [lx, ly] = lampLight(p);
        c.globalCompositeOperation = 'lighter';
        c.globalAlpha = 0.3;
        c.drawImage(this.sprites[S_EMBER], lx - 14, ly - 12, 28, 28);
        c.globalAlpha = 1;
        c.globalCompositeOperation = 'source-over';
      }
    }
  }

  /** Resplandor selectivo: solo lo que emite luz se dibuja en un buffer a 1/4 y se suma agrandado. */
  private drawGlow(c: CanvasRenderingContext2D, shx: number, shy: number, z: number): void {
    const g = this.gctx;
    const q = this.glowCv.width / this.vw;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, this.glowCv.width, this.glowCv.height);
    g.setTransform(q * z, 0, 0, q * z, (this.vw / 2 + shx) * q - this.cam.x * z * q, (this.vh / 2 + shy) * q - this.cam.y * z * q);
    g.globalCompositeOperation = 'lighter';
    let any = false;
    for (const p of this.parts) {
      if (p.kind === 0 && p.add) {
        const size = (p.s1 + (p.s0 - p.s1) * (p.life / p.max)) * 2.2;
        g.globalAlpha = Math.min(1, (p.life / p.max) * 1.8) * p.alpha;
        g.drawImage(this.sprites[p.spr], p.x - size, p.y - size, size * 2, size * 2);
        any = true;
      } else if (p.kind === 3 && p.s1 === 0) {
        const size = (p.s0 * p.life) / p.max * 3;
        g.globalAlpha = 0.6;
        g.drawImage(this.sprites[S_EMBER], p.x - size, p.y - size, size * 2, size * 2);
        any = true;
      }
    }
    g.lineCap = 'round';
    for (const b of this.beams) {
      g.globalAlpha = b.life / b.max;
      g.strokeStyle = b.color;
      g.lineWidth = b.w * 3;
      g.beginPath();
      g.moveTo(b.x, b.y);
      g.lineTo(b.x2, b.y2);
      g.stroke();
      any = true;
    }
    g.globalAlpha = 0.3;
    const left = this.cam.x - this.vw / 2 / z - 80, right = this.cam.x + this.vw / 2 / z + 80;
    for (const p of this.props) {
      if (p.kind !== 'lamp' || p.x < left || p.x > right) continue;
      const [lx, ly] = lampLight(p);
      g.drawImage(this.sprites[S_EMBER], lx - 38, ly - 28, 76, 76);
      any = true;
    }
    g.globalAlpha = 1;
    if (!any) return;
    c.globalCompositeOperation = 'lighter';
    c.globalAlpha = 0.8;
    c.imageSmoothingEnabled = true;
    c.imageSmoothingQuality = 'low'; // 'high' al agrandar 4x cae en un camino lento del navegador
    c.drawImage(this.glowCv, 0, 0, this.vw, this.vh);
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
  }

  private label(c: CanvasRenderingContext2D, g: Game, h: Human): void {
    const isActive = h.id === g.activeId && (g.phase === 'aim' || g.phase === 'retreat');
    const team = g.teams[h.team];
    const flag = h.avatar ? (COUNTRY_BY_CODE[h.avatar.country]?.flag ?? '') : '';
    const ly = h.y - 56;
    c.font = `700 9.5px ${FONT}`;
    const label = `${flag} ${h.name}`;
    const hp = String(Math.max(0, h.hp));
    const tw = c.measureText(label).width;
    c.font = `800 9.5px ${FONT}`;
    const hw2 = c.measureText(hp).width;
    const W = tw + hw2 + 17;
    const x0 = h.x - W / 2;
    c.fillStyle = 'rgba(16,10,36,.78)';
    c.beginPath();
    c.roundRect(x0, ly - 9, W, 17, 6);
    c.fill();
    if (isActive) {
      c.strokeStyle = team.color;
      c.lineWidth = 1.4;
      c.stroke();
    }
    c.textAlign = 'left';
    c.font = `700 9.5px ${FONT}`;
    c.fillStyle = '#fff';
    c.fillText(label, x0 + 5, ly + 1);
    c.font = `800 9.5px ${FONT}`;
    c.fillStyle = team.color;
    c.fillText(hp, x0 + tw + 11, ly + 1);
    c.fillStyle = 'rgba(255,255,255,.16)';
    c.beginPath();
    c.roundRect(x0 + 5, ly + 3.6, W - 10, 2.6, 1.3);
    c.fill();
    c.fillStyle = h.hp > 50 ? team.color : h.hp > 25 ? '#ffb23e' : '#ff5d6c';
    c.beginPath();
    c.roundRect(x0 + 5, ly + 3.6, (W - 10) * Math.max(0.03, Math.min(1, h.hp / 100)), 2.6, 1.3);
    c.fill();
    if (isActive) {
      const by = ly - 16 + Math.sin(this.time * 6) * 3;
      c.fillStyle = team.color;
      c.strokeStyle = OL;
      c.lineWidth = 1.5;
      c.beginPath();
      c.moveTo(h.x - 7, by - 8);
      c.lineTo(h.x + 7, by - 8);
      c.lineTo(h.x, by + 1);
      c.closePath();
      c.fill();
      c.stroke();
      if (h.jet) {
        c.fillStyle = 'rgba(16,10,36,.7)';
        c.beginPath();
        c.roundRect(h.x - 17, h.y + 16, 34, 5, 2.5);
        c.fill();
        c.fillStyle = '#ffb23e';
        c.beginPath();
        c.roundRect(h.x - 16, h.y + 17, 32 * Math.max(0.02, h.jetFuel / 2.6), 3, 1.5);
        c.fill();
      }
    }
  }

  private cross(c: CanvasRenderingContext2D, x: number, y: number, r: number, col: string): void {
    for (const [cc, lw] of [[OL, 4.4], [col, 2]] as [string, number][]) {
      c.strokeStyle = cc;
      c.lineWidth = lw;
      c.beginPath();
      c.arc(x, y, r, 0, 6.3);
      c.moveTo(x - r - 6, y); c.lineTo(x - r * 0.45, y);
      c.moveTo(x + r * 0.45, y); c.lineTo(x + r + 6, y);
      c.moveTo(x, y - r - 6); c.lineTo(x, y - r * 0.45);
      c.moveTo(x, y + r * 0.45); c.lineTo(x, y + r + 6);
      c.stroke();
    }
  }

  private aimOverlay(c: CanvasRenderingContext2D, g: Game): void {
    const a = g.active();
    if (!a || !this.showAim || g.phase !== 'aim') return;
    const w = g.weapon();
    if (w.kind === 'target' || w.kind === 'beam' || w.id === 'homing') {
      const locked = g.hasTarget && w.id === 'homing';
      const tx = locked ? g.tx : this.mouse.x;
      const ty = locked ? g.ty : this.mouse.y;
      if (this.mouse.inside || locked) {
        const rr = 13 + Math.sin(this.time * 8) * 2;
        if (w.kind !== 'launch') {
          const gr = c.createLinearGradient(0, ty, 0, ty - 700);
          gr.addColorStop(0, 'rgba(255,93,108,.5)');
          gr.addColorStop(1, 'rgba(255,93,108,0)');
          c.fillStyle = gr;
          c.fillRect(tx - 1.5, ty - 700, 3, 700 - rr);
        }
        this.cross(c, tx, ty, rr, '#ff5d6c');
      }
    }
    if ((w.kind === 'launch' || w.kind === 'hitscan') && !a.jet) {
      const [dx, dy] = g.aimDir(a);
      const [mx, my] = g.muzzle(a);
      if (g.charging) {
        const L = 10 + g.power * 74;
        const px = -dy, py = dx;
        const wd = 2.5 + g.power * 7;
        const gr = c.createLinearGradient(mx, my, mx + dx * 84, my + dy * 84);
        gr.addColorStop(0, '#fff3b0');
        gr.addColorStop(0.5, '#ffb23e');
        gr.addColorStop(1, '#ff3d5a');
        c.beginPath();
        c.moveTo(mx + dx * 4, my + dy * 4);
        c.lineTo(mx + dx * L + px * wd, my + dy * L + py * wd);
        c.lineTo(mx + dx * L - px * wd, my + dy * L - py * wd);
        c.closePath();
        c.fillStyle = gr;
        c.fill();
        c.strokeStyle = OL;
        c.lineWidth = 1.4;
        c.stroke();
      } else {
        for (let i = 1; i <= 5; i++) {
          c.fillStyle = OL;
          c.beginPath();
          c.arc(mx + dx * (6 + i * 9), my + dy * (6 + i * 9), 2.3, 0, 6.3);
          c.fill();
          c.fillStyle = '#fff';
          c.beginPath();
          c.arc(mx + dx * (6 + i * 9), my + dy * (6 + i * 9), 1.4, 0, 6.3);
          c.fill();
        }
      }
      this.cross(c, mx + dx * 96, my + dy * 96, 6, '#fff');
    }
  }

  private drawBeams(c: CanvasRenderingContext2D, dt: number): void {
    c.globalCompositeOperation = 'lighter';
    c.lineCap = 'round';
    for (const b of this.beams) {
      const a = b.life / b.max;
      for (const [k, col, al] of [[2.4, b.color, 0.35], [1, b.color, 0.9], [0.35, '#ffffff', 1]] as [number, string, number][]) {
        c.globalAlpha = a * al;
        c.strokeStyle = col;
        c.lineWidth = Math.max(0.8, b.w * k * (0.3 + a * 0.7));
        c.beginPath();
        c.moveTo(b.x, b.y);
        c.lineTo(b.x2, b.y2);
        c.stroke();
      }
      b.life -= dt;
    }
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
    this.beams = this.beams.filter((b) => b.life > 0);
  }

  private drawParts(c: CanvasRenderingContext2D, dt: number): void {
    for (const p of this.parts) {
      p.life -= dt;
      p.vy += 520 * p.g * dt;
      if (p.drag) { const k = Math.exp(-p.drag * dt); p.vx *= k; p.vy *= k; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
    }
    this.parts = this.parts.filter((p) => p.life > 0);
    if (this.parts.length > 1400) this.parts.splice(0, this.parts.length - 1400);
    // bocanadas: primero todas en oscuro un poco más grandes (contorno común), después el relleno
    const puffR = (p: Part) => { const k = p.life / p.max; return Math.max(0, p.s1 + (p.s0 - p.s1) * k); };
    const puffA = (p: Part) => (p.s1 > 0 ? Math.min(1, (p.life / p.max) * 2.4) : 1);
    // bocanadas ilustradas (humo y fuego de explosión); el polvo sigue con círculos
    const smokeIm = art('smoke'), fireIm = art('fire');
    const illustrated = (p: Part) => !!smokeIm && !!fireIm && (p.s1 === 0 || p.color === '#463a58');
    c.imageSmoothingEnabled = true;
    c.imageSmoothingQuality = 'low';
    for (let pass = 0; pass < 2; pass++) for (const p of this.parts) {
      if (p.kind !== 3 || !illustrated(p) || (p.s1 === 0) !== (pass === 1)) continue;
      const r = puffR(p) * (pass ? 1.5 : 1.35);
      if (r < 0.8) continue;
      c.globalAlpha = pass ? Math.min(1, (p.life / p.max) * 3) : puffA(p) * 0.92;
      c.save();
      c.translate(p.x, p.y);
      c.rotate((p.max * 37) % 6.283 + (pass ? 0 : (1 - p.life / p.max) * 0.6));
      c.drawImage(pass ? fireIm! : smokeIm!, -r, -r, r * 2, r * 2);
      c.restore();
    }
    c.fillStyle = OL;
    for (const p of this.parts) {
      if (p.kind !== 3 || illustrated(p)) continue;
      const r = puffR(p);
      if (r < 0.6) continue;
      c.globalAlpha = puffA(p) * 0.9;
      c.beginPath();
      c.arc(p.x, p.y, r + 1.3, 0, 6.3);
      c.fill();
    }
    for (const p of this.parts) {
      if (p.kind !== 3 || illustrated(p)) continue;
      const r = puffR(p);
      if (r < 0.6) continue;
      c.globalAlpha = puffA(p);
      c.fillStyle = p.color;
      c.beginPath();
      c.arc(p.x, p.y, r, 0, 6.3);
      c.fill();
      c.fillStyle = p.c2;
      c.beginPath();
      c.arc(p.x + r * 0.14, p.y - r * 0.2, r * 0.66, 0, 6.3);
      c.fill();
    }
    c.globalAlpha = 1;
    for (let pass = 0; pass < 2; pass++) {
      c.globalCompositeOperation = pass ? 'lighter' : 'source-over';
      for (const p of this.parts) {
        if (p.add !== !!pass || p.kind === 3) continue;
        const k = p.life / p.max;
        if (p.kind === 0) {
          const size = p.s1 + (p.s0 - p.s1) * k;
          c.globalAlpha = Math.min(1, k * 1.8) * p.alpha;
          c.drawImage(this.sprites[p.spr], p.x - size, p.y - size, size * 2, size * 2);
        } else if (p.kind === 1) {
          c.globalAlpha = Math.min(1, k * 3);
          c.save();
          c.translate(p.x, p.y);
          c.rotate(p.rot);
          c.beginPath();
          c.moveTo(-p.s0, p.s0 * 0.7);
          c.lineTo(p.s0 * 0.9, p.s0 * 0.5);
          c.lineTo(p.s0 * 0.5, -p.s0 * 0.6);
          c.lineTo(-p.s0 * 0.4, -p.s0 * 0.8);
          c.closePath();
          c.fillStyle = p.color;
          c.fill();
          c.lineJoin = 'round';
          c.lineWidth = 1;
          c.strokeStyle = OL;
          c.stroke();
          c.restore();
        } else {
          c.globalAlpha = Math.min(1, k * 2.5);
          c.strokeStyle = p.color;
          c.lineWidth = p.s0;
          c.lineCap = 'round';
          c.beginPath();
          c.moveTo(p.x, p.y);
          c.lineTo(p.x - p.vx * 0.035, p.y - p.vy * 0.035);
          c.stroke();
        }
      }
    }
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
  }

  private drawRings(c: CanvasRenderingContext2D, dt: number): void {
    for (const r of this.rings) {
      r.life -= dt * (r.flash ? 4.5 : r.star !== undefined ? 3 : 2.4);
      if (r.life <= 0) continue;
      const k = 1 - r.life;
      if (r.star !== undefined) {
        if (r.life < 0.55) continue;
        const q = (1 - r.life) / 0.45;
        const R = r.r * (0.45 + q * 0.75);
        c.globalAlpha = 1 - q * q;
        c.beginPath();
        for (let i = 0; i < 22; i++) {
          const a = r.star + (i / 22) * 6.283;
          const rr = i % 2 ? R * (0.55 + ((i * 7) % 5) * 0.04) : R * (0.95 + ((i * 13) % 7) * 0.05);
          if (i) c.lineTo(r.x + Math.cos(a) * rr, r.y + Math.sin(a) * rr);
          else c.moveTo(r.x + Math.cos(a) * rr, r.y + Math.sin(a) * rr);
        }
        c.closePath();
        c.fillStyle = '#fff6c8';
        c.fill();
        c.lineJoin = 'round';
        c.lineWidth = 2.5;
        c.strokeStyle = '#ffb23e';
        c.stroke();
      } else if (r.flash) {
        c.globalCompositeOperation = 'lighter';
        c.globalAlpha = r.life;
        const rad = r.r * (0.7 + k * 0.6);
        c.drawImage(this.sprites[S_FIRE], r.x - rad * 1.5, r.y - rad * 1.5, rad * 3, rad * 3);
        c.globalCompositeOperation = 'source-over';
      } else {
        c.globalAlpha = r.life * 0.7;
        c.strokeStyle = '#fff';
        c.lineWidth = 1 + r.life * 5;
        c.beginPath();
        c.arc(r.x, r.y, r.r * (0.3 + k * 0.9), 0, 6.3);
        c.stroke();
      }
    }
    c.globalAlpha = 1;
    this.rings = this.rings.filter((r) => r.life > 0);
  }

  private drawFloats(c: CanvasRenderingContext2D, dt: number): void {
    c.textAlign = 'center';
    c.lineJoin = 'round';
    for (const f of this.floats) {
      f.life -= dt;
      const age = f.max - f.life;
      f.y -= (age < 0.25 ? 90 : 16) * dt;
      const pop = age < 0.18 ? 0.6 + (age / 0.18) * 0.6 : age < 0.3 ? 1.2 - ((age - 0.18) / 0.12) * 0.2 : 1;
      c.globalAlpha = Math.max(0, Math.min(1, f.life * 2));
      c.font = `900 ${f.size * pop}px ${FONT}`;
      c.lineWidth = 4;
      c.strokeStyle = OL;
      c.strokeText(f.text, f.x, f.y);
      c.fillStyle = f.color;
      c.fillText(f.text, f.x, f.y);
    }
    c.globalAlpha = 1;
    this.floats = this.floats.filter((f) => f.life > 0);
  }

  private drawBanner(c: CanvasRenderingContext2D, dt: number): void {
    if (this.banner.life <= 0 || this.silent) return;
    const { vw, vh } = this;
    this.banner.life -= dt;
    const age = this.banner.max - this.banner.life;
    const inn = Math.min(1, age / 0.25);
    const al = Math.max(0, Math.min(1, this.banner.life * 2.5)) * inn;
    c.save();
    c.globalAlpha = al;
    c.translate(vw / 2 - (1 - inn) * (1 - inn) * 60, vh * 0.2);
    c.transform(1, 0, -0.14, 1, 0, 0);
    c.font = `900 36px ${FONT}`;
    const w = Math.max(240, c.measureText(this.banner.text).width + 150);
    const gr = c.createLinearGradient(-w / 2, 0, w / 2, 0);
    gr.addColorStop(0, 'rgba(16,10,36,0)');
    gr.addColorStop(0.2, 'rgba(16,10,36,.82)');
    gr.addColorStop(0.8, 'rgba(16,10,36,.82)');
    gr.addColorStop(1, 'rgba(16,10,36,0)');
    c.fillStyle = gr;
    c.fillRect(-w / 2, -34, w, 66);
    c.fillStyle = '#ffb23e';
    c.fillRect(-w * 0.3, -34, w * 0.6, 2.5);
    c.textAlign = 'center';
    c.fillStyle = '#fff';
    c.fillText(this.banner.text, 0, 6);
    c.font = `800 12px ${FONT}`;
    c.fillStyle = '#ffb23e';
    c.fillText(this.banner.sub.toUpperCase(), 0, 24);
    c.restore();
  }

  private proj(c: CanvasRenderingContext2D, p: Proj, dt: number): void {
    const ang = Math.atan2(p.vy, p.vx);
    const s = p.def.sprite;
    if (dt > 0) {
      if (s === 'rocket' || s === 'homing') {
        const bx = p.x - Math.cos(ang) * 11, by = p.y - Math.sin(ang) * 11;
        this.p({ x: bx, y: by, spr: s === 'homing' ? S_BLUE : S_FIRE, add: true, life: 0.2, s0: 7, s1: 1.5 });
        if (Math.random() < dt * 55) this.p({ kind: 3, x: bx, y: by, vx: (Math.random() - 0.5) * 16, vy: (Math.random() - 0.5) * 16 - 8, life: 0.75 + Math.random() * 0.4, s0: 2.6, s1: 5.5 + Math.random() * 2, color: '#b9b0c8', c2: '#ece8f4' });
      } else if (s === 'orbital') {
        for (let i = 0; i < 2; i++) this.p({ x: p.x + (Math.random() - 0.5) * 8, y: p.y - 30, vy: -80 - Math.random() * 80, spr: S_FIRE, add: true, life: 0.32, s0: 15, s1: 3 });
        if (Math.random() < dt * 40) this.p({ kind: 3, x: p.x + (Math.random() - 0.5) * 10, y: p.y - 44, vy: -30, life: 1.3, s0: 6, s1: 15, color: '#b9b0c8', c2: '#ece8f4' });
      }
    }
    if (dt > 0 && s === 'battery') {
      if (Math.random() < dt * 30) this.p({ x: p.x, y: p.y - 12, vx: (Math.random() - 0.5) * 20, vy: -34, spr: S_SMOKE, life: 0.9, s0: 3, s1: 10, alpha: 0.6 });
      if (p.fuse < 1.5 && Math.random() < dt * 40) this.p({ kind: 2, x: p.x, y: p.y - 4, vx: (Math.random() - 0.5) * 160, vy: -Math.random() * 160, life: 0.3, add: true, color: '#fff3b0', s0: 1.2, g: 0.6 });
    }
    c.save();
    c.translate(p.x, p.y);
    drawProjectile(c, { sprite: s, vx: p.vx, vy: p.vy, age: p.age, fuse: p.fuse, dir: p.dir }, this.time);
    if (p.def.mode === 'timed') {
      const blink = Math.floor(p.fuse * (p.fuse < 1.5 ? 8 : 3)) % 2 === 0;
      const tx = String(Math.max(1, Math.ceil(p.fuse)));
      c.font = `900 12px ${FONT}`;
      c.textAlign = 'center';
      c.lineJoin = 'round';
      c.lineWidth = 3.4;
      c.strokeStyle = OL;
      c.strokeText(tx, 0, -19);
      c.fillStyle = blink ? '#ff8a9a' : '#fff';
      c.fillText(tx, 0, -19);
    }
    c.restore();
  }
}

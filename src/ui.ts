import { coreReady } from './art.ts';
import {
  COUNTRIES, COUNTRY_BY_CODE, SKINS, HAIR_COLORS, COLORS,
  drawAvatar, randomAvatar, randomName, type AvatarSpec,
} from './avatar.ts';
import { sfx, initAudio } from './audio.ts';
import { CITY_IDS } from './backdrop.ts';
import { t, tl, LANGS, getLang, setLang, countryName } from './i18n.ts';

export interface SavedMember { name: string; avatar: AvatarSpec }
export interface SavedTeam { name: string; members: SavedMember[] }
export interface MatchOpts { difficulty: number; size: number; city: string }

const KEY = 'bardo.team.v1';

export function randomTeam(name: string, n: number, sameCountry: boolean): SavedTeam {
  const c = COUNTRIES[Math.floor(Math.random() * COUNTRIES.length)].code;
  const members: SavedMember[] = [];
  for (let i = 0; i < n; i++) {
    const avatar = randomAvatar(Math.random, sameCountry ? c : undefined);
    let nm = randomName(Math.random, avatar.country);
    for (let k = 0; k < 8 && members.some((m) => m.name === nm); k++) nm = randomName(Math.random, avatar.country);
    members.push({ name: nm, avatar });
  }
  return { name, members };
}

export function loadTeam(): SavedTeam {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const t = JSON.parse(raw) as SavedTeam;
      if (t && Array.isArray(t.members) && t.members.length === 4 && t.members.every((m) => m.avatar && typeof m.name === 'string')) return t;
    }
  } catch { /* sin storage: seguimos con uno aleatorio */ }
  return randomTeam(t('team.default'), 4, false);
}
export function saveTeam(t: SavedTeam): void {
  try { localStorage.setItem(KEY, JSON.stringify(t)); } catch { /* ignorar */ }
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

/** Pinta una miniatura y la vuelve a pintar cuando termina de cargar el arte en imágenes. */
function paintLive(cv: HTMLCanvasElement, a: AvatarSpec, scale: number): void {
  paint(cv, a, scale, 0);
  if (coreReady()) return;
  const again = () => {
    if (!cv.isConnected) window.removeEventListener('artload', again);
    else paint(cv, a, scale, 0);
  };
  window.addEventListener('artload', again);
}

function paint(cv: HTMLCanvasElement, a: AvatarSpec, scale: number, walk: number): void {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = cv.clientWidth || cv.width, h = cv.clientHeight || cv.height;
  if (cv.width !== w * dpr) { cv.width = w * dpr; cv.height = h * dpr; }
  const c = cv.getContext('2d')!;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, w, h);
  scale = Math.min(w / 30, h / 44); // la figura ocupa ~44 unidades de alto con sombrero
  const cy = h / 2 + scale * 10;
  c.fillStyle = 'rgba(0,0,0,.25)';
  c.beginPath();
  c.ellipse(w / 2, cy + 9.6 * scale, 9 * scale, 2 * scale, 0, 0, 6.3);
  c.fill();
  c.save();
  c.translate(w / 2, cy);
  c.scale(scale, scale);
  drawAvatar(c, a, { facing: 1, walk, stride: walk ? 1 : 0, aim: null, tool: 'none', hurt: false, air: false, thrust: false, t: walk / 7 });
  c.restore();
}

export class Menu {
  root: HTMLElement;
  team: SavedTeam;
  onStart: (o: MatchOpts) => void = () => {};
  onHome: () => void = () => {};
  private raf = 0;
  private opts: MatchOpts = { difficulty: 1, size: 4, city: 'random' };

  constructor(root: HTMLElement) {
    this.root = root;
    this.team = loadTeam();
  }

  clear(): void {
    cancelAnimationFrame(this.raf);
    this.root.innerHTML = '';
    this.root.className = '';
  }

  private btn(text: string, cls: string, fn: () => void): HTMLButtonElement {
    const b = el('button', cls, text);
    b.onclick = () => { initAudio(); sfx.click(); fn(); };
    return b;
  }

  home(): void {
    this.clear();
    this.root.className = 'screen home';
    const box = el('div', 'panel hero');
    box.append(el('div', 'kicker', t('home.kicker')));
    const h = el('h1', 'logo');
    h.innerHTML = 'BARDO<span>MUNDIAL</span>';
    box.append(h);
    box.append(el('p', 'tag', t('home.tag')));
    const row = el('div', 'squad');
    this.team.members.forEach((m) => {
      const cv = el('canvas', 'mini');
      row.append(cv);
      requestAnimationFrame(() => paintLive(cv, m.avatar, 2.6));
    });
    box.append(row);
    const btns = el('div', 'col');
    btns.append(this.btn(t('home.play'), 'big primary', () => this.setup()));
    btns.append(this.btn(t('home.edit'), 'big', () => this.editor()));
    const online = el('button', 'big ghost', t('home.online'));
    online.disabled = true;
    btns.append(online);
    box.append(btns);
    const langs = el('div', 'chips langs');
    for (const l of LANGS) langs.append(this.btn(l.label, 'chip' + (getLang() === l.id ? ' on' : ''), () => { setLang(l.id); this.home(); }));
    box.append(langs);
    this.root.append(box);
  }

  setup(): void {
    this.clear();
    this.root.className = 'screen';
    const box = el('div', 'panel');
    box.append(el('h2', '', t('setup.title')));
    const group = (label: string, items: string[], get: () => number, set: (i: number) => void) => {
      box.append(el('label', 'lbl', label));
      const row = el('div', 'chips');
      items.forEach((t, i) => {
        const b = this.btn(t, 'chip' + (get() === i ? ' on' : ''), () => {
          set(i);
          [...row.children].forEach((c, k) => c.classList.toggle('on', k === i));
        });
        row.append(b);
      });
      box.append(row);
    };
    group(t('setup.diff'), tl('diffs'), () => this.opts.difficulty, (i) => (this.opts.difficulty = i));
    group(t('setup.size'), ['2', '3', '4'], () => this.opts.size - 2, (i) => (this.opts.size = i + 2));
    group(t('setup.city'), [t('setup.random'), ...tl('cities')], () => CITY_IDS.indexOf(this.opts.city) + 1, (i) => (this.opts.city = i === 0 ? 'random' : CITY_IDS[i - 1]));
    const help = el('div', 'help');
    help.innerHTML = t('setup.help');
    box.append(help);
    const row = el('div', 'row');
    row.append(this.btn(t('setup.back'), '', () => { this.home(); }));
    row.append(this.btn(t('setup.go'), 'primary', () => { this.clear(); this.onStart({ ...this.opts }); }));
    box.append(row);
    this.root.append(box);
  }

  editor(): void {
    this.clear();
    this.root.className = 'screen';
    let sel = 0;
    const box = el('div', 'panel editor');
    const left = el('div', 'ed-left');
    const right = el('div', 'ed-right');
    box.append(left, right);

    left.append(el('h2', '', t('ed.title')));
    const tname = el('input', 'txt');
    tname.value = this.team.name;
    tname.maxLength = 18;
    tname.oninput = () => (this.team.name = tname.value || t('team.default'));
    left.append(tname);
    const cards = el('div', 'cards');
    left.append(cards);
    const big = el('canvas', 'bigprev');
    left.append(big);
    const lrow = el('div', 'row');
    lrow.append(this.btn(t('ed.random'), '', () => { this.team = randomTeam(this.team.name, 4, false); render(); }));
    lrow.append(this.btn(t('ed.save'), 'primary', () => { saveTeam(this.team); this.home(); }));
    left.append(lrow);

    const render = () => {
      const m = this.team.members[sel];
      const a = m.avatar;
      cards.innerHTML = '';
      this.team.members.forEach((mm, i) => {
        const card = el('button', 'card' + (i === sel ? ' on' : ''));
        const cv = el('canvas', 'mini');
        card.append(cv, el('span', '', `${COUNTRY_BY_CODE[mm.avatar.country]?.flag ?? ''} ${mm.name}`));
        card.onclick = () => { sel = i; sfx.click(); render(); };
        cards.append(card);
        requestAnimationFrame(() => paintLive(cv, mm.avatar, 2.2));
      });

      right.innerHTML = '';
      const top = el('div', 'row wrap');
      const name = el('input', 'txt');
      name.value = m.name;
      name.maxLength = 12;
      name.placeholder = t('ed.name');
      name.oninput = () => {
        m.name = name.value.trim() || t('ed.noname');
        const span = cards.children[sel]?.querySelector('span');
        if (span) span.textContent = `${COUNTRY_BY_CODE[a.country]?.flag ?? ''} ${m.name}`;
      };
      top.append(name);
      const mkSelect = (items: string[], value: number, on: (i: number) => void) => {
        const s = el('select', 'txt');
        items.forEach((t, i) => { const o = el('option', '', t); o.value = String(i); s.append(o); });
        s.value = String(value);
        s.onchange = () => { on(Number(s.value)); render(); };
        return s;
      };
      top.append(mkSelect(COUNTRIES.map((c) => `${c.flag} ${countryName(c.code, c.name)}`), Math.max(0, COUNTRIES.findIndex((c) => c.code === a.country)), (i) => (a.country = COUNTRIES[i].code)));
      top.append(mkSelect(tl('identities'), a.identity, (i) => (a.identity = i)));
      top.append(this.btn('🎲', 'sq', () => {
        const keep = a.country;
        m.avatar = randomAvatar(Math.random, keep);
        render();
      }));
      right.append(top);

      const chips = (label: string, items: string[], key: keyof AvatarSpec) => {
        right.append(el('label', 'lbl', label));
        const row = el('div', 'chips');
        items.forEach((t, i) => row.append(this.btn(t, 'chip' + (a[key] === i ? ' on' : ''), () => { (a[key] as number) = i; render(); })));
        right.append(row);
      };
      const swatches = (label: string, cols: string[], key: keyof AvatarSpec) => {
        right.append(el('label', 'lbl', label));
        const row = el('div', 'chips');
        cols.forEach((col, i) => {
          const b = this.btn('', 'sw' + (a[key] === i ? ' on' : ''), () => { (a[key] as number) = i; render(); });
          b.style.background = col;
          b.setAttribute('aria-label', `${label} ${i + 1}`);
          row.append(b);
        });
        right.append(row);
      };
      swatches(t('ed.skin'), SKINS, 'skin');
      chips(t('ed.body'), tl('bodies'), 'body');
      chips(t('ed.hair'), tl('hairs'), 'hair');
      swatches(t('ed.hairColor'), HAIR_COLORS, 'hairColor');
      chips(t('ed.face'), tl('faces'), 'face');
      chips(t('ed.top'), tl('tops'), 'top');
      swatches(t('ed.topColor'), COLORS, 'topColor');
      chips(t('ed.bottom'), tl('bottoms'), 'bottom');
      swatches(t('ed.bottomColor'), COLORS, 'bottomColor');
      chips(t('ed.acc'), tl('accs'), 'acc');
    };
    render();
    this.root.append(box);
    const t0 = performance.now();
    const loop = (now: number) => {
      const m = this.team.members[sel];
      if (m && big.isConnected) paint(big, m.avatar, 7, ((now - t0) / 1000) * 7);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  pause(onResume: () => void): void {
    this.clear();
    this.root.className = 'screen dim';
    const box = el('div', 'panel small');
    box.append(el('h2', '', t('pause.title')));
    const col = el('div', 'col');
    col.append(this.btn(t('pause.resume'), 'big primary', () => { this.clear(); onResume(); }));
    col.append(this.btn(t('pause.quit'), 'big', () => this.onHome()));
    box.append(col);
    this.root.append(box);
  }

  end(won: boolean, title: string, lines: string[]): void {
    this.clear();
    this.root.className = 'screen dim';
    const box = el('div', 'panel small');
    box.append(el('div', 'kicker', won ? t('end.victory') : t('end.over')));
    box.append(el('h2', won ? 'win' : 'lose', title));
    for (const l of lines) box.append(el('p', 'tag', l));
    const col = el('div', 'col');
    col.append(this.btn(t('end.rematch'), 'big primary', () => { this.clear(); this.onStart({ ...this.opts }); }));
    col.append(this.btn(t('end.menu'), 'big', () => this.onHome()));
    box.append(col);
    this.root.append(box);
  }
}

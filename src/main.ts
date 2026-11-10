import { drawAvatar, randomAvatar } from './avatar.ts';
import { preloadArt, CORE_ART, WEAPON_ART } from './art.ts';
import './style.css';
import { Game, DT, type Cmd, type TeamCfg } from './sim/game.ts';
import { Ai } from './sim/ai.ts';
import { WEAPONS } from './sim/weapons.ts';
import { View } from './render.ts';
import { weaponIcon } from './weaponArt.ts';
import { Menu, randomTeam, type MatchOpts } from './ui.ts';
import { initAudio, sfx, setMuted, isMuted, renderOffline } from './audio.ts';
import { t, tl, weaponName, weaponDesc } from './i18n.ts';
import { CITY_IDS } from './backdrop.ts';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const hud = document.getElementById('hud') as HTMLDivElement;
const view = new View(canvas);
preloadArt([...CORE_ART, ...WEAPON_ART, ...CITY_IDS.map((c) => 'bg_' + c)]);
const menu = new Menu(document.getElementById('ui') as HTMLElement);

let game: Game | null = null;
let ais: (Ai | null)[] = [];
let playing = false; // false = partida de fondo del menú
let paused = false;
let overT = -1;
let lastInput = '';
let lastTick = -1;
const keys = new Set<string>();

const CPU_NAMES = ['Los Algoritmos', 'Team Silicio', 'La Nube', 'Los Captcha', 'Ctrl+Z', 'Los 404'];

function humanTurn(): boolean {
  return !!game && playing && !paused && !game.teams[game.activeTeam].cpu && (game.phase === 'aim' || game.phase === 'retreat');
}
function send(c: Cmd): void {
  // Punto único de entrada de comandos: en la etapa online esto viaja por socket.
  game?.apply(c);
}

// ───────────── HUD ─────────────
let hudSig = '';
let elTimer: HTMLElement, elWindL: HTMLElement, elWindR: HTMLElement, elHint: HTMLElement, elTray: HTMLElement;
let teamEls: { bar: HTMLElement; hp: HTMLElement; box: HTMLElement }[] = [];

function buildHud(): void {
  if (!game) return;
  hud.innerHTML = '';
  const top = document.createElement('div');
  top.className = 'top';
  const teams = document.createElement('div');
  teams.className = 'teams';
  teamEls = game.teams.map((tm) => {
    const box = document.createElement('div');
    box.className = 'team';
    box.innerHTML = `<span class="tn"></span><div class="bar"><i></i></div><b></b>`;
    (box.querySelector('.tn') as HTMLElement).textContent = (tm.cpu ? '🤖 ' : '🎮 ') + tm.name;
    const bar = box.querySelector('i') as HTMLElement;
    bar.style.background = tm.color;
    teams.append(box);
    return { bar, hp: box.querySelector('b') as HTMLElement, box };
  });
  const center = document.createElement('div');
  center.className = 'center';
  center.innerHTML = `<div class="timer">45</div><div class="wind"><div class="half l"><i></i></div><div class="half r"><i></i></div></div><small>${t('hud.wind')}</small>`;
  elTimer = center.querySelector('.timer') as HTMLElement;
  elWindL = center.querySelector('.l i') as HTMLElement;
  elWindR = center.querySelector('.r i') as HTMLElement;
  const btns = document.createElement('div');
  btns.className = 'btns';
  const mute = document.createElement('button');
  mute.textContent = isMuted() ? '🔇' : '🔊';
  mute.title = t('hud.sound');
  mute.onclick = () => { setMuted(!isMuted()); mute.textContent = isMuted() ? '🔇' : '🔊'; };
  const pause = document.createElement('button');
  pause.textContent = '⏸';
  pause.title = t('hud.pause');
  pause.onclick = () => togglePause();
  btns.append(mute, pause);
  top.append(teams, center, btns);

  const bottom = document.createElement('div');
  bottom.className = 'bottom';
  elHint = document.createElement('div');
  elHint.className = 'hint';
  elTray = document.createElement('div');
  elTray.className = 'tray';
  WEAPONS.forEach((w, i) => {
    const b = document.createElement('button');
    b.className = 'wp';
    b.dataset.id = w.id;
    b.title = `${weaponName(w.id)} — ${weaponDesc(w.id)}`;
    b.innerHTML = `<img class="ic ic-${w.id}" alt="" src="${weaponIcon(w.id)}"><span class="key">${i < 9 ? i + 1 : i === 9 ? 0 : ''}</span><span class="am"></span>`;
    b.onclick = () => { if (humanTurn()) { send({ t: 'weapon', id: w.id }); sfx.click(); } };
    elTray.append(b);
  });
  bottom.append(elHint, elTray);
  hud.append(top, bottom);
  if (window.matchMedia('(pointer: coarse)').matches) hud.append(buildTouch());
  hudSig = '';
}

/** Controles en pantalla para celulares/tablets: simulan las mismas teclas. */
function buildTouch(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'touch';
  const mk = (label: string, cls: string, down: () => void, up: () => void) => {
    const b = document.createElement('button');
    b.className = 'tb ' + cls;
    b.textContent = label;
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); initAudio(); b.setPointerCapture(e.pointerId); down(); });
    const end = (e: Event) => { e.preventDefault(); up(); };
    b.addEventListener('pointerup', end);
    b.addEventListener('pointercancel', end);
    b.addEventListener('contextmenu', (e) => e.preventDefault());
    return b;
  };
  const hold = (label: string, cls: string, code: string) => mk(label, cls, () => keys.add(code), () => keys.delete(code));
  const pad = document.createElement('div');
  pad.className = 'pad';
  pad.append(hold('▲', 'u', 'ArrowUp'), hold('◀', 'l', 'ArrowLeft'), hold('▶', 'r', 'ArrowRight'), hold('▼', 'd', 'ArrowDown'));
  const acts = document.createElement('div');
  acts.className = 'acts';
  acts.append(
    mk('⤴', 'jump', () => { if (humanTurn()) send({ t: 'jump' }); }, () => {}),
    mk('🔥', 'fire', () => { if (humanTurn()) send({ t: 'charge', on: true }); }, () => { if (humanTurn()) send({ t: 'charge', on: false }); }),
  );
  wrap.append(pad, acts);
  return wrap;
}

function updateHud(): void {
  if (!game || !playing) return;
  const g = game;
  const total = g.teams[0].members.length * 100;
  g.teams.forEach((_, i) => {
    const hp = g.teamHp(i);
    teamEls[i].bar.style.width = `${Math.min(100, (hp / total) * 100)}%`;
    teamEls[i].hp.textContent = String(hp);
    teamEls[i].box.classList.toggle('on', g.activeTeam === i && g.phase !== 'over');
  });
  const secs = g.phase === 'retreat' ? Math.ceil(g.retreatT) : g.phase === 'aim' ? Math.ceil(g.turnTimer) : 0;
  elTimer.textContent = g.phase === 'settle' || g.phase === 'over' ? '·' : String(secs);
  elTimer.className = 'timer' + (g.phase === 'retreat' ? ' retreat' : g.phase === 'aim' && secs <= 5 ? ' low' : '');
  elWindL.style.width = `${Math.max(0, -g.wind) * 100}%`;
  elWindR.style.width = `${Math.max(0, g.wind) * 100}%`;

  const mine = humanTurn();
  const team = g.teams[g.activeTeam];
  const sig = `${g.activeTeam}|${team.weapon}|${mine}|${g.phase}|${WEAPONS.map((w) => team.ammo[w.id]).join(',')}|${g.hasTarget}`;
  if (sig === hudSig) return;
  hudSig = sig;
  elTray.classList.toggle('off', !mine || g.phase !== 'aim');
  for (const b of Array.from(elTray.children) as HTMLElement[]) {
    const id = b.dataset.id!;
    const am = team.ammo[id];
    b.classList.toggle('sel', team.weapon === id);
    b.classList.toggle('empty', am === 0);
    (b.querySelector('.am') as HTMLElement).textContent = am < 0 ? '' : `×${am}`;
  }
  const w = g.weapon();
  if (!mine) elHint.textContent = team.cpu ? t('hud.cpuTurn', { name: team.name }) : '';
  else if (g.phase === 'retreat') elHint.textContent = w.id === 'dog' ? t('hud.runDog') : t('hud.run');
  else {
    const how =
      w.kind === 'target' || w.kind === 'beam' ? t('hud.howTarget')
      : w.id === 'homing' ? (g.hasTarget ? t('hud.howHomingSet') : t('hud.howHoming'))
      : w.charge ? t('hud.howCharge')
      : t('hud.howUse');
    elHint.innerHTML = `<img class="hi" alt="" src="${weaponIcon(w.id)}"><b>${weaponName(w.id)}</b> — ${weaponDesc(w.id)} <em>${how}</em>`;
  }
}

// ───────────── partidas ─────────────
function startMatch(o: MatchOpts, fixedSeed?: number): void {
  const mine = menu.team;
  const cpu = randomTeam(CPU_NAMES[Math.floor(Math.random() * CPU_NAMES.length)], o.size, Math.random() < 0.5);
  const teams: TeamCfg[] = [
    { name: mine.name, color: '#38bdf8', cpu: false, members: mine.members.slice(0, o.size).map((m) => ({ name: m.name, avatar: m.avatar })) },
    { name: cpu.name, color: '#fb7185', cpu: true, members: cpu.members },
  ];
  const seed = fixedSeed ?? ((Date.now() ^ (Math.random() * 1e9)) >>> 0);
  game = new Game({ seed, teams });
  ais = [null, new Ai(1, o.difficulty, seed + 99)];
  playing = true;
  paused = false;
  overT = -1;
  lastInput = '';
  const city = CITY_IDS.includes(o.city) ? o.city : CITY_IDS[Math.floor(Math.random() * CITY_IDS.length)];
  view.setGame(game, city);
  view.announce(tl('cities')[CITY_IDS.indexOf(city)] ?? '', `${mine.name} vs ${cpu.name}`, 2.8);
  buildHud();
  hud.classList.remove('hidden');
  initAudio();
}

function startAttract(): void {
  const a = randomTeam('A', 3, true);
  const b = randomTeam('B', 3, true);
  const seed = (Math.random() * 1e9) >>> 0;
  game = new Game({
    seed,
    teams: [
      { name: 'A', color: '#38bdf8', cpu: true, members: a.members },
      { name: 'B', color: '#fb7185', cpu: true, members: b.members },
    ],
  });
  ais = [new Ai(0, 1, seed + 1), new Ai(1, 1, seed + 2)];
  playing = false;
  paused = false;
  overT = -1;
  view.setGame(game, CITY_IDS[Math.floor(Math.random() * CITY_IDS.length)]);
  hud.classList.add('hidden');
}

function goHome(): void {
  startAttract();
  menu.home();
}

function togglePause(): void {
  if (!playing || !game || game.phase === 'over') return;
  paused = !paused;
  if (paused) menu.pause(() => { paused = false; last = performance.now(); });
  else menu.clear();
}

// Los botones del HUD no deben quedarse con el foco: Espacio/Enter son teclas de juego.
hud.addEventListener('click', (e) => (e.target as HTMLElement).closest('button')?.blur());

menu.onStart = (o) => startMatch(o);
menu.onHome = goHome;

// ───────────── input ─────────────
const MOVE_KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyA', 'KeyD', 'KeyW', 'KeyS'];
window.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
  if (!playing) return;
  if (MOVE_KEYS.includes(e.code) || e.code === 'Space' || e.code === 'Tab') e.preventDefault();
  if (e.code === 'Escape') return togglePause();
  if (e.code === 'KeyM') return setMuted(!isMuted());
  if (e.repeat) return;
  keys.add(e.code);
  if (!humanTurn() || !game) return;
  if (e.code === 'Space') send({ t: 'charge', on: true });
  else if (e.code === 'Enter' || e.code === 'ShiftLeft') send({ t: 'jump' });
  else if (e.code === 'KeyC') view.focusNow();
  else if (e.code.startsWith('Digit')) {
    const n = Number(e.code.slice(5));
    const w = WEAPONS[n === 0 ? 9 : n - 1];
    if (w) send({ t: 'weapon', id: w.id });
  } else if (e.code === 'KeyQ' || e.code === 'KeyE' || e.code === 'Tab') {
    const team = game.teams[game.activeTeam];
    let i = WEAPONS.findIndex((w) => w.id === team.weapon);
    const dir = e.code === 'KeyQ' ? -1 : 1;
    for (let k = 0; k < WEAPONS.length; k++) {
      i = (i + dir + WEAPONS.length) % WEAPONS.length;
      if (team.ammo[WEAPONS[i].id] !== 0) break;
    }
    send({ t: 'weapon', id: WEAPONS[i].id });
  }
});
window.addEventListener('keyup', (e) => {
  keys.delete(e.code);
  if (e.code === 'Space' && humanTurn()) send({ t: 'charge', on: false });
});
window.addEventListener('blur', () => keys.clear());
window.addEventListener('resize', () => view.resize());

let drag: { x: number; y: number; moved: boolean } | null = null;
canvas.addEventListener('pointerdown', (e) => {
  initAudio();
  drag = { x: e.clientX, y: e.clientY, moved: false };
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  const [wx, wy] = view.toWorld(e.clientX, e.clientY);
  view.mouse.x = wx;
  view.mouse.y = wy;
  view.mouse.inside = true;
  if (drag) {
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (drag.moved || Math.hypot(dx, dy) > 6) {
      drag.moved = true;
      view.pan(dx, dy);
      drag.x = e.clientX;
      drag.y = e.clientY;
    }
  }
});
canvas.addEventListener('pointerup', (e) => {
  if (drag && !drag.moved && humanTurn() && game && game.phase === 'aim') {
    const [wx, wy] = view.toWorld(e.clientX, e.clientY);
    const k = game.weapon().kind;
    if (k === 'target' || k === 'beam' || game.weapon().id === 'homing') send({ t: 'target', x: wx, y: wy });
  }
  drag = null;
});
canvas.addEventListener('pointerleave', () => (view.mouse.inside = false));
canvas.addEventListener('wheel', (e) => { e.preventDefault(); view.zoomBy(e.deltaY < 0 ? 1.1 : 1 / 1.1); }, { passive: false });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

// ───────────── bucle principal: timestep fijo ─────────────
let last = performance.now();
let acc = 0;
// captura cuadro por cuadro (solo desarrollo): el bucle normal se detiene y se avanza a mano
let manual = false;
let simFrame = 0;
let evLog: Record<string, unknown>[] | null = null;

function tick(): void {
  const g = game!;
  if (humanTurn()) {
    const move = (keys.has('ArrowRight') || keys.has('KeyD') ? 1 : 0) - (keys.has('ArrowLeft') || keys.has('KeyA') ? 1 : 0);
    const aim = (keys.has('ArrowUp') || keys.has('KeyW') ? 1 : 0) - (keys.has('ArrowDown') || keys.has('KeyS') ? 1 : 0);
    const sig = `${g.turnCount}|${g.phase}|${move}|${aim}`;
    if (sig !== lastInput) { lastInput = sig; send({ t: 'input', move, aim }); }
  }
  const ai = ais[g.activeTeam];
  if (ai) for (const c of ai.update(g)) send(c);
  g.step();
  simFrame++;
  if (g.events.length) {
    if (evLog) for (const e of g.events) evLog.push({ f: simFrame, ...e });
    view.consume(g.events);
    for (const e of g.events) {
      if (e.t === 'over' && playing) overT = 1.6;
    }
    g.events.length = 0;
  }
  if (playing && g.phase === 'aim' && !g.teams[g.activeTeam].cpu) {
    const s = Math.ceil(g.turnTimer);
    if (s <= 5 && s !== lastTick && s > 0) sfx.tick();
    lastTick = s;
  }
}

const frameMs: number[] = [];
function frame(now: number): void {
  if (manual) {
    last = now;
    requestAnimationFrame(frame);
    return;
  }
  frameMs.push(now - last);
  if (frameMs.length > 600) frameMs.shift();
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (game && !paused) {
    acc += dt;
    let n = 0;
    while (acc >= DT && n++ < 8) { tick(); acc -= DT; }
    if (n >= 8) acc = 0;
    if (overT > 0) {
      overT -= dt;
      if (overT <= 0) {
        if (playing) {
          const g = game;
          const won = g.winner === 0;
          const alive = g.humans.filter((h) => h.alive && h.team === g.winner).length;
          (won ? sfx.win : sfx.lose)();
          menu.end(won, g.winner < 0 ? t('end.draw') : t(won ? 'end.won' : 'end.lost', { name: g.teams[g.winner].name }), [
            g.winner < 0 ? t('end.drawLine') : t('end.stats', { alive, turns: g.turnCount }),
          ]);
        }
      }
    }
    if (!playing && game.phase === 'over') startAttract();
  }
  view.showAim = humanTurn();
  sfx.charge(game && playing && !paused && game.charging && !game.teams[game.activeTeam].cpu ? game.power : -1);
  view.silent = !playing;
  view.draw(paused ? 0 : dt);
  updateHud();
  requestAnimationFrame(frame);
}

if (import.meta.env.DEV) {
  // Acceso para depurar/probar desde la consola del navegador
  (window as unknown as Record<string, unknown>).__bardo = {
    get game() { return game; }, send, view, frameMs, drawAvatar, renderOffline,
    trailer: {
      /** Partida CPU contra CPU reproducible, con elenco fijo y en modo cine. */
      start(seed: number, city: string, n = 4): void {
        manual = true;
        let s = seed >>> 0;
        const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
        const mk = (name: string) => ({
          name,
          members: Array.from({ length: n }, (_, i) => {
            const avatar = randomAvatar(rnd, 'AR');
            if (avatar.top === 1) avatar.top = 3;
            return { name: `${name}${i}`, avatar };
          }),
        });
        const a = mk('A'), b = mk('B');
        game = new Game({ seed, teams: [{ name: 'A', color: '#38bdf8', cpu: true, members: a.members }, { name: 'B', color: '#fb7185', cpu: true, members: b.members }] });
        ais = [new Ai(0, 2, seed + 1), new Ai(1, 2, seed + 2)];
        playing = false;
        paused = false;
        overT = -1;
        view.setGame(game, city);
        view.cine = true;
        view.silent = true;
        view.showAim = false;
        hud.classList.add('hidden');
        document.getElementById('ui')!.style.display = 'none';
        simFrame = 0;
        evLog = [];
      },
      skip(n: number): void { for (let i = 0; i < n && game && game.phase !== 'over'; i++) tick(); view.resetFx(); },
      step(): void { if (game && game.phase !== 'over') tick(); view.draw(DT); },
      still(dt = DT): void { view.draw(dt); },
      log: () => evLog,
      frame: () => simFrame,
    },
  };
}

// Solo desarrollo: ?seed=123&city=tokyo arranca directo una partida reproducible (para comparar capturas).
const qs = new URLSearchParams(location.search);
if (import.meta.env.DEV && qs.has('seed')) {
  menu.clear();
  startAttract();
  startMatch({ difficulty: 1, size: 4, city: qs.get('city') ?? 'baires' }, Number(qs.get('seed')));
} else goHome();
requestAnimationFrame(frame);

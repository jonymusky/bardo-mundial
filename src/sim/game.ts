import { Rng } from './rng.ts';
import { Terrain, generateTerrain } from './terrain.ts';
import { WEAPONS, WEAPON_BY_ID, PROJ, type ProjDef, type WeaponDef } from './weapons.ts';
import type { AvatarSpec } from '../avatar.ts';

export const DT = 1 / 60;
export const G = 520;
export const R = 8; // radio de colisión de una persona
export const WALK = 70;
export const MINV = 150;
export const MAXV = 820;
export const WIND_A = 110;
export const DOME_R = 300;
export const TURN_TIME = 45;
const FALL_V = 430;
const SUDDEN_DEATH_TURN = 36;

export type Phase = 'aim' | 'retreat' | 'settle' | 'over';

/** Comandos serializables: única forma de modificar la partida (clave para el online). */
export type Cmd =
  | { t: 'input'; move: number; aim: number }
  | { t: 'jump' }
  | { t: 'weapon'; id: string }
  | { t: 'charge'; on: boolean }
  | { t: 'fire'; power: number }
  | { t: 'aim'; facing: number; elev: number }
  | { t: 'target'; x: number; y: number };

export type GameEvent =
  | { t: 'explosion'; x: number; y: number; r: number }
  | { t: 'carve'; x: number; y: number; r: number }
  | { t: 'damage'; id: number; x: number; y: number; amount: number }
  | { t: 'death'; id: number; x: number; y: number; drowned: boolean }
  | { t: 'splash'; x: number; y: number }
  | { t: 'fire'; weapon: string; x: number; y: number }
  | { t: 'jump' | 'bounce' | 'intercept' | 'punch'; x: number; y: number }
  | { t: 'tracer' | 'beam'; x: number; y: number; x2: number; y2: number }
  | { t: 'turn'; team: number; id: number }
  | { t: 'sudden' }
  | { t: 'over'; winner: number };

export interface Human {
  id: number;
  team: number;
  name: string;
  avatar: AvatarSpec | null;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  alive: boolean;
  facing: number;
  elev: number;
  grounded: boolean;
  knocked: boolean;
  stuck: boolean;
  bounces: number;
  slowT: number;
  jet: boolean;
  jetFuel: number;
  thrusting: boolean;
  walkPhase: number;
  hurtT: number;
}

export interface Proj {
  id: number;
  defId: string;
  def: ProjDef;
  x: number;
  y: number;
  vx: number;
  vy: number;
  owner: number;
  team: number;
  age: number;
  fuse: number;
  dir: number;
  grounded: boolean;
  hops: number;
  rest: boolean;
  hasTarget: boolean;
  tx: number;
  ty: number;
  targeted: boolean;
}

export interface Dome {
  team: number;
  x: number;
  y: number;
  charges: number;
  turns: number;
}

export interface Interceptor {
  x: number;
  y: number;
  target: number;
}

export interface MemberCfg {
  name: string;
  avatar: AvatarSpec | null;
}
export interface TeamCfg {
  name: string;
  color: string;
  cpu: boolean;
  members: MemberCfg[];
}
export interface Team extends TeamCfg {
  ammo: Record<string, number>;
  weapon: string;
  cursor: number;
  ids: number[];
}

export interface GameCfg {
  seed: number;
  teams: TeamCfg[];
  hp?: number;
  w?: number;
  h?: number;
}

export class Game {
  w: number;
  h: number;
  rng: Rng;
  terrain: Terrain;
  teams: Team[] = [];
  humans: Human[] = [];
  projs: Proj[] = [];
  domes: Dome[] = [];
  interceptors: Interceptor[] = [];
  events: GameEvent[] = [];
  tick = 0;
  phase: Phase = 'aim';
  activeTeam = 0;
  activeId = 0;
  turnTimer = TURN_TIME;
  retreatT = 0;
  settleT = 0;
  settleTotal = 0;
  wind = 0;
  waterY: number;
  turnCount = 0;
  winner = -1;
  charging = false;
  power = 0;
  move = 0;
  aimIn = 0;
  hasTarget = false;
  tx = 0;
  ty = 0;
  private nextId = 1;

  constructor(cfg: GameCfg) {
    this.w = cfg.w ?? 2400;
    this.h = cfg.h ?? 1000;
    this.rng = new Rng(cfg.seed);
    this.terrain = generateTerrain(this.w, this.h, this.rng);
    this.waterY = this.h - 60;
    const hp = cfg.hp ?? 100;
    const spots = this.findSpawns(cfg.teams.reduce((n, t) => n + t.members.length, 0));
    let si = 0;
    cfg.teams.forEach((tc, ti) => {
      const ammo: Record<string, number> = {};
      for (const w of WEAPONS) ammo[w.id] = w.ammo;
      this.teams.push({ ...tc, ammo, weapon: 'bazooka', cursor: -1, ids: [] });
      void ti;
    });
    const maxMembers = Math.max(...cfg.teams.map((t) => t.members.length));
    for (let m = 0; m < maxMembers; m++) {
      cfg.teams.forEach((tc, ti) => {
        const mc = tc.members[m];
        if (!mc) return;
        const s = spots[si++ % spots.length];
        const h: Human = {
          id: this.humans.length,
          team: ti,
          name: mc.name,
          avatar: mc.avatar,
          x: s[0],
          y: s[1],
          vx: 0,
          vy: 0,
          hp,
          alive: true,
          facing: s[0] < this.w / 2 ? 1 : -1,
          elev: 0.5,
          grounded: false,
          knocked: false,
          stuck: false,
          bounces: 0,
          slowT: 0,
          jet: false,
          jetFuel: 0,
          thrusting: false,
          walkPhase: 0,
          hurtT: 0,
        };
        this.humans.push(h);
        this.teams[ti].ids.push(h.id);
      });
    }
    this.activeTeam = this.teams.length - 1;
    this.phase = 'settle';
    this.settleT = 0.2;
  }

  private findSpawns(n: number): [number, number][] {
    const out: [number, number][] = [];
    let minDist = 110;
    for (let tries = 0; tries < 3000 && out.length < n; tries++) {
      if (tries % 400 === 399) minDist *= 0.7;
      const x = this.rng.range(160, this.w - 160);
      const y = this.terrain.surfaceY(x, 0);
      if (y < 70 || y > this.waterY - 60) continue;
      const yl = this.terrain.surfaceY(x - 7, 0);
      const yr = this.terrain.surfaceY(x + 7, 0);
      if (Math.abs(yl - y) > 9 || Math.abs(yr - y) > 9) continue;
      if (out.some((s) => Math.abs(s[0] - x) < minDist)) continue;
      out.push([x, y - R - 2]);
    }
    while (out.length < n) out.push([this.w / 2 + out.length * 20, 100]);
    // mezclar para que los equipos queden intercalados
    for (let i = out.length - 1; i > 0; i--) {
      const j = this.rng.int(0, i);
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  // ───────────── consultas ─────────────
  active(): Human | null {
    const h = this.humans[this.activeId];
    return h && h.alive ? h : null;
  }
  weapon(): WeaponDef {
    return WEAPON_BY_ID[this.teams[this.activeTeam].weapon];
  }
  teamHp(t: number): number {
    let s = 0;
    for (const h of this.humans) if (h.team === t && h.alive) s += Math.max(0, h.hp);
    return s;
  }
  aimDir(h: Human): [number, number] {
    return [Math.cos(h.elev) * h.facing, -Math.sin(h.elev)];
  }
  muzzle(h: Human): [number, number] {
    return this.muzzleAt(h, h.facing, h.elev);
  }
  /** Boca del arma (a la altura del hombro) para una orientación dada. */
  muzzleAt(h: Human, facing: number, elev: number): [number, number] {
    return [h.x + Math.cos(elev) * facing * 16, h.y - 10 - Math.sin(elev) * 16];
  }
  /** ¿El punto toca a la persona? Cuerpo + cabeza (dos círculos). */
  hitsHuman(h: Human, px: number, py: number, pad: number): boolean {
    const dx = h.x - px;
    const d1 = h.y - 2 - py;
    const d2 = h.y - 22 - py;
    return dx * dx + d1 * d1 < (9 + pad) * (9 + pad) || dx * dx + d2 * d2 < (9 + pad) * (9 + pad);
  }
  private emit(e: GameEvent): void {
    if (this.events.length < 4000) this.events.push(e);
  }

  // ───────────── comandos ─────────────
  apply(c: Cmd): void {
    if (this.phase === 'over') return;
    const h = this.active();
    switch (c.t) {
      case 'input':
        this.move = Math.sign(c.move);
        this.aimIn = Math.sign(c.aim);
        break;
      case 'jump':
        if (h && (this.phase === 'aim' || this.phase === 'retreat') && h.grounded && !h.jet) {
          h.vx = h.facing * 150;
          h.vy = -300;
          h.grounded = false;
          h.stuck = false;
          this.emit({ t: 'jump', x: h.x, y: h.y });
        }
        break;
      case 'weapon':
        if (this.phase === 'aim' && !this.charging && WEAPON_BY_ID[c.id] && this.teams[this.activeTeam].ammo[c.id] !== 0) {
          this.teams[this.activeTeam].weapon = c.id;
          this.hasTarget = false;
        }
        break;
      case 'aim':
        if (h && this.phase === 'aim') {
          h.facing = c.facing >= 0 ? 1 : -1;
          h.elev = Math.max(-1.3, Math.min(1.5, c.elev));
        }
        break;
      case 'charge':
        if (!h) break;
        if (this.phase === 'retreat' && c.on) {
          for (const p of this.projs) if (p.def.mode === 'walker' && p.team === this.activeTeam) p.fuse = 0;
        } else if (this.phase === 'aim') {
          const w = this.weapon();
          if (c.on) {
            if (h.jet) h.jet = false;
            else if (w.charge) {
              this.charging = true;
              this.power = 0;
            } else if (w.kind !== 'target' && w.kind !== 'beam') this.fire(0);
          } else if (this.charging) this.fire(this.power);
        }
        break;
      case 'fire':
        if (h && this.phase === 'aim') this.fire(Math.max(0, Math.min(1, c.power)));
        break;
      case 'target': {
        if (!h || this.phase !== 'aim') break;
        const w = this.weapon();
        this.hasTarget = true;
        this.tx = Math.max(0, Math.min(this.w, c.x));
        this.ty = c.y;
        if (w.kind === 'target' || w.kind === 'beam') this.fire(0);
        break;
      }
    }
  }

  private spawn(defId: string, x: number, y: number, vx: number, vy: number, h: Human): Proj {
    const def = PROJ[defId];
    const p: Proj = {
      id: this.nextId++,
      defId,
      def,
      x,
      y,
      vx,
      vy,
      owner: h.id,
      team: h.team,
      age: 0,
      fuse: def.fuse,
      dir: h.facing,
      grounded: false,
      hops: 0,
      rest: false,
      hasTarget: false,
      tx: 0,
      ty: 0,
      targeted: false,
    };
    this.projs.push(p);
    return p;
  }

  private fire(power: number): void {
    const h = this.active();
    if (!h || this.phase !== 'aim' || h.jet) return;
    const team = this.teams[this.activeTeam];
    const w = this.weapon();
    if (team.ammo[w.id] === 0) return;
    const [dx, dy] = this.aimDir(h);
    const [mx, my] = this.muzzle(h);
    switch (w.kind) {
      case 'launch': {
        const v = MINV + power * (MAXV - MINV);
        const p = this.spawn(w.proj, mx, my, dx * v, dy * v, h);
        if (w.id === 'homing' && this.hasTarget) {
          p.hasTarget = true;
          p.tx = this.tx;
          p.ty = this.ty;
        }
        break;
      }
      case 'place':
        if (w.proj === 'dog') this.spawn('dog', h.x + h.facing * 10, h.y - 2, h.facing * 80, -140, h);
        else this.spawn(w.proj, h.x + h.facing * 5, h.y + 2, 0, 0, h);
        break;
      case 'hitscan': {
        const hit = this.raycast(mx, my, dx, dy, h.id, 1100);
        this.emit({ t: 'tracer', x: mx, y: my, x2: hit.x, y2: hit.y });
        this.explode(hit.x, hit.y, 16, 40);
        break;
      }
      case 'melee': {
        this.emit({ t: 'punch', x: h.x + h.facing * 16, y: h.y - 10 });
        for (const o of this.humans) {
          if (!o.alive || o.id === h.id) continue;
          const fx = (o.x - h.x) * h.facing;
          if (fx > -4 && fx < 30 && Math.abs(o.y - h.y) < 20) {
            o.vx = h.facing * 330;
            o.vy = -280;
            o.grounded = false;
            o.knocked = true;
            o.stuck = false;
            o.bounces = 0;
            this.damage(o, 35);
          }
        }
        break;
      }
      case 'target': {
        if (!this.hasTarget) return;
        const tx = this.tx;
        if (w.id === 'orbital') this.spawn('orbital', tx, -320, 0, 330, h);
        else if (w.id === 'parcel') this.spawn('parcel', tx, -60, 0, 60, h);
        else {
          const side = tx >= h.x ? 1 : -1;
          for (let i = 0; i < 5; i++) this.spawn('drone', tx + (i - 2) * 38 - side * 150, -80 - i * 45, side * 125, 150, h);
        }
        break;
      }
      case 'beam': {
        if (!this.hasTarget) return;
        const x = this.tx;
        let depth = 0;
        let endY = this.waterY;
        for (let y = 0; y < this.waterY; y += 4) {
          if (this.terrain.solid(x, y)) {
            this.terrain.carve(x, y, 9);
            this.emit({ t: 'carve', x, y, r: 9 });
            depth += 4;
            if (depth > 240) {
              endY = y;
              break;
            }
          }
        }
        for (const o of this.humans) {
          o.stuck = false;
          if (o.alive && Math.abs(o.x - x) < 15 && o.y - 10 < endY) {
            o.vy = -160;
            o.grounded = false;
            this.damage(o, 40);
          }
        }
        this.emit({ t: 'beam', x, y: -200, x2: x, y2: endY });
        break;
      }
      case 'dome':
        this.domes = this.domes.filter((d) => d.team !== h.team);
        this.domes.push({ team: h.team, x: h.x, y: h.y, charges: 3, turns: this.teams.length * 2 + 1 });
        break;
      case 'jetpack':
        h.jet = true;
        h.jetFuel = 2.6;
        h.stuck = false;
        team.ammo[w.id]--;
        this.emit({ t: 'fire', weapon: w.id, x: h.x, y: h.y });
        team.weapon = 'bazooka';
        return;
      case 'skip':
        break;
    }
    if (team.ammo[w.id] > 0) team.ammo[w.id]--;
    this.emit({ t: 'fire', weapon: w.id, x: mx, y: my });
    if (team.ammo[w.id] === 0) team.weapon = 'bazooka';
    this.charging = false;
    this.power = 0;
    this.hasTarget = false;
    if (this.phase === 'aim') {
      this.phase = 'retreat';
      this.retreatT = w.retreat;
    }
  }

  raycast(x: number, y: number, dx: number, dy: number, selfId: number, max: number): { x: number; y: number; hit: number } {
    for (let d = 0; d < max; d += 3) {
      const px = x + dx * d;
      const py = y + dy * d;
      if (py > this.waterY || px < -50 || px > this.w + 50 || py < -400) return { x: px, y: py, hit: -1 };
      for (const o of this.humans) {
        if (!o.alive || o.id === selfId) continue;
        if (this.hitsHuman(o, px, py, 0)) return { x: px, y: py, hit: o.id };
      }
      if (this.terrain.solid(px, py)) return { x: px, y: py, hit: -1 };
    }
    return { x: x + dx * max, y: y + dy * max, hit: -1 };
  }

  // ───────────── daño ─────────────
  private damage(h: Human, amount: number): void {
    if (!h.alive) return;
    amount = Math.max(1, Math.round(amount));
    h.hp -= amount;
    h.hurtT = 0.5;
    this.emit({ t: 'damage', id: h.id, x: h.x, y: h.y - 44, amount });
    if (h.id === this.activeId) this.endControl();
  }

  private endControl(): void {
    if (this.phase === 'aim' || this.phase === 'retreat') {
      this.phase = 'settle';
      this.settleT = 0;
      this.settleTotal = 0;
    }
    this.charging = false;
    this.power = 0;
    const h = this.humans[this.activeId];
    if (h) h.jet = false;
  }

  explode(x: number, y: number, blast: number, dmg: number): void {
    this.terrain.carve(x, y, blast);
    this.emit({ t: 'carve', x, y, r: blast });
    this.emit({ t: 'explosion', x, y, r: blast });
    const reach = blast + 12;
    for (const h of this.humans) {
      h.stuck = false;
      if (!h.alive) continue;
      const dx = h.x - x;
      const dy = h.y - 8 - y;
      const d = Math.hypot(dx, dy);
      if (d >= reach) continue;
      const f = 1 - d / reach;
      const imp = (160 + dmg * 7) * f;
      const nx = d < 1 ? 0 : dx / d;
      const ny = d < 1 ? -1 : dy / d;
      h.vx += nx * imp;
      h.vy += ny * imp - 120 * f;
      h.grounded = false;
      h.knocked = true;
      h.bounces = 0;
      this.damage(h, dmg * f);
    }
  }

  /** Puntaje estimado de una explosión para un equipo (lo usa la CPU). */
  estimate(x: number, y: number, blast: number, dmg: number, team: number): number {
    const reach = blast + 12;
    let s = 0;
    for (const h of this.humans) {
      if (!h.alive) continue;
      const d = Math.hypot(h.x - x, h.y - 8 - y);
      if (d >= reach) continue;
      const dm = dmg * (1 - d / reach);
      const v = Math.min(dm, h.hp) + (dm >= h.hp ? 30 : 0);
      s += h.team === team ? -1.7 * v : v;
    }
    return s;
  }

  /** Simula un proyectil sin tocar la partida. Devuelve dónde explota, o null si se pierde. */
  trace(defId: string, x: number, y: number, vx: number, vy: number, owner: number): { x: number; y: number } | null {
    const def = PROJ[defId];
    const p: Proj = {
      id: -1, defId, def, x, y, vx, vy, owner, team: -1, age: 0, fuse: def.fuse, dir: 1,
      grounded: false, hops: 0, rest: false, hasTarget: false, tx: 0, ty: 0, targeted: false,
    };
    for (let i = 0; i < 480; i++) {
      const r = this.stepBallistic(p, true);
      if (r === 1) return { x: p.x, y: p.y };
      if (r === 2) return null;
    }
    return null;
  }

  // ───────────── paso de simulación ─────────────
  step(): void {
    if (this.phase === 'over') return;
    this.tick++;
    const h = this.active();

    if (this.phase === 'aim') {
      this.turnTimer -= DT;
      if (!h) this.endControl();
      else {
        this.control(h, true);
        if (this.charging) {
          this.power += DT / 1.4;
          if (this.power >= 1) this.fire(1);
        }
        if (this.turnTimer <= 0 && this.phase === 'aim') {
          if (this.charging) this.fire(this.power);
          else this.endControl();
        }
      }
    } else if (this.phase === 'retreat') {
      this.retreatT -= DT;
      if (h) this.control(h, false);
      if (!h || this.retreatT <= 0) this.endControl();
    }

    for (const o of this.humans) this.updateHuman(o);
    this.updateProjs();
    this.updateDomes();

    if (this.phase === 'settle') {
      this.settleTotal += DT;
      if (this.settleTotal > 25) {
        // red de seguridad: nunca dejar la partida trabada
        this.projs.length = 0;
        this.interceptors.length = 0;
        for (const o of this.humans) if (o.alive && !o.grounded) { o.grounded = true; o.stuck = true; o.vx = 0; o.vy = 0; }
      }
      if (this.quiet()) {
        this.settleT += DT;
        if (this.settleT > 0.7) {
          let died = false;
          for (const o of this.humans) {
            if (o.alive && o.hp <= 0) {
              o.alive = false;
              o.hp = 0;
              died = true;
              this.emit({ t: 'death', id: o.id, x: o.x, y: o.y, drowned: false });
            }
          }
          if (died) this.settleT = -0.4;
          else this.nextTurn();
        }
      } else if (this.settleT > 0) this.settleT = 0;
    }
  }

  private quiet(): boolean {
    if (this.projs.length || this.interceptors.length) return false;
    for (const h of this.humans) if (h.alive && !h.grounded) return false;
    return true;
  }

  private nextTurn(): void {
    const aliveTeams = this.teams.map((_, i) => i).filter((i) => this.humans.some((h) => h.team === i && h.alive));
    if (aliveTeams.length <= 1) {
      this.phase = 'over';
      this.winner = aliveTeams.length ? aliveTeams[0] : -1;
      this.emit({ t: 'over', winner: this.winner });
      return;
    }
    let t = this.activeTeam;
    do t = (t + 1) % this.teams.length;
    while (!aliveTeams.includes(t));
    const team = this.teams[t];
    let c = team.cursor;
    do c = (c + 1) % team.ids.length;
    while (!this.humans[team.ids[c]].alive);
    team.cursor = c;
    this.activeTeam = t;
    this.activeId = team.ids[c];
    this.turnCount++;
    this.wind = Math.round(this.rng.range(-1, 1) * 20) / 20;
    this.turnTimer = TURN_TIME;
    this.phase = 'aim';
    this.settleT = 0;
    this.settleTotal = 0;
    this.charging = false;
    this.power = 0;
    this.move = 0;
    this.aimIn = 0;
    this.hasTarget = false;
    if (team.ammo[team.weapon] === 0) team.weapon = 'bazooka';
    for (const d of this.domes) d.turns--;
    this.domes = this.domes.filter((d) => d.turns > 0 && d.charges > 0);
    if (this.turnCount > SUDDEN_DEATH_TURN) {
      if (this.turnCount === SUDDEN_DEATH_TURN + 1) this.emit({ t: 'sudden' });
      this.waterY -= 28;
    }
    this.emit({ t: 'turn', team: t, id: this.activeId });
  }

  private control(h: Human, canAim: boolean): void {
    if (h.jet) {
      h.thrusting = false;
      if (h.jetFuel > 0 && (this.aimIn > 0 || this.move !== 0)) {
        h.thrusting = true;
        h.jetFuel -= DT;
        if (h.grounded) { h.grounded = false; h.y -= 2; }
        if (this.aimIn > 0) h.vy -= 1150 * DT;
        h.vx += this.move * 480 * DT;
        h.vx *= 0.985;
        if (this.move !== 0) h.facing = this.move;
      }
      if (h.jetFuel <= 0 && h.grounded) h.jet = false;
      return;
    }
    if (canAim && this.aimIn !== 0) h.elev = Math.max(-1.3, Math.min(1.5, h.elev + this.aimIn * 1.5 * DT));
    if (this.move !== 0 && h.grounded && !this.charging) {
      h.facing = this.move;
      h.stuck = false;
      const nx = h.x + this.move * WALK * DT;
      let moved = false;
      for (let up = 0; up <= 5; up++) {
        if (!this.terrain.circleHits(nx, h.y - up, R)) {
          h.x = nx;
          h.y -= up;
          moved = true;
          break;
        }
      }
      if (moved) {
        h.walkPhase += 0.28;
        let d = 0;
        while (d < 6 && !this.terrain.circleHits(h.x, h.y + 1, R)) { h.y += 1; d++; }
        if (d >= 6) { h.grounded = false; h.vx = this.move * WALK; h.vy = 0; }
      }
    } else if (this.move !== 0 && !this.charging) h.facing = this.move;
  }

  private updateHuman(h: Human): void {
    if (!h.alive) return;
    if (h.hurtT > 0) h.hurtT -= DT;
    if (h.grounded) {
      if (!h.stuck && !this.terrain.circleHits(h.x, h.y + 1.5, R)) { h.grounded = false; h.vx = 0; h.vy = 0; }
    }
    if (!h.grounded) {
      h.vy += G * DT;
      const dist = Math.hypot(h.vx, h.vy) * DT;
      const n = Math.max(1, Math.ceil(dist / 2));
      for (let i = 0; i < n; i++) {
        const nx = h.x + (h.vx * DT) / n;
        const ny = h.y + (h.vy * DT) / n;
        if (!this.terrain.circleHits(nx, ny, R)) { h.x = nx; h.y = ny; continue; }
        const sp = Math.hypot(h.vx, h.vy);
        let [ax, ay] = this.terrain.normal(nx, ny, R + 4);
        if (ax === 0 && ay === 0) ay = -1;
        const vn = h.vx * ax + h.vy * ay;
        if (-vn > FALL_V && !h.jet) this.damage(h, Math.min(30, (-vn - FALL_V) / 20 + 1));
        if (h.knocked && sp > 240 && h.bounces < 4 && vn < 0) {
          h.vx = (h.vx - 1.3 * vn * ax) * 0.75;
          h.vy = (h.vy - 1.3 * vn * ay) * 0.75;
          h.bounces++;
        } else if (ay < -0.35) {
          h.vx = 0; h.vy = 0; h.grounded = true; h.knocked = false; h.bounces = 0; h.slowT = 0;
          let d = 0;
          while (d < 3 && !this.terrain.circleHits(h.x, h.y + 1, R)) { h.y += 1; d++; }
        } else if (vn < 0) {
          h.vx -= vn * ax;
          h.vy -= vn * ay;
          h.vx *= 0.9;
        }
        break;
      }
      if (!h.grounded) {
        if (Math.hypot(h.vx, h.vy) < 25) h.slowT++;
        else h.slowT = 0;
        if (h.slowT > 40) { h.grounded = true; h.stuck = true; h.knocked = false; h.vx = 0; h.vy = 0; h.slowT = 0; }
      }
    }
    if (h.y > this.waterY + 4 || h.x < -200 || h.x > this.w + 200) {
      h.alive = false;
      h.hp = 0;
      this.emit({ t: 'splash', x: h.x, y: this.waterY });
      this.emit({ t: 'death', id: h.id, x: h.x, y: h.y, drowned: true });
      if (h.id === this.activeId) this.endControl();
    }
  }

  /** 0 = sigue, 1 = explota, 2 = se pierde. Con dry=true no emite eventos (simulación de la CPU). */
  private stepBallistic(p: Proj, dry: boolean): 0 | 1 | 2 {
    const d = p.def;
    p.age += DT;
    if (d.mode === 'timed') {
      p.fuse -= DT;
      if (p.fuse <= 0) return 1;
    }
    if (p.rest) {
      if (this.terrain.solid(p.x, p.y + d.r + 2)) return 0;
      p.rest = false;
    }
    if (d.mode === 'homing' && p.hasTarget && p.age > 0.35 && p.age < 5) {
      const sp = Math.hypot(p.vx, p.vy) || 1;
      let cur = Math.atan2(p.vy, p.vx);
      let diff = Math.atan2(p.ty - p.y, p.tx - p.x) - cur;
      while (diff > Math.PI) diff -= 2 * Math.PI;
      while (diff < -Math.PI) diff += 2 * Math.PI;
      cur += Math.max(-5 * DT, Math.min(5 * DT, diff));
      const ns = sp + (430 - sp) * 0.08;
      p.vx = Math.cos(cur) * ns;
      p.vy = Math.sin(cur) * ns;
    } else {
      p.vy += G * d.gravity * DT;
      p.vx += this.wind * WIND_A * d.wind * DT;
    }
    if (d.mode === 'chute') {
      if (p.vy > 130) p.vy = 130;
      p.vx += (this.wind * 70 - p.vx) * 0.03;
    }
    const dist = Math.hypot(p.vx, p.vy) * DT;
    const n = Math.max(1, Math.ceil(dist / 2));
    const sx = (p.vx * DT) / n;
    const sy = (p.vy * DT) / n;
    for (let i = 0; i < n; i++) {
      const nx = p.x + sx;
      const ny = p.y + sy;
      if (ny > this.waterY) {
        if (!dry) this.emit({ t: 'splash', x: nx, y: this.waterY });
        return 2;
      }
      if (nx < -400 || nx > this.w + 400 || ny < -3000) return 2;
      if (d.mode !== 'timed') {
        for (const h of this.humans) {
          if (!h.alive || (h.id === p.owner && p.age < 0.3)) continue;
          if (this.hitsHuman(h, nx, ny, d.r)) { p.x = nx; p.y = ny; return 1; }
        }
      }
      if (this.terrain.solid(nx, ny)) {
        if (d.mode !== 'timed') { p.x = nx; p.y = ny; return 1; }
        let [ax, ay] = this.terrain.normal(nx, ny, 5);
        if (ax === 0 && ay === 0) ay = -1;
        const vn = p.vx * ax + p.vy * ay;
        if (vn < 0) {
          p.vx = (p.vx - (1 + d.bounce) * vn * ax) * 0.88;
          p.vy = (p.vy - (1 + d.bounce) * vn * ay) * 0.88;
          if (!dry && -vn > 60) this.emit({ t: 'bounce', x: p.x, y: p.y });
        }
        if (Math.hypot(p.vx, p.vy) < 35 && ay < -0.4) { p.vx = 0; p.vy = 0; p.rest = true; }
        break;
      }
      p.x = nx;
      p.y = ny;
    }
    return 0;
  }

  private stepWalker(p: Proj): 0 | 1 | 2 {
    const t = this.terrain;
    p.age += DT;
    p.fuse -= DT;
    if (p.fuse <= 0) return 1;
    for (const h of this.humans) {
      if (h.alive && h.team !== p.team && Math.hypot(h.x - p.x, h.y - p.y) < 22) return 1;
    }
    if (p.grounded) {
      if (!t.circleHits(p.x, p.y + 1.5, 5)) { p.grounded = false; p.vx = p.dir * 60; p.vy = 0; }
      else {
        const nx = p.x + p.dir * 110 * DT;
        let moved = false;
        for (let up = 0; up <= 7; up++) {
          if (!t.circleHits(nx, p.y - up, 5)) { p.x = nx; p.y -= up; moved = true; break; }
        }
        if (!moved) {
          if (++p.hops > 4) return 1;
          p.grounded = false; p.vx = p.dir * 70; p.vy = -290; p.y -= 1;
        } else {
          let d = 0;
          while (d < 7 && !t.circleHits(p.x, p.y + 1, 5)) { p.y += 1; d++; }
        }
      }
    } else {
      p.vy += G * DT;
      const n = Math.max(1, Math.ceil((Math.hypot(p.vx, p.vy) * DT) / 2));
      for (let i = 0; i < n; i++) {
        const nx = p.x + (p.vx * DT) / n;
        const ny = p.y + (p.vy * DT) / n;
        if (!t.circleHits(nx, ny, 5)) { p.x = nx; p.y = ny; continue; }
        if (!t.circleHits(p.x, ny, 5)) { p.y = ny; p.vx = 0; }
        else if (p.vy > 0) { p.grounded = true; p.vx = 0; p.vy = 0; }
        else p.vy = 0;
        break;
      }
    }
    if (p.y > this.waterY) {
      this.emit({ t: 'splash', x: p.x, y: this.waterY });
      return 2;
    }
    return 0;
  }

  private updateProjs(): void {
    if (!this.projs.length) return;
    const list = this.projs.slice();
    for (const p of list) {
      const r = p.def.mode === 'walker' ? this.stepWalker(p) : this.stepBallistic(p, false);
      if (r === 0) continue;
      const i = this.projs.indexOf(p);
      if (i >= 0) this.projs.splice(i, 1);
      if (r === 1) {
        this.explode(p.x, p.y, p.def.blast, p.def.dmg);
        const c = p.def.cluster;
        if (c) {
          const owner = this.humans[p.owner];
          for (let k = 0; k < c.count; k++) {
            const a = -Math.PI / 2 + this.rng.range(-0.9, 0.9);
            const v = this.rng.range(170, 300);
            const child = this.spawn(c.def, p.x, p.y - 6, Math.cos(a) * v, Math.sin(a) * v, owner);
            child.age = 0.3;
          }
        }
      }
    }
  }

  private updateDomes(): void {
    for (const d of this.domes) {
      if (d.charges <= 0) continue;
      for (const p of this.projs) {
        if (d.charges <= 0) break;
        if (p.targeted || !p.def.interceptable || p.team === d.team) continue;
        if (Math.hypot(p.x - d.x, p.y - d.y) < DOME_R) {
          p.targeted = true;
          d.charges--;
          this.interceptors.push({ x: d.x, y: d.y - 14, target: p.id });
          this.emit({ t: 'fire', weapon: 'interceptor', x: d.x, y: d.y - 14 });
        }
      }
    }
    for (let i = this.interceptors.length - 1; i >= 0; i--) {
      const it = this.interceptors[i];
      const p = this.projs.find((q) => q.id === it.target);
      if (!p) { this.interceptors.splice(i, 1); continue; }
      const dx = p.x - it.x;
      const dy = p.y - it.y;
      const d = Math.hypot(dx, dy);
      const stepLen = 1100 * DT;
      if (d <= stepLen + 6) {
        this.projs.splice(this.projs.indexOf(p), 1);
        this.interceptors.splice(i, 1);
        this.emit({ t: 'intercept', x: p.x, y: p.y });
      } else {
        it.x += (dx / d) * stepLen;
        it.y += (dy / d) * stepLen;
      }
    }
  }
}

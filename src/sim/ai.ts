import { Rng } from './rng.ts';
import { Game, G, MINV, MAXV, type Cmd, type Human } from './game.ts';
import { PROJ } from './weapons.ts';

interface Plan {
  weapon: string;
  score: number;
  facing: number;
  elev: number;
  power: number;
  target: boolean;
  x: number;
  y: number;
}

const ERR = [
  { a: 0.11, p: 0.1, x: 40 }, // fácil
  { a: 0.04, p: 0.04, x: 14 }, // normal
  { a: 0.012, p: 0.012, x: 4 }, // difícil
];

/** CPU: busca el mejor tiro simulando candidatos con la física real y le suma error según dificultad. */
export class Ai {
  team: number;
  diff: number;
  rng: Rng;
  turn = -1;
  wait = 0;
  stage: 'idle' | 'think' | 'walk' | 'aimed' | 'done' = 'idle';
  plan: Plan | null = null;
  walked = false;
  walkT = 0;
  walkDir = 1;
  lastX = 0;

  constructor(team: number, diff: number, seed: number) {
    this.team = team;
    this.diff = Math.max(0, Math.min(2, diff));
    this.rng = new Rng(seed);
  }

  update(g: Game): Cmd[] {
    if (g.phase !== 'aim' || g.activeTeam !== this.team) return [];
    const h = g.active();
    if (!h) return [];
    if (g.turnCount !== this.turn) {
      this.turn = g.turnCount;
      this.stage = 'think';
      this.wait = 50 + this.rng.int(0, 50);
      this.walked = false;
      return [{ t: 'input', move: 0, aim: 0 }];
    }
    switch (this.stage) {
      case 'think': {
        if (--this.wait > 0 || !h.grounded) return [];
        let plan = this.best(g, h);
        if ((!plan || plan.score < 10) && !this.walked) {
          this.walked = true;
          const e = this.nearest(g, h);
          if (e && Math.abs(e.x - h.x) > 60) {
            this.stage = 'walk';
            this.walkT = 100 + this.rng.int(0, 70);
            this.walkDir = e.x > h.x ? 1 : -1;
            this.lastX = h.x;
            return [];
          }
        }
        if (!plan || plan.score <= 0) plan = this.lob(g, h);
        this.applyError(plan);
        this.plan = plan;
        this.stage = 'aimed';
        this.wait = 35;
        return [
          { t: 'input', move: 0, aim: 0 },
          { t: 'weapon', id: plan.weapon },
          { t: 'aim', facing: plan.facing, elev: plan.elev },
        ];
      }
      case 'walk': {
        this.walkT--;
        const ahead = h.x + this.walkDir * 16;
        const sy = g.terrain.surfaceY(ahead, h.y - 25);
        const hazard = h.grounded && (sy < 0 || sy > h.y + 45 || sy > g.waterY - 14);
        if (this.walkT <= 0 || hazard) {
          this.stage = 'think';
          this.wait = 15;
          return [{ t: 'input', move: 0, aim: 0 }];
        }
        const out: Cmd[] = [{ t: 'input', move: this.walkDir, aim: 0 }];
        if (this.walkT % 30 === 0) {
          if (Math.abs(h.x - this.lastX) < 3 && !hazard) out.push({ t: 'jump' });
          this.lastX = h.x;
        }
        return out;
      }
      case 'aimed': {
        if (--this.wait > 0) return [];
        this.stage = 'done';
        const p = this.plan!;
        return p.target ? [{ t: 'target', x: p.x, y: p.y }] : [{ t: 'fire', power: p.power }];
      }
    }
    return [];
  }

  private nearest(g: Game, h: Human): Human | null {
    let best: Human | null = null;
    for (const o of g.humans) {
      if (!o.alive || o.team === h.team) continue;
      if (!best || Math.abs(o.x - h.x) < Math.abs(best.x - h.x)) best = o;
    }
    return best;
  }

  private lob(g: Game, h: Human): Plan {
    const e = this.nearest(g, h);
    const dx = e ? e.x - h.x : 300;
    const v = Math.sqrt(Math.abs(dx) * G);
    return {
      weapon: 'bazooka', score: 0, facing: dx >= 0 ? 1 : -1, elev: 0.8,
      power: Math.max(0.15, Math.min(1, (v - MINV) / (MAXV - MINV))), target: false, x: 0, y: 0,
    };
  }

  private applyError(p: Plan): void {
    const e = ERR[this.diff];
    if (p.target) p.x += this.rng.gauss() * e.x;
    else {
      p.elev += this.rng.gauss() * e.a;
      p.power = Math.max(0.05, Math.min(1, p.power * (1 + this.rng.gauss() * e.p)));
    }
  }

  private best(g: Game, h: Human): Plan | null {
    const team = g.teams[this.team];
    const enemies = g.humans.filter((o) => o.alive && o.team !== h.team);
    if (!enemies.length) return null;
    let best: Plan | null = null;
    const consider = (p: Plan) => {
      p.score += this.rng.range(0, 3);
      if (!best || p.score > best.score) best = p;
    };
    const base = { facing: h.facing, elev: h.elev, power: 0, target: false, x: 0, y: 0 };
    const has = (id: string) => team.ammo[id] !== 0;

    // Tiros balísticos: probar ángulos y potencias con la física real
    for (const wid of ['bazooka', 'grenade']) {
      const projId = wid === 'bazooka' ? 'rocket' : 'grenade';
      const def = PROJ[projId];
      for (const facing of [1, -1]) {
        if (!enemies.some((e) => (e.x - h.x) * facing > -50)) continue;
        for (let elev = -0.2; elev <= 1.46; elev += 0.11) {
          const dx = Math.cos(elev) * facing;
          const dy = -Math.sin(elev);
          const [mx, my] = g.muzzleAt(h, facing, elev);
          if (g.terrain.solid(mx, my)) continue;
          for (let pw = 0.2; pw <= 1.001; pw += 0.1) {
            const v = MINV + pw * (MAXV - MINV);
            const r = g.trace(projId, mx, my, dx * v, dy * v, h.id);
            if (!r) continue;
            const s = g.estimate(r.x, r.y, def.blast, def.dmg, h.team);
            if (s > 0) consider({ ...base, weapon: wid, score: s, facing, elev, power: pw });
          }
        }
      }
    }

    // Afinar el mejor tiro balístico alrededor del candidato grueso
    const coarse = best as Plan | null;
    if (coarse) {
      const projId = coarse.weapon === 'bazooka' ? 'rocket' : 'grenade';
      const def = PROJ[projId];
      let top = coarse;
      for (let de = -0.05; de <= 0.0501; de += 0.0125) {
        for (let dp = -0.05; dp <= 0.0501; dp += 0.0125) {
          const elev = coarse.elev + de;
          const pw = Math.max(0.05, Math.min(1, coarse.power + dp));
          const [mx, my] = g.muzzleAt(h, coarse.facing, elev);
          if (g.terrain.solid(mx, my)) continue;
          const v = MINV + pw * (MAXV - MINV);
          const r = g.trace(projId, mx, my, Math.cos(elev) * coarse.facing * v, -Math.sin(elev) * v, h.id);
          if (!r) continue;
          const s = g.estimate(r.x, r.y, def.blast, def.dmg, h.team);
          if (s > top.score) top = { ...coarse, score: s, elev, power: pw };
        }
      }
      best = top;
    }

    for (const e of enemies) {
      const dx = e.x - h.x;
      const facing = dx >= 0 ? 1 : -1;
      // Escopeta: línea de tiro directa
      const elev = Math.atan2(-(e.y - 8 - (h.y - 10)), Math.abs(dx));
      if (elev > -1.3 && elev < 1.5) {
        const ux = Math.cos(elev) * facing;
        const uy = -Math.sin(elev);
        const [sx, sy] = g.muzzleAt(h, facing, elev);
        const hit = g.raycast(sx, sy, ux, uy, h.id, 1100);
        if (hit.hit === e.id) consider({ ...base, weapon: 'shotgun', score: g.estimate(hit.x, hit.y, 16, 40, h.team), facing, elev });
      }
      // Piña
      if (Math.abs(dx) < 28 && Math.abs(e.y - h.y) < 18) consider({ ...base, weapon: 'punch', score: Math.min(35, e.hp) + (35 >= e.hp ? 30 : 0) + 6, facing });
      // Perro robot
      if (has('dog') && Math.abs(dx) > 40 && Math.abs(dx) < 380 && Math.abs(e.y - h.y) < 45) consider({ ...base, weapon: 'dog', score: 20, facing });

      // Armas desde el cielo
      const surf = g.terrain.surfaceY(e.x, 0);
      const y0 = surf < 0 ? e.y : Math.min(surf, e.y);
      const tgt = { ...base, target: true, x: e.x, y: e.y, facing };
      if (has('orbital')) consider({ ...tgt, weapon: 'orbital', score: g.estimate(e.x, y0, PROJ.orbital.blast, PROJ.orbital.dmg, h.team) - 22 });
      if (has('parcel')) consider({ ...tgt, weapon: 'parcel', score: g.estimate(e.x, y0, PROJ.parcel.blast, PROJ.parcel.dmg, h.team) * 1.3 - 10 });
      if (has('drones')) {
        let s = -14;
        for (let i = -2; i <= 2; i++) {
          const x = e.x + i * 38;
          const sy = g.terrain.surfaceY(x, 0);
          if (sy >= 0) s += g.estimate(x, sy, PROJ.drone.blast, PROJ.drone.dmg, h.team);
        }
        consider({ ...tgt, weapon: 'drones', score: s });
      }
      if (has('laser')) {
        let cover = 0;
        for (let y = 0; y < e.y - 10; y += 4) if (g.terrain.solid(e.x, y)) cover += 4;
        if (cover < 230) {
          let s = -8;
          for (const o of g.humans) {
            if (!o.alive || Math.abs(o.x - e.x) > 14) continue;
            const v = Math.min(40, o.hp) + (40 >= o.hp ? 30 : 0);
            s += o.team === h.team ? -1.7 * v : v;
          }
          consider({ ...tgt, weapon: 'laser', score: s });
        }
      }
    }
    // De vez en cuando, defenderse
    if (has('dome') && g.turnCount > 4 && !g.domes.some((d) => d.team === h.team) && this.rng.next() < 0.1) {
      const b = best as Plan | null;
      if (!b || b.score < 45) return { ...base, weapon: 'dome', score: 50 };
    }
    return best;
  }
}

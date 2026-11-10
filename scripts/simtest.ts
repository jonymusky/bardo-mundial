// Corre partidas completas CPU vs CPU sin navegador y verifica que todas terminan.
// Uso: npm run simtest [cantidad]
import { Game } from '../src/sim/game.ts';
import { Ai } from '../src/sim/ai.ts';

const N = Number(process.argv[2] ?? 30);
const MAX_TICKS = 60 * 60 * 40;
let fail = 0;
let totalTurns = 0;
const wins = [0, 0, 0];
const used: Record<string, number> = {};
const FIX = process.argv[3] !== undefined ? Number(process.argv[3]) : -1; // dificultad fija para ambos (0-2)
let late = 0, drowned = 0, killed = 0;
const t0 = Date.now();

function hash(g: Game): string {
  return g.humans.map((h) => `${h.x.toFixed(2)},${h.y.toFixed(2)},${h.hp}`).join('|') + `#${g.tick}`;
}

function run(seed: number): Game {
  const mk = (name: string) => ({
    name, color: '#fff', cpu: true,
    members: [0, 1, 2, 3].map((i) => ({ name: `${name}${i}`, avatar: null })),
  });
  const g = new Game({ seed, teams: [mk('A'), mk('B')] });
  const ais = [new Ai(0, FIX >= 0 ? FIX : seed % 3, seed * 7 + 1), new Ai(1, FIX >= 0 ? FIX : (seed + 1) % 3, seed * 13 + 5)];
  while (g.phase !== 'over' && g.tick < MAX_TICKS) {
    for (const c of ais[g.activeTeam].update(g)) g.apply(c);
    g.step();
    for (const e of g.events) {
      if (e.t === 'fire') used[e.weapon] = (used[e.weapon] ?? 0) + 1;
      else if (e.t === 'death') e.drowned ? drowned++ : killed++;
    }
    g.events.length = 0;
  }
  return g;
}

for (let seed = 1; seed <= N; seed++) {
  const g = run(seed);
  totalTurns += g.turnCount;
  if (g.turnCount > 36) late++;
  if (g.phase !== 'over') {
    fail++;
    console.log(`✗ seed ${seed}: NO TERMINÓ (fase ${g.phase}, turno ${g.turnCount}, proyectiles ${g.projs.length})`);
  } else wins[g.winner + 1]++;
}

// Determinismo: misma semilla => mismo resultado exacto
const a = hash(run(7));
const b = hash(run(7));
if (a !== b) {
  fail++;
  console.log('✗ la simulación NO es determinista');
}

console.log(`partidas: ${N}  fallas: ${fail}  turnos promedio: ${(totalTurns / N).toFixed(1)}  ${((Date.now() - t0) / 1000).toFixed(1)}s`);
console.log(`empates/A/B: ${wins.join('/')}`);
console.log(`llegan a muerte súbita: ${((late / N) * 100).toFixed(0)}%  muertes por daño: ${killed}  ahogados: ${drowned}`);
console.log('armas usadas:', used);
process.exit(fail ? 1 : 0);

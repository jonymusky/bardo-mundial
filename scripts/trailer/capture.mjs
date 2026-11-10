// Captura el tráiler cuadro por cuadro (1920×1080, 60 fps) y guarda los eventos para la banda de sonido.
// Uso: node scripts/trailer/capture.mjs <carpetaSalida> [índices de toma separados por coma]
// Necesita `npm run dev -- --port 5199` corriendo y Google Chrome instalado.
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { CLIPS } from './clips.mjs';

const out = process.argv[2] ?? 'trailer-out';
const only = process.argv[3] ? process.argv[3].split(',').map(Number) : null;
const BASE = 'http://localhost:5199';
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
const game = await ctx.newPage();
await game.goto(`${BASE}/play.html`, { waitUntil: 'networkidle' });
await game.waitForFunction(() => window.__bardo);
if (!(await game.evaluate(() => window.__bardo.view.fx.ok))) throw new Error('sin WebGL2: la captura saldría sin iluminación');
const cards = await ctx.newPage();
await cards.goto(`${BASE}/trailer.html`, { waitUntil: 'networkidle' });
await cards.waitForFunction(() => window.cardsReady && window.cardsReady());

const shot = (page, dir, i) => page.screenshot({ path: `${dir}/${String(i).padStart(4, '0')}.jpg`, type: 'jpeg', quality: 96 });
const cues = [];
let t0 = 0;
for (let ci = 0; ci < CLIPS.length; ci++) {
  const clip = CLIPS[ci];
  const dir = `${out}/clip${String(ci).padStart(2, '0')}`;
  if (!only || only.includes(ci)) {
    mkdirSync(dir, { recursive: true });
    console.log(`toma ${ci}: ${clip.k} ${clip.city ?? clip.name} (${clip.n} cuadros)`);
    if (clip.k === 'card') {
      await cards.bringToFront();
      for (let i = 0; i < clip.n; i++) {
        await cards.evaluate(([name, t]) => window.card(name, t), [clip.name, i / 60]);
        await shot(cards, dir, i);
      }
    } else {
      await game.bringToFront();
      await game.evaluate(([c]) => {
        const B = window.__bardo, T = B.trailer;
        T.start(c.seed, c.city);
        if (c.from) T.skip(c.from);
        const v = B.view, g = B.game;
        v.cam.zoom = c.zoom ?? (c.k === 'pan' ? 2.3 : 2.5);
        if (c.k === 'pan') {
          const h = g.humans[c.who ?? 0];
          v.manualT = 1e9;
          v.cam.x = h.x - (c.dx ?? 70);
          v.cam.y = h.y - 70;
        } else {
          const h = g.active();
          v.manualT = 0;
          if (h) { v.cam.x = h.x; v.cam.y = h.y - 50; }
        }
        for (let i = 0; i < 30; i++) T.still(0.0001);
      }, [clip]);
      await game.waitForTimeout(700); // el fondo pintado de la ciudad puede estar llegando
      for (let i = 0; i < clip.n; i++) {
        await game.evaluate(([c, i]) => {
          const B = window.__bardo;
          if (c.k === 'pan') { B.view.cam.x += (c.speed ?? 0.9); B.trailer.still(1 / 60); }
          else B.trailer.step();
        }, [clip, i]);
        await shot(game, dir, i);
      }
    }
  }
  if (clip.k === 'game') {
    // los eventos se recalculan siempre (aunque la toma no se vuelva a capturar) para armar el sonido
    const log = await game.evaluate(([c, capture]) => {
      const B = window.__bardo, T = B.trailer;
      if (!capture) { T.start(c.seed, c.city); T.skip(c.from + c.n); }
      return T.log().filter((e) => e.f > c.from && e.f <= c.from + c.n);
    }, [clip, !only || only.includes(ci)]);
    for (const e of log) cues.push({ t: +(t0 + (e.f - clip.from) / 60).toFixed(3), ev: e.t, weapon: e.weapon, r: e.r, amount: e.amount });
  }
  if (clip.k === 'card') cues.push({ t: +t0.toFixed(3), ev: 'card', name: clip.name });
  t0 += clip.n / 60;
}
writeFileSync(`${out}/cues.json`, JSON.stringify({ seconds: t0, cues }, null, 1));
console.log('duración', t0.toFixed(2), 's —', cues.length, 'eventos');
await browser.close();

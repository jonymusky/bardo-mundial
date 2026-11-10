// Explora partidas CPU contra CPU reproducibles y lista los disparos con su daño, para elegir tomas.
// Uso: node scripts/trailer/scout.mjs <ciudad> <semilla> [más semillas]   (necesita `npm run dev` en :5199)
import { chromium } from 'playwright-core';
const [city, ...seeds] = process.argv.slice(2);
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
await page.goto('http://localhost:5199/play.html');
await page.waitForFunction(() => window.__bardo);
console.log('webgl', await page.evaluate(() => window.__bardo.view.fx.ok));
for (const seed of seeds) {
  const log = await page.evaluate(([seed, city]) => {
    const T = window.__bardo.trailer;
    T.start(Number(seed), city);
    for (let i = 0; i < 400 && window.__bardo.game.phase !== 'over'; i++) T.skip(60);
    return T.log();
  }, [seed, city]);
  const out = [];
  for (let i = 0; i < log.length; i++) {
    const e = log[i];
    if (e.t !== 'fire' || e.weapon === 'skip') continue;
    let dmg = 0, deaths = 0, hits = 0, boom = 0, end = e.f;
    for (let j = i + 1; j < log.length && log[j].t !== 'turn'; j++) {
      const x = log[j];
      if (x.t === 'damage') { dmg += x.amount; hits++; end = x.f; }
      if (x.t === 'death') deaths++;
      if (x.t === 'explosion') { boom++; end = Math.max(end, x.f); }
      if (x.t === 'intercept') { boom += 100; end = x.f; }
    }
    out.push(`${seed} f${e.f} ${e.weapon} dmg${dmg} hits${hits} deaths${deaths} boom${boom} dur${end - e.f}`);
  }
  console.log(out.join('\n'));
}
await browser.close();

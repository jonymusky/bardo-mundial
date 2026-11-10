// Renderiza la banda de sonido del tráiler con el sintetizador del propio juego, fuera de línea,
// ubicando cada efecto en el segundo exacto del evento capturado. Uso: node scripts/trailer/audio.mjs <carpeta>
import { chromium } from 'playwright-core';
import { readFileSync, writeFileSync } from 'node:fs';

const dir = process.argv[2] ?? 'trailer-out';
// con `--fx` se renderizan solo los efectos: la música grabada se mezcla después en build.sh
const fxOnly = process.argv.includes('--fx');
const { seconds, cues } = JSON.parse(readFileSync(`${dir}/cues.json`, 'utf8'));
const FIRE = { shotgun: 'shotgun', laser: 'laser', orbital: 'whoosh', drones: 'whoosh', parcel: 'whoosh', jetpack: 'jet', grenade: 'throw', battery: 'drop', dog: 'drop', dome: 'drop' };
const plan = [];
for (const c of cues) {
  if (c.ev === 'explosion') plan.push({ t: c.t, fx: 'boom', arg: c.r });
  else if (c.ev === 'fire' && c.weapon !== 'skip' && c.weapon !== 'punch') plan.push({ t: c.t, fx: FIRE[c.weapon] ?? 'shoot' });
  else if (c.ev === 'damage') plan.push({ t: c.t, fx: 'hurt' });
  else if (['death', 'splash', 'intercept', 'punch', 'jump', 'bounce'].includes(c.ev)) plan.push({ t: c.t, fx: c.ev });
  else if (c.ev === 'card' && c.name === 'logo') plan.push({ t: c.t + 0.02, fx: 'boom', arg: 95 }, { t: c.t + 0.25, fx: 'win' });
  else if (c.ev === 'card' && c.name === 'lineup') for (let i = 1; i < 12; i++) plan.push({ t: c.t + i * 0.3, fx: 'click' });
  else if (c.ev === 'card' && c.name === 'end') plan.push({ t: c.t + 0.02, fx: 'boom', arg: 70 }, { t: c.t + 0.2, fx: 'win' });
}
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage();
await page.goto('http://localhost:5199/play.html');
await page.waitForFunction(() => window.__bardo);
const b64 = await page.evaluate(async ([seconds, plan, withMusic]) => {
  const buf = await window.__bardo.renderOffline(seconds, plan, 48000, withMusic);
  const n = buf.length, ch = [buf.getChannelData(0), buf.getChannelData(1)];
  const out = new DataView(new ArrayBuffer(44 + n * 4));
  const str = (o, s) => { for (let i = 0; i < s.length; i++) out.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); out.setUint32(4, 36 + n * 4, true); str(8, 'WAVEfmt '); out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 2, true);
  out.setUint32(24, buf.sampleRate, true); out.setUint32(28, buf.sampleRate * 4, true); out.setUint16(32, 4, true); out.setUint16(34, 16, true); str(36, 'data'); out.setUint32(40, n * 4, true);
  for (let i = 0; i < n; i++) for (let c = 0; c < 2; c++) out.setInt16(44 + i * 4 + c * 2, Math.max(-1, Math.min(1, ch[c][i])) * 32767, true);
  let bin = '';
  const u8 = new Uint8Array(out.buffer);
  for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode(...u8.subarray(i, i + 0x8000));
  return btoa(bin);
}, [seconds, plan, !fxOnly]);
writeFileSync(`${dir}/audio.wav`, Buffer.from(b64, 'base64'));
console.log(`audio.wav: ${seconds.toFixed(2)} s, ${plan.length} efectos`);
await browser.close();

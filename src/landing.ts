// Portada: video de presentación con subtítulos por idioma, y el contexto del proyecto.
import './landing.css';
import { LANGS, getLang, setLang, t, type Lang } from './i18n.ts';
import { drawAvatar, type AvatarSpec } from './avatar.ts';
import { preloadArt, CORE_ART } from './art.ts';

/** Subtítulos del tráiler: [desde, hasta, clave]. El video solo lleva el logo; el texto va acá para poder traducirlo. */
const CAPTIONS: [number, number, string][] = [
  [0.3, 3.4, 'cap.hook'],
  [6.1, 10.6, 'cap.cities'],
  [10.9, 14.2, 'cap.squad'],
  [14.5, 20.8, 'cap.weapons'],
  [21.1, 26.8, 'cap.swarm'],
  [27.1, 32.2, 'cap.physics'],
  [33.2, 36, 'cap.cta'],
];

const video = document.getElementById('trailer') as HTMLVideoElement;
const caption = document.getElementById('caption')!;
const sound = document.getElementById('sound') as HTMLButtonElement;
const langs = document.getElementById('langs')!;
let capKey = '';

function applyLang(): void {
  const lang = getLang();
  document.documentElement.lang = lang;
  document.title = t('land.title');
  document.querySelector('meta[name="description"]')?.setAttribute('content', t('land.desc'));
  for (const el of document.querySelectorAll<HTMLElement>('[data-i18n]')) el.textContent = t(el.dataset.i18n!);
  langs.replaceChildren(
    ...LANGS.map((l) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = l.label;
      b.setAttribute('aria-pressed', String(l.id === lang));
      b.onclick = () => { setLang(l.id as Lang); applyLang(); };
      return b;
    }),
  );
  paintSound();
  capKey = '';
  tickCaption();
}

function tickCaption(): void {
  const now = video.currentTime;
  const hit = CAPTIONS.find(([a, b]) => now >= a && now < b);
  const key = hit ? hit[2] : '';
  if (key === capKey) return;
  capKey = key;
  caption.classList.remove('on');
  if (key) {
    caption.textContent = t(key);
    // reinicia la animación de entrada
    void caption.offsetWidth;
    caption.classList.add('on');
  }
}

video.addEventListener('timeupdate', tickCaption);
const loop = () => { tickCaption(); requestAnimationFrame(loop); };
requestAnimationFrame(loop);

// ── sonido ──
// La portada intenta arrancar con sonido. Los navegadores solo lo permiten después de un gesto de la
// persona (o si ya visitó el sitio), así que si lo bloquean el video arranca en silencio y el sonido
// se enciende con el primer toque, clic o tecla en cualquier parte de la página.
const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let wantsSound = true;
let blocked = false;

function paintSound(): void {
  sound.textContent = !video.muted ? `🔊 ${t('land.mute')}` : blocked && wantsSound ? `🔊 ${t('land.tap')}` : `🔇 ${t('land.sound')}`;
  sound.classList.toggle('pulse', video.muted && blocked && wantsSound);
}
async function start(): Promise<void> {
  video.muted = !wantsSound;
  try {
    await video.play();
    blocked = false;
  } catch {
    blocked = true;
    video.muted = true;
    await video.play().catch(() => (video.controls = true));
  }
  paintSound();
}
function firstGesture(): void {
  if (!blocked || !wantsSound) return;
  blocked = false;
  video.muted = false;
  if (video.paused) void video.play();
  paintSound();
}
for (const ev of ['pointerdown', 'keydown', 'touchend']) window.addEventListener(ev, firstGesture, { passive: true });

sound.onclick = (e) => {
  e.stopPropagation();
  if (blocked && wantsSound) return firstGesture();
  wantsSound = video.muted;
  video.muted = !wantsSound;
  if (video.paused) void video.play();
  paintSound();
};
video.addEventListener('click', () => (video.paused ? void video.play() : video.pause()));

// Reproduce solo cuando se ve, y nunca sola si la persona pidió menos movimiento.
if (calm) video.controls = true;
else {
  new IntersectionObserver(([e]) => { if (e.isIntersecting) void start(); else video.pause(); }, { threshold: 0.35 }).observe(video);
}

// ── efectos de scroll ──
// Fondo: las ciudades pintadas del juego se van fundiendo una en otra a medida que se baja.
const scene = document.getElementById('scene')!;
const SCENES = ['bg_tokyo', 'bg_baires', 'bg_paris', 'bg_nyc', 'bg_rio'];
const layers = SCENES.map((name) => {
  const el = document.createElement('i');
  el.style.backgroundImage = `url(./art/${name}.webp)`;
  scene.append(el);
  return el;
});
const progress = document.getElementById('progress')!;
const player = document.getElementById('player')!;
let queued = false;
function onScroll(): void {
  queued = false;
  const max = document.documentElement.scrollHeight - window.innerHeight;
  const p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
  progress.style.transform = `scaleX(${p})`;
  const f = p * (layers.length - 1);
  layers.forEach((el, i) => {
    const d = f - i;
    el.style.opacity = String(Math.max(0, 1 - Math.abs(d)));
    if (!calm) el.style.transform = `translate3d(0, ${(-d * 46).toFixed(1)}px, 0) scale(${(1.1 + Math.abs(d) * 0.04).toFixed(3)})`;
  });
  if (!calm) {
    // el reproductor llega inclinado y se endereza al quedar en el centro de la pantalla
    const r = player.getBoundingClientRect();
    const off = (r.top + r.height / 2 - window.innerHeight / 2) / window.innerHeight;
    const k = Math.max(-1, Math.min(1, off * 1.7));
    player.style.transform = `perspective(1600px) rotateX(${(k * 13).toFixed(2)}deg) scale(${(1 - Math.abs(k) * 0.07).toFixed(3)})`;
    player.style.setProperty('--glow', (1 - Math.abs(k)).toFixed(2));
  }
}
const requestScroll = () => { if (!queued) { queued = true; requestAnimationFrame(onScroll); } };
window.addEventListener('scroll', requestScroll, { passive: true });
window.addEventListener('resize', requestScroll);
onScroll();

// Las secciones entran de a una, escalonadas, cuando llegan a la vista.
const groups = document.querySelectorAll<HTMLElement>('[data-reveal-group]');
for (const g of groups) {
  [...g.children].forEach((el, i) => {
    el.classList.add('reveal');
    (el as HTMLElement).style.setProperty('--i', String(i));
  });
}
if (calm || !('IntersectionObserver' in window)) document.querySelectorAll('.reveal').forEach((el) => el.classList.add('in'));
else {
  const io = new IntersectionObserver(
    (es) => { for (const e of es) if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } },
    { threshold: 0.18, rootMargin: '0px 0px -6% 0px' },
  );
  document.querySelectorAll('.reveal').forEach((el) => io.observe(el));
}

// Tarjeta del equipo: el mismo dibujo de personajes que usa el juego.
const SQUAD: AvatarSpec[] = [
  { country: 'AR', identity: 1, skin: 1, body: 1, hair: 2, hairColor: 5, face: 3, top: 5, topColor: 8, bottom: 2, bottomColor: 8, acc: 0 },
  { country: 'AR', identity: 0, skin: 4, body: 2, hair: 4, hairColor: 0, face: 1, top: 3, topColor: 5, bottom: 0, bottomColor: 13, acc: 5 },
  { country: 'AR', identity: 2, skin: 2, body: 1, hair: 7, hairColor: 7, face: 4, top: 7, topColor: 2, bottom: 3, bottomColor: 11, acc: 2 },
  { country: 'AR', identity: 5, skin: 5, body: 0, hair: 5, hairColor: 9, face: 0, top: 8, topColor: 3, bottom: 4, bottomColor: 5, acc: 8 },
];
const squad = document.getElementById('squad') as HTMLCanvasElement;
function paintSquad(): void {
  const c = squad.getContext('2d')!;
  c.clearRect(0, 0, squad.width, squad.height);
  SQUAD.forEach((a, i) => {
    c.save();
    c.translate(95 + i * 150, 250);
    c.scale(9.5, 9.5);
    drawAvatar(c, a, { facing: i < 2 ? 1 : -1, walk: 0, stride: 0, aim: null, tool: 'none', hurt: false, air: false, thrust: false, t: 1 + i });
    c.restore();
  });
}
preloadArt(CORE_ART);
window.addEventListener('artload', paintSquad);
paintSquad();

applyLang();

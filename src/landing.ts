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
  sound.textContent = video.muted ? `🔇 ${t('land.sound')}` : `🔊 ${t('land.mute')}`;
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

sound.onclick = () => {
  video.muted = !video.muted;
  if (!video.muted && video.paused) void video.play();
  applyLang();
};
video.addEventListener('click', () => (video.paused ? void video.play() : video.pause()));

// Reproduce solo cuando se ve, y nunca si la persona pidió menos movimiento.
const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (calm) video.controls = true;
else {
  new IntersectionObserver(
    ([e]) => { if (e.isIntersecting) void video.play().catch(() => (video.controls = true)); else video.pause(); },
    { threshold: 0.35 },
  ).observe(video);
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

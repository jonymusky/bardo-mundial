// Audio 100% sintetizado con WebAudio (sin archivos): efectos por capas, reverb por convolución,
// compresor en el master y una base musical generativa.
let ac: AudioContext | null = null;
let master: GainNode | null = null;
let fxBus: GainNode | null = null;
let wet: GainNode | null = null;
let musicBus: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
let shaper: WaveShaperNode | null = null;
let muted = false;
let musicTimer = 0;
let trackBus: GainNode | null = null;
/** Volumen de la pista de música (viene masterizada fuerte) y cuánto baja con una explosión. */
const TRACK = 0.34, DUCK = 0.15;
/** Desplazamiento del reloj: solo se usa al renderizar fuera de línea, para ubicar cada efecto en su momento. */
let offT = 0;

const MASTER = 0.8;

export function initAudio(): void {
  if (ac) {
    if (ac.state === 'suspended') void ac.resume();
    return;
  }
  try {
    ac = new AudioContext();
    build();
    startMusic();
  } catch {
    ac = null;
  }
}

/** Arma la cadena de audio (compresor, buses, reverb, saturación) sobre el contexto actual. */
function build(): void {
  if (!ac) return;
  {
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 18;
    comp.ratio.value = 5;
    comp.attack.value = 0.004;
    comp.release.value = 0.22;
    master = ac.createGain();
    master.gain.value = muted ? 0 : MASTER;
    master.connect(comp).connect(ac.destination);

    fxBus = ac.createGain();
    fxBus.connect(master);
    musicBus = ac.createGain();
    musicBus.gain.value = 0.2;
    musicBus.connect(master);

    // reverb: respuesta al impulso generada (ruido con caída exponencial)
    const len = Math.floor(ac.sampleRate * 2.2);
    const ir = ac.createBuffer(2, len, ac.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
    }
    const conv = ac.createConvolver();
    conv.buffer = ir;
    wet = ac.createGain();
    wet.gain.value = 0.5;
    wet.connect(conv).connect(master);

    noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const nd = noiseBuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

    shaper = ac.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) {
      const x = (i / 512 - 1) * 3;
      curve[i] = Math.tanh(x);
    }
    shaper.curve = curve;
    shaper.connect(fxBus);
    shaper.connect(wet);
  }
}

export interface Cue { t: number; fx: string; arg?: number }

/**
 * Renderiza música y efectos a un buffer, sin reproducirlos: se usa para la banda de sonido del tráiler.
 * Cada efecto se agenda en su segundo exacto, así queda sincronizado con los cuadros capturados.
 */
export async function renderOffline(seconds: number, cues: Cue[], sampleRate = 48000, withMusic = true): Promise<AudioBuffer> {
  const prev = { ac, master, fxBus, wet, musicBus, noiseBuf, shaper, musicTimer, trackBus };
  trackBus = null;
  const off = new OfflineAudioContext(2, Math.ceil(seconds * sampleRate), sampleRate);
  ac = off as unknown as AudioContext;
  musicTimer = 0;
  build();
  if (withMusic) startMusic(seconds);
  const table = sfx as unknown as Record<string, (a?: number) => void>;
  for (const c of cues) {
    offT = c.t;
    table[c.fx]?.(c.arg);
  }
  offT = 0;
  const buf = await off.startRendering();
  ({ ac, master, fxBus, wet, musicBus, noiseBuf, shaper, musicTimer, trackBus } = prev);
  return buf;
}

export function setMuted(m: boolean): void {
  muted = m;
  if (master && ac) master.gain.setTargetAtTime(m ? 0 : MASTER, ac.currentTime, 0.03);
}
export function isMuted(): boolean {
  return muted;
}

interface Out { rev?: number; drive?: boolean; pan?: number }

function route(node: AudioNode, o: Out = {}): void {
  if (!ac || !fxBus || !wet) return;
  let n: AudioNode = node;
  if (o.pan) {
    const p = ac.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, o.pan));
    n.connect(p);
    n = p;
  }
  if (o.drive && shaper) {
    n.connect(shaper);
    return;
  }
  n.connect(fxBus);
  if (o.rev) {
    const g = ac.createGain();
    g.gain.value = o.rev;
    n.connect(g).connect(wet);
  }
}

function tone(type: OscillatorType, f0: number, f1: number, dur: number, vol: number, delay = 0, o: Out = {}, attack = 0.004): void {
  if (!ac) return;
  const t = ac.currentTime + offT + delay;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(f0, t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(18, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g);
  route(g, o);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

function noise(type: BiquadFilterType, f0: number, f1: number, q: number, dur: number, vol: number, delay = 0, o: Out = {}, attack = 0.003): void {
  if (!ac || !noiseBuf) return;
  const t = ac.currentTime + offT + delay;
  const s = ac.createBufferSource();
  s.buffer = noiseBuf;
  s.loop = true;
  const f = ac.createBiquadFilter();
  f.type = type;
  f.Q.value = q;
  f.frequency.setValueAtTime(f0, t);
  f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g);
  route(g, o);
  s.start(t, Math.random() * 1.5);
  s.stop(t + dur + 0.05);
}

/** Voz sintética: diente de sierra pasado por dos formantes. */
function voice(f0: number, f1: number, dur: number, vol: number, formants: [number, number], delay = 0): void {
  if (!ac) return;
  const t = ac.currentTime + offT + delay;
  const osc = ac.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(f0, t);
  osc.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  for (const fr of formants) {
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = fr;
    bp.Q.value = 6;
    osc.connect(bp).connect(g);
  }
  route(g, { rev: 0.25 });
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

// ───────────── carga del disparo (tono continuo que sube) ─────────────
let chOsc: OscillatorNode | null = null;
let chGain: GainNode | null = null;
function charge(power: number): void {
  if (!ac || !fxBus) return;
  if (power < 0) {
    if (chOsc && chGain) {
      chGain.gain.setTargetAtTime(0, ac.currentTime, 0.02);
      chOsc.stop(ac.currentTime + 0.12);
      chOsc = null;
      chGain = null;
    }
    return;
  }
  if (!chOsc) {
    chOsc = ac.createOscillator();
    chOsc.type = 'triangle';
    chGain = ac.createGain();
    chGain.gain.value = 0;
    chOsc.connect(chGain).connect(fxBus);
    chOsc.start();
  }
  chOsc.frequency.setTargetAtTime(180 + power * power * 900, ac.currentTime, 0.03);
  chGain!.gain.setTargetAtTime(0.05 + power * 0.07, ac.currentTime, 0.03);
}

export const sfx = {
  boom(r: number): void {
    const k = Math.min(1, r / 95);
    duck(k);
    tone('sine', 110 - k * 40, 26, 0.55 + k * 0.7, 1, 0, { drive: true });
    noise('lowpass', 3200 - k * 1200, 70, 0.7, 0.5 + k * 1.1, 0.9 + k * 0.4, 0, { drive: true });
    noise('highpass', 2400, 5000, 0.7, 0.07, 0.6, 0, { rev: 0.5 });
    noise('bandpass', 260, 90, 1.2, 0.9 + k, 0.5, 0.05, { rev: 0.9 });
    const n = 5 + Math.floor(k * 9);
    for (let i = 0; i < n; i++) noise('bandpass', rnd(500, 2600), rnd(200, 900), 4, rnd(0.03, 0.09), rnd(0.1, 0.3), rnd(0.15, 0.9 + k * 0.6), { pan: rnd(-0.8, 0.8), rev: 0.3 });
  },
  shoot(): void {
    tone('sine', 190, 46, 0.22, 0.8, 0, { drive: true });
    noise('bandpass', 500, 2600, 0.9, 0.42, 0.5, 0, { rev: 0.35 });
    noise('highpass', 3000, 6000, 0.7, 0.05, 0.35);
  },
  throw(): void {
    noise('bandpass', 700, 2200, 1.4, 0.2, 0.3, 0, { rev: 0.15 }, 0.05);
    tone('triangle', 240, 330, 0.09, 0.12);
  },
  drop(): void {
    tone('sine', 150, 70, 0.1, 0.5);
    noise('bandpass', 900, 400, 2, 0.06, 0.3);
    tone('square', 1400, 1400, 0.05, 0.08, 0.12);
    tone('square', 1900, 1900, 0.05, 0.08, 0.2);
  },
  shotgun(): void {
    noise('highpass', 900, 3500, 0.6, 0.16, 1, 0, { drive: true });
    tone('sine', 160, 40, 0.2, 0.9, 0, { drive: true });
    noise('bandpass', 1200, 300, 1, 0.5, 0.25, 0.03, { rev: 1 });
    noise('bandpass', 1800, 1500, 6, 0.035, 0.35, 0.33);
    noise('bandpass', 1300, 1100, 6, 0.045, 0.4, 0.43);
  },
  whoosh(): void {
    tone('square', 1320, 1320, 0.06, 0.1);
    tone('square', 1760, 1760, 0.08, 0.1, 0.09);
    noise('bandpass', 300, 2400, 1.2, 0.9, 0.35, 0.12, { rev: 0.5 }, 0.3);
  },
  jet(): void {
    noise('bandpass', 400, 900, 0.8, 0.5, 0.4, 0, { rev: 0.2 }, 0.05);
    tone('sawtooth', 70, 110, 0.5, 0.18, 0, {}, 0.05);
  },
  jump(): void {
    tone('triangle', 230, 470, 0.13, 0.22);
    noise('bandpass', 900, 1600, 1.5, 0.1, 0.12);
  },
  step(): void {
    noise('lowpass', rnd(500, 800), 180, 1, 0.05, 0.16);
  },
  bounce(): void {
    const f = rnd(1050, 1350);
    tone('sine', f, f * 0.98, 0.16, 0.2, 0, { rev: 0.3 });
    tone('sine', f * 1.52, f * 1.5, 0.1, 0.12);
    noise('bandpass', 2200, 900, 3, 0.03, 0.22);
  },
  hurt(): void {
    const p = rnd(0.85, 1.35);
    voice(330 * p, 190 * p, 0.2, 0.55, [760, 1250]);
    noise('bandpass', 900, 300, 1.2, 0.07, 0.4);
  },
  splash(): void {
    noise('bandpass', 1500, 320, 0.9, 0.6, 0.8, 0, { rev: 0.5 });
    noise('highpass', 3000, 5000, 0.7, 0.25, 0.25, 0.02);
    for (let i = 0; i < 6; i++) tone('sine', rnd(280, 520), rnd(700, 1300), rnd(0.05, 0.1), 0.14, rnd(0.15, 0.7));
  },
  death(): void {
    const p = rnd(0.85, 1.25);
    voice(300 * p, 110 * p, 0.7, 0.5, [650, 1050]);
    tone('sine', 90, 40, 0.3, 0.5, 0.55);
    tone('triangle', 392, 196, 0.5, 0.12, 0.2, { rev: 0.8 });
  },
  turn(): void {
    for (const [f, d] of [[659, 0], [988, 0.1]] as [number, number][]) {
      tone('sine', f, f, 0.32, 0.22, d, { rev: 0.5 });
      tone('sine', f * 2, f * 2, 0.12, 0.07, d);
      tone('triangle', f * 3, f * 3, 0.05, 0.04, d);
    }
  },
  tick(): void {
    tone('sine', 1500, 1100, 0.045, 0.22);
    noise('bandpass', 2600, 2000, 5, 0.02, 0.16);
  },
  laser(): void {
    tone('sawtooth', 160, 2400, 0.3, 0.2, 0, {}, 0.2);
    for (const d of [0, 7, -9]) tone('sawtooth', 1900 + d, 260 + d, 0.8, 0.2, 0.28, { rev: 0.7 });
    noise('bandpass', 5000, 700, 2, 0.8, 0.5, 0.28, { rev: 0.5 });
    tone('sine', 70, 34, 0.9, 0.9, 0.28, { drive: true });
  },
  intercept(): void {
    tone('square', 500, 2600, 0.12, 0.18);
    noise('highpass', 1800, 4000, 0.7, 0.3, 0.55, 0.1, { rev: 1 });
    tone('sine', 150, 60, 0.25, 0.5, 0.1);
  },
  punch(): void {
    noise('lowpass', 1100, 180, 1, 0.1, 1, 0, { drive: true });
    tone('sine', 170, 55, 0.14, 0.9);
    noise('highpass', 2500, 4000, 1, 0.03, 0.3);
  },
  click(): void {
    tone('sine', 820, 1150, 0.05, 0.14);
  },
  win(): void {
    [523, 659, 784, 1047, 1319].forEach((f, i) => {
      tone('triangle', f, f, 0.34, 0.24, i * 0.12, { rev: 0.7 });
      tone('sine', f * 2, f * 2, 0.2, 0.08, i * 0.12);
    });
    for (const f of [523, 659, 784]) tone('sawtooth', f, f, 0.9, 0.06, 0.62, { rev: 0.8 }, 0.05);
  },
  lose(): void {
    [392, 349, 311, 233].forEach((f, i) => tone('triangle', f, f * 0.97, 0.42, 0.24, i * 0.2, { rev: 0.8 }));
    tone('sine', 98, 60, 1.1, 0.4, 0.8);
  },
  charge,
};

// ───────────── música generativa ─────────────
// Progresión Am – F – C – G, 100 bpm. Se agenda por adelantado con un reloj de look-ahead.
const CHORDS = [
  [220, 261.63, 329.63],
  [174.61, 220, 261.63],
  [261.63, 329.63, 392],
  [196, 246.94, 293.66],
];
const SCALE = [440, 523.25, 587.33, 659.25, 783.99, 880];

function mNote(type: OscillatorType, f: number, t: number, dur: number, vol: number, cutoff = 0): void {
  if (!ac || !musicBus) return;
  const osc = ac.createOscillator();
  osc.type = type;
  osc.frequency.value = f;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.08, dur * 0.3));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  if (cutoff) {
    const f2 = ac.createBiquadFilter();
    f2.type = 'lowpass';
    f2.frequency.value = cutoff;
    osc.connect(f2).connect(g);
  } else osc.connect(g);
  g.connect(musicBus);
  if (wet) {
    const s = ac.createGain();
    s.gain.value = 0.35;
    g.connect(s).connect(wet);
  }
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

function mDrum(kind: number, t: number): void {
  if (!ac || !musicBus || !noiseBuf) return;
  if (kind === 0) {
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.frequency.setValueAtTime(130, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.16);
    g.gain.setValueAtTime(0.9, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    osc.connect(g).connect(musicBus);
    osc.start(t);
    osc.stop(t + 0.25);
    return;
  }
  const s = ac.createBufferSource();
  s.buffer = noiseBuf;
  const f = ac.createBiquadFilter();
  f.type = kind === 1 ? 'bandpass' : 'highpass';
  f.frequency.value = kind === 1 ? 1800 : 7000;
  const g = ac.createGain();
  const dur = kind === 1 ? 0.14 : 0.04;
  g.gain.setValueAtTime(kind === 1 ? 0.4 : 0.14, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(musicBus);
  s.start(t, Math.random());
  s.stop(t + dur + 0.02);
}

/** Música de fondo: la pista grabada en loop; si no se puede cargar, la base sintetizada de respaldo. */
function startMusic(until?: number): void {
  if (!ac || musicTimer) return;
  if (until !== undefined) return synthMusic(until);
  musicTimer = -1;
  const ctx = ac;
  fetch(`${import.meta.env.BASE_URL}media/music.mp3`)
    .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
    .then((b) => ctx.decodeAudioData(b))
    .then((buf) => {
      if (ac !== ctx || !master) return;
      trackBus = ctx.createGain();
      trackBus.gain.value = 0;
      trackBus.gain.setTargetAtTime(TRACK, ctx.currentTime, 0.6);
      trackBus.connect(master);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      src.connect(trackBus);
      src.start();
    })
    .catch(() => {
      musicTimer = 0;
      synthMusic();
    });
}

/** La música baja un instante para que la explosión se escuche por encima. */
function duck(k: number): void {
  if (!ac || !trackBus) return;
  const t = ac.currentTime;
  trackBus.gain.cancelScheduledValues(t);
  trackBus.gain.setTargetAtTime(TRACK - (TRACK - DUCK) * k, t, 0.02);
  trackBus.gain.setTargetAtTime(TRACK, t + 0.3 + k * 0.3, 0.45);
}

function synthMusic(until?: number): void {
  if (!ac || musicTimer > 0) return;
  const step = 60 / 100 / 4; // semicorchea
  let next = ac.currentTime + 0.1;
  let i = 0;
  let lead = 2;
  const schedule = () => {
    if (!ac) return;
    while (next < (until ?? ac.currentTime + 0.35)) {
      const s16 = i % 16;
      const chord = CHORDS[Math.floor(i / 16) % 4];
      if (s16 === 0) for (const f of chord) { mNote('sawtooth', f, next, step * 16, 0.07, 650); mNote('sawtooth', f * 1.006, next, step * 16, 0.05, 650); }
      if (s16 % 4 === 0 || s16 === 10) mNote('triangle', chord[0] / 2, next, step * 3, 0.5);
      if (s16 === 0 || s16 === 8 || s16 === 11) mDrum(0, next);
      if (s16 === 4 || s16 === 12) mDrum(1, next);
      if (s16 % 2 === 0) mDrum(2, next);
      if (s16 % 2 === 0 && Math.random() < 0.42) {
        lead = Math.max(0, Math.min(SCALE.length - 1, lead + Math.floor(Math.random() * 3) - 1));
        mNote('square', SCALE[lead], next, step * (Math.random() < 0.3 ? 4 : 2), 0.045, 1800);
      }
      next += step;
      i++;
    }
  };
  schedule();
  if (until === undefined) musicTimer = window.setInterval(schedule, 120);
}

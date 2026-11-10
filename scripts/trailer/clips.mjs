// Lista de tomas del tráiler. Cada corte cae en un múltiplo de 36 cuadros (0,6 s = un pulso a 100 bpm).
// `from` es el cuadro de simulación donde empieza la toma en una partida reproducible (ver scout.mjs).
export const CLIPS = [
  { k: 'game', city: 'tokyo', seed: 11, from: 96, n: 216 }, // cohete orbital
  { k: 'card', name: 'logo', n: 144 },
  { k: 'pan', city: 'paris', seed: 21, who: 0, n: 72 },
  { k: 'pan', city: 'nyc', seed: 22, who: 1, n: 72 },
  { k: 'pan', city: 'rio', seed: 23, who: 2, n: 72 },
  { k: 'pan', city: 'cairo', seed: 24, who: 3, n: 72 },
  { k: 'card', name: 'lineup', n: 216 },
  { k: 'game', city: 'london', seed: 11, from: 3208, n: 180 }, // lanzacohetes
  { k: 'game', city: 'baires', seed: 11, from: 2487, n: 216 }, // paquetes
  { k: 'game', city: 'dubai', seed: 11, from: 6888, n: 180 }, // drones
  { k: 'game', city: 'sydney', seed: 12, from: 1732, n: 180 }, // granada
  { k: 'game', city: 'nyc', seed: 11, from: 7853, n: 144 }, // láser
  { k: 'game', city: 'rio', seed: 12, from: 439, n: 180 }, // cohete orbital
  { k: 'card', name: 'end', n: 216 },
];

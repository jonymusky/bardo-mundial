// Arte en imágenes (public/art/*.webp). Cada dibujo que lo usa conserva su versión
// por código como respaldo mientras la imagen carga o si falta.

const imgs = new Map<string, HTMLImageElement>();

export function artUrl(name: string): string {
  return `${import.meta.env.BASE_URL}art/${name}.webp`;
}

/** La imagen si ya está lista para dibujar; si no, null (y la empieza a cargar). */
export function art(name: string): HTMLImageElement | null {
  let im = imgs.get(name);
  if (!im) {
    im = new Image();
    im.decoding = 'async';
    im.onload = () => window.dispatchEvent(new Event('artload'));
    im.src = artUrl(name);
    imgs.set(name, im);
  }
  return im.complete && im.naturalWidth > 0 ? im : null;
}

export function preloadArt(names: string[]): void {
  for (const n of names) art(n);
}

/**
 * Dibuja la imagen con `w` unidades de ancho y el punto (ax, ay) de la imagen (0..1) en el origen.
 * Devuelve false si todavía no está cargada.
 */
export function sprite(c: CanvasRenderingContext2D, name: string, w: number, ax = 0.5, ay = 0.5): boolean {
  const im = art(name);
  if (!im) return false;
  const h = (w * im.naturalHeight) / im.naturalWidth;
  c.imageSmoothingEnabled = true;
  c.imageSmoothingQuality = 'high';
  c.drawImage(im, -w * ax, -h * ay, w, h);
  return true;
}

/** Todo lo que conviene tener cargado antes de la primera partida. */
export const CORE_ART = [
  'head_s', 'head_f', 'head_blink_s', 'head_blink_f', 'head_hurt_s', 'head_hurt_f', 'head_aim_s', 'head_aim_f',
  ...['buzz', 'short', 'long', 'bun', 'afro', 'mohawk', 'pigtail', 'bob', 'curls', 'beard', 'mustache', 'goatee'].map((h) => `hair_${h}_t`),
  'hair_pigtail_x', 'cap', 'shades', 'hat', 'phones', 'helmet', 'crown', 'jetpack', 'smoke', 'fire',
  ...['arm_long', 'arm_plain', 'leg_pants', 'leg_short', 'leg_bare', 'leg_ripped', 'shoe', 'skirt'].flatMap((n) => [`${n}_s`, `${n}_t`, `${n}_f`]),
  ...['tree', 'jacaranda', 'sakura', 'palm', 'lamp', 'bush', 'hydrant', 'phonebox', 'cactus', 'sign'].map((n) => 'p_' + n),
  ...['tee', 'jersey', 'tank', 'hoodie', 'shirt', 'dress', 'suit', 'crop', 'vest'].flatMap((n) => [`top_${n}_s`, `top_${n}_t`, `top_${n}_f`]),
];
let ready = false;
/** true cuando todo el arte de personajes ya cargó: recién ahí se cambia del dibujo por código al ilustrado, entero. */
export function coreReady(): boolean {
  if (!ready) ready = CORE_ART.every((n) => art(n) !== null);
  return ready;
}

export const WEAPON_ART = ['bazooka', 'shotgun', 'launcher', 'glove', 'grenade', 'rocket', 'missile', 'booster', 'drone', 'robodog', 'battery', 'parcel', 'parachute', 'designator', 'satellite', 'interceptor', 'tablet'];

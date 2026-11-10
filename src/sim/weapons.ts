// Todas las armas son datos. Los nombres y descripciones visibles viven en src/i18n.ts (claves w.<id>).

export interface ProjDef {
  sprite: string;
  r: number;
  dmg: number;
  blast: number;
  wind: number;
  gravity: number;
  mode: 'impact' | 'timed' | 'walker' | 'homing' | 'chute';
  fuse: number;
  bounce: number;
  cluster: { count: number; def: string } | null;
  interceptable: boolean;
}

const p = (o: Partial<ProjDef> & { sprite: string; dmg: number; blast: number }): ProjDef => ({
  r: 3,
  wind: 0,
  gravity: 1,
  mode: 'impact',
  fuse: 0,
  bounce: 0,
  cluster: null,
  interceptable: true,
  ...o,
});

export const PROJ: Record<string, ProjDef> = {
  rocket: p({ sprite: 'rocket', dmg: 56, blast: 54, wind: 1 }),
  grenade: p({ sprite: 'grenade', r: 4, dmg: 60, blast: 58, mode: 'timed', fuse: 3, bounce: 0.45 }),
  homing: p({ sprite: 'homing', dmg: 50, blast: 48, mode: 'homing' }),
  orbital: p({ sprite: 'orbital', r: 8, dmg: 85, blast: 95, gravity: 0.6 }),
  drone: p({ sprite: 'drone', r: 5, dmg: 34, blast: 38 }),
  parcel: p({ sprite: 'parcel', r: 7, dmg: 40, blast: 45, mode: 'chute', cluster: { count: 5, def: 'miniparcel' } }),
  miniparcel: p({ sprite: 'mini', dmg: 24, blast: 28, wind: 0.3, interceptable: false }),
  dog: p({ sprite: 'dog', r: 5, dmg: 62, blast: 60, mode: 'walker', fuse: 7, interceptable: false }),
  battery: p({ sprite: 'battery', r: 4, dmg: 70, blast: 80, mode: 'timed', fuse: 4, bounce: 0.2, interceptable: false }),
};

export type WeaponKind = 'launch' | 'place' | 'hitscan' | 'melee' | 'target' | 'beam' | 'dome' | 'jetpack' | 'skip';

export interface WeaponDef {
  id: string;
  icon: string;
  kind: WeaponKind;
  proj: string;
  ammo: number; // -1 = infinito
  charge: boolean;
  retreat: number; // segundos para escapar después de disparar
}

export const WEAPONS: WeaponDef[] = [
  { id: 'bazooka', icon: '🚀', kind: 'launch', proj: 'rocket', ammo: -1, charge: true, retreat: 3 },
  { id: 'grenade', icon: '💣', kind: 'launch', proj: 'grenade', ammo: -1, charge: true, retreat: 3 },
  { id: 'shotgun', icon: '🔫', kind: 'hitscan', proj: '', ammo: -1, charge: false, retreat: 1.5 },
  { id: 'punch', icon: '👊', kind: 'melee', proj: '', ammo: -1, charge: false, retreat: 1.5 },
  { id: 'homing', icon: '🎯', kind: 'launch', proj: 'homing', ammo: 2, charge: true, retreat: 3 },
  { id: 'dog', icon: '🤖', kind: 'place', proj: 'dog', ammo: 2, charge: false, retreat: 7 },
  { id: 'battery', icon: '🔋', kind: 'place', proj: 'battery', ammo: 2, charge: false, retreat: 4 },
  { id: 'parcel', icon: '📦', kind: 'target', proj: 'parcel', ammo: 2, charge: false, retreat: 3 },
  { id: 'drones', icon: '🛸', kind: 'target', proj: 'drone', ammo: 1, charge: false, retreat: 3 },
  { id: 'orbital', icon: '☄️', kind: 'target', proj: 'orbital', ammo: 1, charge: false, retreat: 3 },
  { id: 'laser', icon: '🛰️', kind: 'beam', proj: '', ammo: 1, charge: false, retreat: 1.5 },
  { id: 'dome', icon: '🛡️', kind: 'dome', proj: '', ammo: 1, charge: false, retreat: 1 },
  { id: 'jetpack', icon: '🎒', kind: 'jetpack', proj: '', ammo: 2, charge: false, retreat: 0 },
  { id: 'skip', icon: '⏭️', kind: 'skip', proj: '', ammo: -1, charge: false, retreat: 0.3 },
];

export const WEAPON_BY_ID: Record<string, WeaponDef> = Object.fromEntries(WEAPONS.map((w) => [w.id, w]));

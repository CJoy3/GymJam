/**
 * Drives the gym scene from a user's ELO:
 *  - `TIERS` set the room palette + which character is shown (milestone jumps).
 *  - `FLOOR_ITEMS` / `WALL_ITEMS` pop in at their own ELO thresholds, so the
 *    room visibly fills up *between* tiers (continuous progress).
 *
 * Positions are fractions of the scene box (x: 0 = left … 1 = right). Floor
 * `band` is depth: 0 = back wall, 1 = front edge (nearer = lower + drawn on top).
 * Wall `top` is a fraction of the wall band's height.
 */
import { PROPS, WALL } from './sprites';

export interface Tier {
  name: string;
  min: number;
  wall: string;   // back-wall colour
  floor: string;  // floor colour
  character: string;
  glow: number;   // peach light intensity (0..1)
}

export interface FloorItem {
  id: string;
  label: string;
  sprite: string[];
  elo: number;
  x: number;
  band: number;
  slot: number;   // user_room_items slot (0..8) for placement persistence
}

export interface WallItem {
  id: string;
  label: string;
  sprite: string[];
  elo: number;
  x: number;
  top: number;
  slot?: number;       // omitted for structural decor
  structural?: boolean; // always shown, not user-toggleable (lamp, window)
}

export const TIERS: Tier[] = [
  { name: 'Beginner', min: 0,    wall: '#221C18', floor: '#1B1714', character: 'scrawny', glow: 0.07 },
  { name: 'Rookie',   min: 500,  wall: '#2A231F', floor: '#221C18', character: 'fit',     glow: 0.12 },
  { name: 'Regular',  min: 1000, wall: '#332B26', floor: '#2A231F', character: 'buff',    glow: 0.18 },
  { name: 'Mogger',   min: 2000, wall: '#3D332D', floor: '#332B26', character: 'mogger',  glow: 0.26 },
];

export function tierForScene(elo: number): { tier: Tier; index: number } {
  let index = 0;
  for (let i = 0; i < TIERS.length; i++) if (elo >= TIERS[i].min) index = i;
  return { tier: TIERS[index], index };
}

export const CHARACTER_BAND = 0.5;

export const FLOOR_ITEMS: FloorItem[] = [
  { id: 'mat',        label: 'Yoga Mat',   sprite: PROPS.mat,        elo: 0,    x: 0.20, band: 0.86, slot: 0 },
  { id: 'dumbbells',  label: 'Dumbbells',  sprite: PROPS.dumbbells,  elo: 0,    x: 0.82, band: 0.88, slot: 1 },
  { id: 'bench',      label: 'Bench',      sprite: PROPS.bench,      elo: 500,  x: 0.30, band: 0.34, slot: 2 },
  { id: 'plant',      label: 'Plant',      sprite: PROPS.plant,      elo: 500,  x: 0.92, band: 0.46, slot: 3 },
  { id: 'barbell',    label: 'Barbell',    sprite: PROPS.barbell,    elo: 1000, x: 0.70, band: 0.72, slot: 4 },
  { id: 'kettlebell', label: 'Kettlebell', sprite: PROPS.kettlebell, elo: 2000, x: 0.12, band: 0.58, slot: 5 },
  { id: 'trophy',     label: 'Trophy',     sprite: PROPS.trophy,     elo: 2000, x: 0.88, band: 0.74, slot: 6 },
];

export const WALL_ITEMS: WallItem[] = [
  { id: 'light',  label: 'Lamp',      sprite: WALL.light,  elo: 0,    x: 0.50, top: 0.02, structural: true },
  { id: 'window', label: 'Window',    sprite: WALL.window, elo: 0,    x: 0.28, top: 0.30, structural: true },
  { id: 'banner', label: 'Banner',    sprite: WALL.banner, elo: 1000, x: 0.62, top: 0.16, slot: 7 },
  { id: 'neon',   label: 'Neon Sign', sprite: WALL.neon,   elo: 1200, x: 0.85, top: 0.34, slot: 8 },
];

/** Slot lookup by item id, for placement writes. */
export const SLOT_BY_ID: Record<string, number> = {};
for (const it of FLOOR_ITEMS) SLOT_BY_ID[it.id] = it.slot;
for (const it of WALL_ITEMS) if (it.slot !== undefined) SLOT_BY_ID[it.id] = it.slot;

/** Everything *placeable* (excludes structural decor), in ELO order-used by
 * the collection checklist and the editor. */
export const ALL_UNLOCKS = [...FLOOR_ITEMS, ...WALL_ITEMS]
  .filter((it) => !('structural' in it && it.structural))
  .map((it) => ({ id: it.id, label: it.label, elo: it.elo }))
  .sort((a, b) => a.elo - b.elo);

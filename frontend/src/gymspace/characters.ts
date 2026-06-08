/**
 * Procedural pixel "lifter" — drawn on a 16×22 grid so it carries more detail
 * than a hand-typed sprite, and generated parametrically so all four arena
 * builds share one skeleton. Each character is a 3-frame **dumbbell curl** loop
 * (arms down → mid → up) that the scene plays on a timer.
 *
 * Palette chars map to `PX` in pixel.tsx (warm theme tones).
 */
const W = 16;
const H = 22;
type Grid = string[][];

function blank(): Grid {
  return Array.from({ length: H }, () => Array<string>(W).fill('.'));
}
function set(g: Grid, x: number, y: number, c: string) {
  if (y >= 0 && y < H && x >= 0 && x < W) g[y][x] = c;
}
function hspan(g: Grid, x0: number, x1: number, y: number, c: string) {
  for (let x = x0; x <= x1; x++) set(g, x, y, c);
}
function vspan(g: Grid, x: number, y0: number, y1: number, c: string) {
  for (let y = y0; y <= y1; y++) set(g, x, y, c);
}
function box(g: Grid, x0: number, y0: number, x1: number, y1: number, c: string) {
  for (let y = y0; y <= y1; y++) hspan(g, x0, x1, y, c);
}

interface Build {
  hair: string;
  skin: string;
  shade: string;   // skin shadow
  shirt: string;
  shirtShade: string;
  t0: number;      // torso left col
  t1: number;      // torso right col
  arm: number;     // arm thickness (px each side)
  shades?: boolean; // sunglasses
}

const HAND_Y = [15, 12, 9]; // curl phases: low → waist → shoulder

function lifter(b: Build, frame: number): string[] {
  const g = blank();
  const { hair, skin: S, shade: D, shirt: T, shirtShade: TS, t0, t1, arm } = b;
  const cx = Math.round((t0 + t1) / 2);

  // ---- Head ----
  hspan(g, 6, 9, 0, hair);
  hspan(g, 5, 10, 1, hair);
  hspan(g, 6, 9, 2, S);
  hspan(g, 5, 10, 3, S);
  hspan(g, 5, 10, 4, S);
  if (b.shades) {
    hspan(g, 5, 10, 4, 'k');
  } else {
    set(g, 6, 4, 'k');
    set(g, 9, 4, 'k');
  }
  hspan(g, 5, 10, 5, S);
  hspan(g, 6, 9, 6, S);
  set(g, 7, 6, D);
  set(g, 8, 6, D);

  // ---- Neck / traps ----
  hspan(g, 7, 8, 7, S);
  if (t1 - t0 >= 6) { set(g, 6, 7, S); set(g, 9, 7, S); }

  // ---- Torso (shirt) with a soft centre shade ----
  box(g, t0, 8, t1, 14, T);
  vspan(g, cx, 9, 13, TS);
  if (t1 - t0 >= 4) { vspan(g, cx + 2, 9, 12, TS); vspan(g, cx - 2, 9, 12, TS); }

  // ---- Sage waistband + shorts + legs + shoes ----
  hspan(g, t0, t1, 15, 'g');
  box(g, t0 + 1, 16, t1 - 1, 17, 'c');
  vspan(g, t0 + 1, 18, 20, S);
  vspan(g, t1 - 1, 18, 20, S);
  if (arm >= 3) { vspan(g, t0 + 2, 18, 20, S); vspan(g, t1 - 2, 18, 20, S); }
  hspan(g, t0, t0 + 1, 21, 'l');
  hspan(g, t1 - 1, t1, 21, 'l');

  // ---- Arms + dumbbells (the curl) ----
  const handY = HAND_Y[frame];
  for (let i = 1; i <= arm; i++) {
    vspan(g, t0 - i, 8, handY, S);
    vspan(g, t1 + i, 8, handY, S);
  }
  // outer-edge shading
  vspan(g, t0 - arm, 8, handY, D);
  vspan(g, t1 + arm, 8, handY, D);

  // dumbbells in each hand at the current curl height
  const lx = t0 - arm;
  const rx = t1 + arm;
  for (const [x, plate] of [[lx, lx - 1], [rx, rx + 1]] as const) {
    set(g, x, handY, 'm');
    set(g, plate, handY - 1, 'M');
    set(g, plate, handY, 'M');
    set(g, plate, handY + 1, 'M');
  }

  return g.map((r) => r.join(''));
}

const BUILDS: Record<string, Build> = {
  scrawny: { hair: 'd', skin: 's', shade: 'S', shirt: 'p', shirtShade: 'P', t0: 6, t1: 9,  arm: 1 },
  fit:     { hair: 'd', skin: 's', shade: 'S', shirt: 'p', shirtShade: 'P', t0: 6, t1: 9,  arm: 2 },
  buff:    { hair: 'd', skin: 's', shade: 'S', shirt: 'p', shirtShade: 'P', t0: 5, t1: 10, arm: 2 },
  mogger:  { hair: 'd', skin: 's', shade: 'S', shirt: 'p', shirtShade: 'P', t0: 4, t1: 11, arm: 3, shades: true },
};

/** Three curl frames per build. */
export const CHARACTER_FRAMES: Record<string, string[][]> = Object.fromEntries(
  Object.entries(BUILDS).map(([key, b]) => [key, [0, 1, 2].map((f) => lifter(b, f))]),
);

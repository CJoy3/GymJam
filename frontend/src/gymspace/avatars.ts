/**
 * Memoji-style pixel avatars-8 characterful 16×16 heads (people + critters),
 * painted in the warm theme palette (`PX` in pixel.tsx). Drawn on a grid so
 * widths are always correct. Keep the count at 8; ids a1..a8 are stable so a
 * saved choice keeps mapping to the same avatar.
 */
const W = 16;
const H = 16;
type Grid = string[][];

const blank = (): Grid => Array.from({ length: H }, () => Array<string>(W).fill('.'));
const set = (g: Grid, x: number, y: number, c: string) => {
  if (y >= 0 && y < H && x >= 0 && x < W) g[y][x] = c;
};
const hs = (g: Grid, x0: number, x1: number, y: number, c: string) => {
  for (let x = x0; x <= x1; x++) set(g, x, y, c);
};
const vs = (g: Grid, x: number, y0: number, y1: number, c: string) => {
  for (let y = y0; y <= y1; y++) set(g, x, y, c);
};
const box = (g: Grid, x0: number, y0: number, x1: number, y1: number, c: string) => {
  for (let y = y0; y <= y1; y++) hs(g, x0, x1, y, c);
};
/** Filled block with the four corner pixels cut, for a softer head. */
const head = (g: Grid, x0: number, y0: number, x1: number, y1: number, c: string) => {
  box(g, x0, y0, x1, y1, c);
  set(g, x0, y0, '.'); set(g, x1, y0, '.'); set(g, x0, y1, '.'); set(g, x1, y1, '.');
};
const out = (g: Grid): string[] => g.map((r) => r.join(''));

/* ── Person ─────────────────────────────────────────── */
function person(): string[] {
  const g = blank();
  head(g, 4, 4, 11, 13, 's');     // face
  vs(g, 11, 6, 12, 'S');          // cheek shade
  hs(g, 4, 11, 3, 'd'); hs(g, 3, 12, 4, 'd'); // hair
  set(g, 4, 5, 'd'); set(g, 11, 5, 'd');
  set(g, 6, 8, 'k'); set(g, 9, 8, 'k');        // eyes
  set(g, 7, 10, 'S'); set(g, 8, 10, 'S');      // nose
  hs(g, 7, 8, 11, 'S');                        // mouth
  box(g, 3, 14, 12, 15, 'p'); hs(g, 3, 12, 15, 'P'); // hoodie
  return out(g);
}

/* ── Cat ────────────────────────────────────────────── */
function cat(): string[] {
  const g = blank();
  set(g, 4, 2, 'm'); set(g, 4, 3, 'm'); set(g, 5, 3, 'm');     // ears
  set(g, 11, 2, 'm'); set(g, 11, 3, 'm'); set(g, 10, 3, 'm');
  set(g, 4, 3, 'p'); set(g, 11, 3, 'p');                       // inner ear
  head(g, 4, 4, 11, 13, 'm');
  box(g, 6, 10, 9, 12, 'w');                                   // muzzle
  set(g, 6, 8, 'k'); set(g, 9, 8, 'k');
  set(g, 7, 10, 'p'); set(g, 8, 10, 'p');                      // nose
  set(g, 2, 9, 'l'); set(g, 3, 10, 'l'); set(g, 13, 9, 'l'); set(g, 12, 10, 'l'); // whiskers
  return out(g);
}

/* ── Dog ────────────────────────────────────────────── */
function dog(): string[] {
  const g = blank();
  box(g, 2, 5, 3, 10, 'e'); box(g, 12, 5, 13, 10, 'e');        // floppy ears
  head(g, 4, 4, 11, 13, 's');
  box(g, 6, 10, 9, 12, 'l');                                   // muzzle
  set(g, 6, 8, 'k'); set(g, 9, 8, 'k');
  hs(g, 7, 8, 10, 'k');                                        // nose
  set(g, 7, 12, 'r'); set(g, 8, 12, 'r');                      // tongue
  return out(g);
}

/* ── Fox ────────────────────────────────────────────── */
function fox(): string[] {
  const g = blank();
  set(g, 4, 2, 'k'); set(g, 4, 3, 'p'); set(g, 5, 3, 'p');     // ears
  set(g, 11, 2, 'k'); set(g, 11, 3, 'p'); set(g, 10, 3, 'p');
  head(g, 4, 4, 11, 13, 'p');
  hs(g, 5, 10, 11, 'w'); hs(g, 6, 9, 12, 'w');                 // cream snout
  set(g, 6, 8, 'k'); set(g, 9, 8, 'k');
  set(g, 7, 12, 'k'); set(g, 8, 12, 'k');                      // nose
  return out(g);
}

/* ── Bear ───────────────────────────────────────────── */
function bear(): string[] {
  const g = blank();
  box(g, 3, 3, 4, 4, 'e'); box(g, 11, 3, 12, 4, 'e');          // round ears
  set(g, 3, 3, 'd'); set(g, 12, 3, 'd');
  head(g, 4, 4, 11, 13, 'e');
  box(g, 6, 10, 9, 12, 's');                                   // snout
  set(g, 6, 8, 'k'); set(g, 9, 8, 'k');
  set(g, 7, 10, 'k'); set(g, 8, 10, 'k');                      // nose
  return out(g);
}

/* ── Frog ───────────────────────────────────────────── */
function frog(): string[] {
  const g = blank();
  box(g, 4, 3, 6, 5, 'w'); box(g, 9, 3, 11, 5, 'w');           // bulging eyes
  set(g, 5, 4, 'k'); set(g, 10, 4, 'k');                       // pupils
  head(g, 3, 5, 12, 13, 'g');
  hs(g, 5, 10, 11, 'G'); set(g, 4, 10, 'G'); set(g, 11, 10, 'G'); // wide mouth
  set(g, 6, 8, 'G'); set(g, 9, 8, 'G');                        // nostrils
  return out(g);
}

/* ── Robot ──────────────────────────────────────────── */
function robot(): string[] {
  const g = blank();
  vs(g, 8, 1, 3, 'm'); set(g, 8, 1, 'p');                      // antenna
  box(g, 4, 4, 11, 13, 'm'); box(g, 4, 4, 11, 4, 'M');         // metal head
  box(g, 5, 6, 10, 11, 'd');                                   // screen
  set(g, 6, 8, 'p'); set(g, 9, 8, 'p');                        // eyes
  hs(g, 6, 9, 10, 'g');                                        // mouth
  set(g, 4, 6, 'M'); set(g, 11, 6, 'M');                       // bolts
  return out(g);
}

/* ── Owl ────────────────────────────────────────────── */
function owl(): string[] {
  const g = blank();
  set(g, 4, 2, 'd'); set(g, 4, 3, 'd'); set(g, 11, 2, 'd'); set(g, 11, 3, 'd'); // tufts
  head(g, 3, 4, 12, 13, 'd');
  box(g, 4, 6, 6, 8, 'w'); box(g, 9, 6, 11, 8, 'w');           // eye discs
  set(g, 5, 7, 'k'); set(g, 10, 7, 'k');                       // pupils
  set(g, 7, 9, 'p'); set(g, 8, 9, 'p'); set(g, 7, 10, 'p');    // beak
  hs(g, 6, 9, 12, 'l');                                        // belly
  return out(g);
}

export const AVATARS: Record<string, string[]> = {
  a1: person(),
  a2: cat(),
  a3: dog(),
  a4: fox(),
  a5: bear(),
  a6: frog(),
  a7: robot(),
  a8: owl(),
};

export const AVATAR_IDS = Object.keys(AVATARS);

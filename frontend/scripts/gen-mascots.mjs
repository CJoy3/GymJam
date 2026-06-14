// One-off: render GymJam's real pixel sprites (the gymspace "lifter" character
// builds + the otter avatar) into crisp standalone SVGs for the pitch leaflet.
// Run: node --experimental-strip-types scripts/gen-mascots.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { CHARACTER_FRAMES } from '../src/gymspace/characters.ts';
import { AVATARS } from '../src/gymspace/avatars.ts';

// PX palette — copied from src/gymspace/pixel.tsx (kept in sync by hand; '.' = transparent).
const PX = {
  '.': null, k: '#120F0D', a: '#1B1714', b: '#221C18', c: '#2A231F', d: '#332B26',
  e: '#3D332D', m: '#928374', M: '#5C5048', l: '#D2C2AB', w: '#F2E5D2', p: '#E89B7C',
  P: '#B96F52', s: '#CE946F', S: '#9E6B4E', g: '#9CB58F', G: '#6F8A66', r: '#C77A6F',
};

/** rows: string[] → SVG, merging horizontal runs of one colour into single rects. */
function gridToSvg(rows) {
  const h = rows.length;
  const w = rows[0].length;
  const rects = [];
  for (let y = 0; y < h; y++) {
    let x = 0;
    const row = rows[y];
    while (x < w) {
      const c = row[x];
      const color = PX[c] ?? null;
      if (!color) { x++; continue; }
      let run = 1;
      while (x + run < w && row[x + run] === c) run++;
      rects.push(`<rect x="${x}" y="${y}" width="${run}" height="1" fill="${color}"/>`);
      x += run;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" `
    + `shape-rendering="crispEdges">${rects.join('')}</svg>\n`;
}

const outDir = new URL('../../docs/leaflets/img/mascots/', import.meta.url);
mkdirSync(outDir, { recursive: true });

// Hero mascots: the lifter builds at their top curl frame (arms up = most heroic).
const TOP_FRAME = 2;
for (const build of ['mogger', 'buff', 'fit', 'scrawny']) {
  const frames = CHARACTER_FRAMES[build];
  const svg = gridToSvg(frames[TOP_FRAME]);
  writeFileSync(new URL(`${build}.svg`, outDir), svg);
  console.log('wrote', `${build}.svg`);
}

// The otter avatar (a5) as a cute small mascot face.
writeFileSync(new URL('otter.svg', outDir), gridToSvg(AVATARS.a5));
console.log('wrote', 'otter.svg');

/**
 * Tiny pixel-art renderer. Sprites are authored as arrays of equal-length
 * strings (one char per pixel) and drawn as run-length-merged <Rect>s inside a
 * single <Svg>, so they stay crisp at any scale with a low node count.
 *
 * The palette (`PX`) is locked to the GymJam theme tokens plus a few harmonised
 * shadow shades, so every sprite stays inside the "warm dark sanctuary" look.
 */
import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

/** char → hex, or null for transparent. All warm, theme-derived. */
export const PX: Record<string, string | null> = {
  '.': null,        // transparent
  k: '#120F0D',     // outline (a touch darker than bg)
  a: '#1B1714',     // bg
  b: '#221C18',     // bgSoft
  c: '#2A231F',     // card
  d: '#332B26',     // cardHi / hair
  e: '#3D332D',     // muted surface
  m: '#928374',     // metal / muted
  M: '#5C5048',     // metal shadow
  l: '#D2C2AB',     // inkSoft / light
  w: '#F2E5D2',     // cream highlight
  p: '#E89B7C',     // peach accent
  P: '#B96F52',     // peach shadow
  s: '#CE946F',     // skin
  S: '#9E6B4E',     // skin shadow
  g: '#9CB58F',     // sage
  G: '#6F8A66',     // sage shadow
  r: '#C77A6F',     // terracotta
};

type Cell = { x: number; w: number; color: string };

/** Merge horizontal runs of the same colour in a row into single rects. */
function runs(row: string): Cell[] {
  const out: Cell[] = [];
  let x = 0;
  while (x < row.length) {
    const ch = row[x];
    const color = PX[ch] ?? null;
    if (color === null) {
      x += 1;
      continue;
    }
    let w = 1;
    while (x + w < row.length && row[x + w] === ch) w += 1;
    out.push({ x, w, color });
    x += w;
  }
  return out;
}

export function PixelSprite({
  rows,
  pixel = 4,
  style,
}: {
  rows: string[];
  pixel?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const h = rows.length;
  const w = rows.reduce((max, r) => Math.max(max, r.length), 0);
  return (
    <Svg width={w * pixel} height={h * pixel} viewBox={`0 0 ${w} ${h}`} style={style}>
      {/* Integer-grid rects render crisp on native; web stays sharp at the
          scales we use. */}
      {rows.flatMap((row, y) =>
        runs(row).map((c, i) => (
          <Rect key={`${y}:${i}`} x={c.x} y={y} width={c.w} height={1} fill={c.color} />
        )),
      )}
    </Svg>
  );
}

/** Native pixel dimensions of a sprite, for layout math. */
export function spriteSize(rows: string[]): { w: number; h: number } {
  return { w: rows.reduce((m, r) => Math.max(m, r.length), 0), h: rows.length };
}

/**
 * Hand-authored pixel sprites for the gym scene. Each sprite is an array of
 * equal-length rows; characters map to palette entries in `pixel.tsx` (`PX`).
 * Everything is painted in the warm theme palette so it sits inside the app's
 * "sanctuary" look. Swap any sprite freely-the renderer is data-driven.
 *
 * Legend (see PX): d=hair  s/S=skin/shade  p/P=peach/shade  g/G=sage/shade
 *   c/d/e=dark surfaces  m/M=metal  l/w=cream  r=terracotta  k=outline
 */

/** Characters-same identity, progressively more jacked. 12×16 each. */
export const CHARACTERS: Record<string, string[]> = {
  scrawny: [
    '....dddd....',
    '...dssssd...',
    '...ssssss...',
    '...skssks...',
    '...ssssss...',
    '....ssss....',
    '....pppp....',
    '..s.pppp.s..',
    '..s.pppp.s..',
    '..s.cccc.s..',
    '....cccc....',
    '....c..c....',
    '....s..s....',
    '....s..s....',
    '...ll..ll...',
    '............',
  ],
  fit: [
    '....dddd....',
    '...dssssd...',
    '...ssssss...',
    '...skssks...',
    '...ssssss...',
    '....ssss....',
    '...pppppp...',
    '.ss.pppp.ss.',
    '.sS.pppp.Ss.',
    '..s.cccc.s..',
    '....cccc....',
    '....c..c....',
    '....s..s....',
    '....s..s....',
    '...ll..ll...',
    '............',
  ],
  buff: [
    '....dddd....',
    '...dssssd...',
    '...ssssss...',
    '...skssks...',
    '...ssssss...',
    '....ssss....',
    '..pppppppp..',
    'sSs.pppp.sSs',
    'sSs.pPpp.sSs',
    'sSs.pppp.sSs',
    '.s..cccc..s.',
    '....c..c....',
    '...ss..ss...',
    '....s..s....',
    '...ll..ll...',
    '............',
  ],
  mogger: [
    '....dddd....',
    '...dddddd...',
    '...ssssss...',
    '...kksskk...',
    '...ssssss...',
    '..ssssssss..',
    '.pppppppppp.',
    'sSsppppppsSs',
    'sSspPppPpsSs',
    'sSsggggggsSs',
    '.s..cccc..s.',
    '...cc..cc...',
    '...ss..ss...',
    '...ss..ss...',
    '..lll..lll..',
    '............',
  ],
};

/** Props that populate the room as ELO climbs. */
export const PROPS: Record<string, string[]> = {
  dumbbells: [
    'MM.mmm.MM',
    'MMmmmmmMM',
    'MM.mmm.MM',
  ],
  mat: [
    '.gggggg.',
    'gGgGgGgG',
    '.gggggg.',
  ],
  plant: [
    '..gg..',
    '.gggg.',
    'gggggg',
    'gGggGg',
    '.gggg.',
    '..gg..',
    '..gg..',
    '.rrrr.',
    '.rrrr.',
    '..rr..',
  ],
  bench: [
    '.cccccccccc.',
    '.dddddddddd.',
    '..m......m..',
    '..m......m..',
    '..m......m..',
  ],
  barbell: [
    'MM........MM',
    'MMmmmmmmmmMM',
    'MM........MM',
  ],
  kettlebell: [
    '..mm..',
    '.m..m.',
    '.dddd.',
    'dddddd',
    'dDddDd',
    'dddddd',
    '.dddd.',
  ],
  trophy: [
    'p.pppp.p',
    'pwwwwwwp',
    'pwwwwwwp',
    '.pwwwwp.',
    '..pwwp..',
    '...pp...',
    '..pwwp..',
    '.pwwwwp.',
    'pwwwwwwp',
  ],
};

/** Wall-mounted decor. */
export const WALL: Record<string, string[]> = {
  window: [
    'mmmmmmmmmm',
    'mbbbbbbbbm',
    'mbbwbbbbbm',
    'mbbbbbbwbm',
    'mmmmmmmmmm',
    'mbbbbbbbbm',
    'mbbbbbbbbm',
    'mmmmmmmmmm',
  ],
  banner: [
    'mmmmmmmm',
    '.pppppp.',
    '.pwwwwp.',
    '.pwggwp.',
    '.pwggwp.',
    '.pwwwwp.',
    '.pppppp.',
    '.p.pp.p.',
    '..p..p..',
  ],
  neon: [
    '.pppppppppp.',
    '.p........p.',
    '.p.gggggg.p.',
    '.p........p.',
    '.pppppppppp.',
  ],
  light: [
    '..m..',
    '..m..',
    '.ppp.',
    'ppppp',
    '.www.',
    '..w..',
  ],
};

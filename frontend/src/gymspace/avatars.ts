/**
 * Pixel-art face avatars. Built from a single 12×12 template so every row is
 * guaranteed the right width — vary hair / skin / shirt / accessories only.
 * Characters map to the theme palette (`PX` in pixel.tsx).
 */

function face({
  hair,
  skin = 's',
  shade = 'S',
  shirt,
  shades = false,
}: {
  hair: string;
  skin?: string;
  shade?: string;
  shirt: string;
  shades?: boolean;
}): string[] {
  const H = hair;
  const S = skin;
  const D = shade;
  const T = shirt;
  const eyes = shades
    ? `..${S}kkkkkk${S}..`
    : `..${S}${S}k${S}${S}k${S}${S}..`;
  return [
    `...${H}${H}${H}${H}${H}${H}...`,
    `..${H}${S}${S}${S}${S}${S}${S}${H}..`,
    `..${H}${S}${S}${S}${S}${S}${S}${H}..`,
    `..${S}${S}${S}${S}${S}${S}${S}${S}..`,
    eyes,
    `..${S}${S}${S}${S}${S}${S}${S}${S}..`,
    `..${S}${S}${S}${D}${D}${S}${S}${S}..`,
    `...${S}${D}${D}${D}${D}${S}...`,
    `....${D}${D}${D}${D}....`,
    `..${T}${T}${T}${T}${T}${T}${T}${T}..`,
    `.${T}${T}${T}${T}${T}${T}${T}${T}${T}${T}.`,
    `.${T}${T}${T}${T}${T}${T}${T}${T}${T}${T}.`,
  ];
}

export const AVATARS: Record<string, string[]> = {
  a1: face({ hair: 'd', shirt: 'p' }),                       // dark hair, peach
  a2: face({ hair: 'd', shirt: 'g' }),                       // dark hair, sage
  a3: face({ hair: 'e', shirt: 'p' }),                       // brown hair
  a4: face({ hair: 'l', shirt: 'c' }),                       // blonde, dark top
  a5: face({ hair: 'd', shirt: 'p', shades: true }),         // shades
  a6: face({ hair: 'w', shirt: 'g' }),                       // light hair, sage
  a7: face({ hair: 'd', skin: 'S', shade: 'S', shirt: 'p' }), // deeper skin tone
  a8: face({ hair: 'd', shirt: 'r' }),                       // terracotta top
};

export const AVATAR_IDS = Object.keys(AVATARS);

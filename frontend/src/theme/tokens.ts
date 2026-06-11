// GymJam design system-warm dark "sanctuary" aesthetic.
// Deep espresso surfaces, cream high-contrast primary, restrained accents
// (peach for warmth/streaks, sage for done/on-track).
//
// Color usage rules:
//   - `primary` is reserved for THE single most important action on a screen.
//   - `accent` (peach) is used sparingly: streaks, attention badges, highlights.
//   - `success` (sage) marks "done" states: completed sessions, on-track members.

export const C = {
  // Surfaces
  bg:        '#1B1714',
  bgSoft:    '#221C18',
  card:      '#2A231F',
  cardHi:    '#332B26',
  muted:     '#3D332D',

  // Text
  ink:       '#F2E5D2',
  inkSoft:   '#D2C2AB',
  mutedFg:   '#928374',

  // Primary action
  primary:   '#F2E5D2',
  primaryFg: '#1B1714',

  // Accents (sparingly)
  accent:    '#E89B7C',
  accentSoft:'rgba(232,155,124,0.16)',
  success:   '#9CB58F',
  successSoft:'rgba(156,181,143,0.18)',
  danger:    '#C77A6F',
  dangerSoft:'rgba(199,122,111,0.18)',

  // Atmospheric glow tints
  glowPeach: 'rgba(232,155,124,0.10)',
  glowSage:  'rgba(156,181,143,0.08)',
  glowCream: 'rgba(242,229,210,0.06)',

  border:    'rgba(242,229,210,0.07)',
  borderHi:  'rgba(242,229,210,0.14)',

  white:     '#FFFFFF',
};

export const RADIUS = { xs: 8, sm: 12, md: 16, lg: 20, xl: 28, xxl: 36, pill: 999 };
export const SPACE  = { xs: 4, sm: 8, md: 12, lg: 16, xl: 22, xxl: 32 };

// Font family aliases-wired to Plus Jakarta Sans variants loaded in _layout.tsx.
export const FONT = {
  regular:  'PlusJakartaSans_400Regular',
  medium:   'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold:     'PlusJakartaSans_700Bold',
  extra:    'PlusJakartaSans_800ExtraBold',
};

export const tierForElo = (elo: number) =>
  elo >= 2000 ? 'Mogger' : elo >= 1000 ? 'Regular' : elo >= 500 ? 'Rookie' : 'Beginner';

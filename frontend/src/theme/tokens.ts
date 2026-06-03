// GymJam design system — warm dark "sanctuary" aesthetic.
// Inspired by premium wellness apps: deep espresso surfaces, cream high-contrast
// primary actions, restrained accent palette (peach for warmth, sage for done).
//
// Color usage rules:
//   - `primary` is reserved for THE single most important action on a screen.
//   - `accent` (peach) is used sparingly: streaks, attention badges, highlights.
//   - `success` (sage) marks "done" states: completed sessions, on-track members.
//   - Everything else is text in shades of cream or the muted surface palette.

export const C = {
  // Base surfaces
  bg:        '#1B1714',        // deep espresso
  bgSoft:    '#221C18',        // slightly raised
  card:      '#2A231F',        // warm card surface
  cardHi:    '#332B26',        // pressed / active card
  muted:     '#3D332D',        // muted surface (chips, tracks)

  // Text
  ink:       '#F2E5D2',        // primary text — warm cream
  inkSoft:   '#D2C2AB',        // secondary text — softer cream
  mutedFg:   '#928374',        // tertiary text

  // Primary action — cream on espresso, max contrast
  primary:   '#F2E5D2',
  primaryFg: '#1B1714',

  // Accents (sparingly)
  accent:    '#E89B7C',        // warm peach — streaks, attention
  accentSoft:'rgba(232,155,124,0.16)',
  success:   '#9CB58F',        // sage — completion / on-track
  successSoft:'rgba(156,181,143,0.18)',
  danger:    '#C77A6F',
  dangerSoft:'rgba(199,122,111,0.18)',

  // Glow tints for blob backgrounds
  glowPeach: 'rgba(232,155,124,0.10)',
  glowSage:  'rgba(156,181,143,0.08)',
  glowCream: 'rgba(242,229,210,0.06)',

  border:    'rgba(242,229,210,0.07)',
  borderHi:  'rgba(242,229,210,0.14)',

  white:     '#FFFFFF',
};

export const RADIUS = { xs: 8, sm: 12, md: 16, lg: 20, xl: 28, xxl: 36, pill: 999 };
export const SPACE  = { xs: 4, sm: 8, md: 12, lg: 16, xl: 22, xxl: 32 };

// Font family aliases — wired to Plus Jakarta Sans variants loaded in _layout.tsx.
// Fall back to system if fonts haven't loaded yet (during the splash phase).
export const FONT = {
  regular:  'PlusJakartaSans_400Regular',
  medium:   'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold:     'PlusJakartaSans_700Bold',
  extra:    'PlusJakartaSans_800ExtraBold',
};

export const tierForElo = (elo: number) =>
  elo >= 2000 ? 'Mogger' : elo >= 1000 ? 'Regular' : elo >= 500 ? 'Rookie' : 'Beginner';

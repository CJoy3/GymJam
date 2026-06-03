// GymJam design tokens — warm dark mode, gym-as-community.
// Palette: charcoal base, sand text, muted sage primary, warm terracotta accent.
export const C = {
  bg:        '#1B1A18',   // charcoal base
  card:      '#272421',   // raised surface
  cardHi:    '#2F2B27',   // active / pressed surface
  ink:       '#E8DFD4',   // primary text — warm sand
  inkSoft:   '#C9C0B5',   // softer text on dark
  muted:     '#36312D',   // muted surface / track
  mutedFg:   '#8E857B',   // tertiary text
  primary:   '#8AB17D',   // sage — primary actions
  primaryFg: '#15140F',   // dark text on sage
  accent:    '#D08770',   // terracotta — streaks, warnings
  border:    'rgba(232,223,212,0.09)',
  white:     '#FFFFFF',
  danger:    '#C77575',
};

export const RADIUS = { sm: 12, md: 16, lg: 20, xl: 26, pill: 999 };
export const SPACE  = { xs: 4, sm: 8, md: 12, lg: 18, xl: 28 };

export const tierForElo = (elo: number) =>
  elo >= 2000 ? 'Mogger' : elo >= 1000 ? 'Regular' : elo >= 500 ? 'Rookie' : 'Beginner';

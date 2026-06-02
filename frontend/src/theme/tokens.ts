// GymJam design tokens — ported from the v2 web design (warm, encouraging).
export const C = {
  bg: '#FAF8F4',
  card: '#FAF8F4',
  ink: '#1A1A1A',
  muted: '#E8E5DF',
  mutedFg: '#6B6B6B',
  primary: '#A8E10C',     // electric lime
  primaryFg: '#1A1A1A',
  accent: '#FF6B4A',      // warm coral
  border: 'rgba(26,26,26,0.10)',
  white: '#FFFFFF',
  danger: '#d4183d',
};

export const RADIUS = { sm: 10, md: 14, lg: 16, xl: 22, pill: 999 };
export const SPACE = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };

export const tierForElo = (elo: number) =>
  elo >= 2000 ? 'Mogger' : elo >= 1000 ? 'Regular' : elo >= 500 ? 'Rookie' : 'Beginner';

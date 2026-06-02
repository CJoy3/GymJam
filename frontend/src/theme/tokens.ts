// GymJam design tokens — dark mode (warm, encouraging; lime/coral on near-black).
export const C = {
  bg: '#121212',          // near-black app background
  card: '#1E1E1E',        // slightly raised card surface
  ink: '#F5F3EF',         // warm off-white text
  muted: '#2A2A2A',       // muted surfaces / tracks
  mutedFg: '#A0A0A0',     // secondary text
  primary: '#A8E10C',     // electric lime
  primaryFg: '#1A1A1A',   // dark text on lime
  accent: '#FF6B4A',      // warm coral
  border: 'rgba(245,243,239,0.12)',
  white: '#FFFFFF',
  danger: '#FF5A6E',
};

export const RADIUS = { sm: 10, md: 14, lg: 16, xl: 22, pill: 999 };
export const SPACE = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };

export const tierForElo = (elo: number) =>
  elo >= 2000 ? 'Mogger' : elo >= 1000 ? 'Regular' : elo >= 500 ? 'Rookie' : 'Beginner';
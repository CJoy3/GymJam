import { apiGet } from './client';

export interface Badges {
  first_week: boolean;
  streak_master: boolean;
  early_bird: boolean;
  consistency_king: boolean;
  pot_winner: boolean;
  group_leader: boolean;
}

export const getMyBadges = () => apiGet<Badges>('/users/me/badges');

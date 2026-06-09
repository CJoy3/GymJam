import { apiGet } from './client';

export interface Gym {
  id: string;
  name: string;
  location: string | null;
  created_at: string;
}

export const listGyms = () => apiGet<Gym[]>('/gyms', { auth: false });

export interface GymMapPoint {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  member_count: number;
  avg_elo: number;
  active_today: number;
}

/** Geocoded gyms with crowd/strength stats for the map "turf" overlays. */
export const getGymsMap = () => apiGet<GymMapPoint[]>('/gyms/map', { auth: false });

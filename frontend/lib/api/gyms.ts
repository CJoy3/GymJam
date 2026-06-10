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

export interface GymMapBounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

/**
 * Geocoded gyms with crowd/strength stats for the map "turf" overlays.
 * Pass a bounding box to search a specific area (anywhere in the UK); omit it
 * for the default London view.
 */
export const getGymsMap = (bounds?: GymMapBounds) => {
  const qs = bounds
    ? `?south=${bounds.south}&west=${bounds.west}&north=${bounds.north}&east=${bounds.east}`
    : '';
  return apiGet<GymMapPoint[]>(`/gyms/map${qs}`, { auth: false });
};

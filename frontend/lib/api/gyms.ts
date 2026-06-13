import { apiGet, apiPost } from './client';

export interface Gym {
  id: string;
  name: string;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
}

export const listGyms = () => apiGet<Gym[]>('/gyms', { auth: false });

/** Turn a gym picked from the live map (OSM) into a real gym row (idempotent by
 * osm_id) so it can be set as a home gym. Returns the resolved gym. */
export const resolveGym = (point: { osm_id: string; name: string; latitude: number; longitude: number }) =>
  apiPost<Gym>('/gyms/resolve', point, { auth: false });

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
 * A bounding box of `miles` radius around a point. Used to keep gym fetches
 * small (we only ever load gyms within ~5 miles), which both bounds the payload
 * and avoids rendering hundreds of map markers at once.
 */
export function boundsAround(lat: number, lng: number, miles: number): GymMapBounds {
  const dLat = miles / 69; // ~69 miles per degree of latitude
  const dLng = dLat / Math.max(0.1, Math.cos((lat * Math.PI) / 180));
  return { south: lat - dLat, north: lat + dLat, west: lng - dLng, east: lng + dLng };
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

export interface GymLeaderboardEntry {
  id: string;
  name: string;
  member_count: number;
  total_elo: number;
  avg_elo: number;
}

/** Gyms ranked by their members' ELO (membership = users' home gym). */
export const getGymsLeaderboard = () =>
  apiGet<GymLeaderboardEntry[]>('/gyms/leaderboard', { auth: false });

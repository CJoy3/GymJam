/**
 * Private device location — kept deliberately separate from the *public*
 * location-sharing on the squad map (`users.share_location` + `users.latitude`,
 * which teammates can see). This one is stored only on the device (AsyncStorage)
 * and is NEVER sent to the backend; it's used purely client-side to:
 *   - centre the map on you when it opens, and
 *   - sort gyms by how near they are to you.
 * Granting it (e.g. the "Find gyms near me" button on login) reveals your spot to
 * no one — it just lets the app find nearby gyms for you.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';

const KEY = 'gymjam.privateLocation';

export interface Coords {
  lat: number;
  lng: number;
}

/** The last location we stored locally, or null if we've never been granted it. */
export async function getStoredLocation(): Promise<Coords | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as Coords;
    return Number.isFinite(c?.lat) && Number.isFinite(c?.lng) ? c : null;
  } catch {
    return null;
  }
}

/**
 * Ask for permission, read the current GPS fix, store it locally, and return it.
 * Returns null if permission is denied or the fix fails. Does NOT touch the
 * backend — this stays private to the device.
 */
export async function requestAndStoreLocation(): Promise<Coords | null> {
  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== 'granted') return null;
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    const c: Coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    await AsyncStorage.setItem(KEY, JSON.stringify(c)).catch(() => {});
    return c;
  } catch {
    return null;
  }
}

/**
 * The OS's last-known fix, but only if it's RECENT (≤5 min) — used to zoom the
 * map onto you instantly on open while a precise fresh fix is still resolving.
 * The freshness cap means we never snap to a stale spot (e.g. a gym you left
 * hours ago); if there's nothing recent we return null and wait for the live fix.
 */
export async function getQuickLocation(): Promise<Coords | null> {
  try {
    const perm = await Location.getForegroundPermissionsAsync();
    if (perm.status !== 'granted') return null;
    const last = await Location.getLastKnownPositionAsync({ maxAge: 5 * 60 * 1000 });
    if (last && Number.isFinite(last.coords.latitude) && Number.isFinite(last.coords.longitude)) {
      return { lat: last.coords.latitude, lng: last.coords.longitude };
    }
  } catch {
    // fall through
  }
  return null;
}

/**
 * Continuously track the device's live position (e.g. while the map is open) and
 * call `onUpdate` as it moves. Also refreshes the stored fix so the next launch
 * starts from where you actually are, not a stale spot. Returns a subscription to
 * `.remove()` on unmount, or null if permission is denied. Stays on-device — the
 * live fix is NEVER sent to the backend (that's the opt-in share-location path).
 */
export async function watchLocation(
  onUpdate: (c: Coords) => void,
): Promise<{ remove: () => void } | null> {
  try {
    let perm = await Location.getForegroundPermissionsAsync();
    if (perm.status !== 'granted') {
      perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') return null;
    }
    return await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.Balanced, timeInterval: 4000, distanceInterval: 20 },
      (pos) => {
        const c: Coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        AsyncStorage.setItem(KEY, JSON.stringify(c)).catch(() => {});
        onUpdate(c);
      },
    );
  } catch {
    return null;
  }
}

/** Forget the stored private location (e.g. on sign-out). */
export async function clearStoredLocation(): Promise<void> {
  await AsyncStorage.removeItem(KEY).catch(() => {});
}

/** Rough great-circle distance in miles — fine for sorting nearby gyms. */
export function milesBetween(a: Coords, b: { lat: number; lng: number }): number {
  const dLat = (a.lat - b.lat) * 69;
  const dLng = (a.lng - b.lng) * 69 * Math.cos((a.lat * Math.PI) / 180);
  return Math.hypot(dLat, dLng);
}

/** Miles from `from` to an item, or Infinity if the item has no coordinates. */
export function milesTo(from: Coords | null, item: { latitude: number | null; longitude: number | null }): number {
  if (!from || item.latitude == null || item.longitude == null) return Infinity;
  return milesBetween(from, { lat: item.latitude, lng: item.longitude });
}

/** Nearest-first copy of `items` when a location is known; original order otherwise. */
export function sortByProximity<T extends { latitude: number | null; longitude: number | null }>(
  items: T[],
  from: Coords | null,
): T[] {
  if (!from) return items;
  return [...items].sort((a, b) => milesTo(from, a) - milesTo(from, b));
}

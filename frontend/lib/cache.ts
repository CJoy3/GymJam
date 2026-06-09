/**
 * Tiny local cache over AsyncStorage. Used for stale-while-revalidate: the app
 * paints last-known state instantly on launch, then refreshes from the network
 * in the background. Reads are best-effort; writes are fire-and-forget.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = 'gj.cache.';

export async function readCache<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeCache(key: string, value: unknown): void {
  AsyncStorage.setItem(PREFIX + key, JSON.stringify(value)).catch(() => {});
}

export function clearCache(key: string): void {
  AsyncStorage.removeItem(PREFIX + key).catch(() => {});
}

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

const USER_ID_KEY = 'gymjam.userId';

let cached: string | null = null;

export async function getOrCreateUserId(): Promise<string> {
  if (cached) return cached;

  const existing = await AsyncStorage.getItem(USER_ID_KEY);
  if (existing) {
    cached = existing;
    return existing;
  }

  const fresh = Crypto.randomUUID();
  await AsyncStorage.setItem(USER_ID_KEY, fresh);
  cached = fresh;
  return fresh;
}

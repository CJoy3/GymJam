import 'react-native-url-polyfill/auto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from './config';

let _client: SupabaseClient | null = null;
let _promise: Promise<SupabaseClient> | null = null;

async function initialize(): Promise<SupabaseClient> {
  const res = await fetch(`${API_BASE_URL.replace('/api/v1', '')}/config`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`Config fetch failed: ${res.status}`);
  const { supabase_url, supabase_anon_key } = await res.json();
  if (!supabase_url || !supabase_anon_key) throw new Error('Supabase config missing from server');

  _client = createClient(supabase_url, supabase_anon_key, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      // Don't persist the session across app launches-the app should ALWAYS
      // open on the sign-in / create-account page. The session lives in memory
      // for the running app (so navigation works after logging in), but a cold
      // start has no session and therefore lands on Login.
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
  return _client;
}

/** Resolves once the Supabase client is ready. Safe to call multiple times. */
export function ensureSupabase(): Promise<SupabaseClient> {
  if (_client) return Promise.resolve(_client);
  if (!_promise) _promise = initialize();
  return _promise;
}

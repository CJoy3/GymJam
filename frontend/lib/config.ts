// Defaults to the production API; set EXPO_PUBLIC_API_URL (e.g. in
// .env.development) to point local runs at a preview deployment instead —
// Expo loads .env.development automatically for `expo start`/`expo start --dev-client`.
const PRODUCTION_API_HOST = 'gym-jam.vercel.app';

function resolveApiBaseUrl(): string {
  const host = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');
  return `https://${host || PRODUCTION_API_HOST}/api/v1`;
}

export const API_BASE_URL = resolveApiBaseUrl();

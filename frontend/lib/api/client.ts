import { API_BASE_URL } from '../config';
import { ensureSupabase } from '../supabase';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

type RequestOptions = {
  auth?: boolean;
  headers?: Record<string, string>;
};

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  opts: RequestOptions = {},
): Promise<T> {
  const { auth = true, headers: extra } = opts;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(extra ?? {}),
  };
  if (auth) {
    const sb = await ensureSupabase();
    const { data: { session } } = await sb.auth.getSession();
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }
  }
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    // fetch only rejects on network failure (DNS, offline, CORS)-surface a
    // clean status-0 ApiError so callers can show a friendly "network" message
    // instead of a raw TypeError. See mappers.userFacingMessage.
    throw new ApiError('Network request failed', 0);
  }
  const text = await res.text();
  if (!res.ok) {
    // Don't propagate server-fault bodies (stack traces / "Internal Server
    // Error") to the UI-keep the status so the UI layer can genericise 5xx.
    const detail = res.status >= 500 ? `HTTP ${res.status}` : extractDetail(text) || `HTTP ${res.status}`;
    throw new ApiError(detail, res.status);
  }
  return (text ? JSON.parse(text) : undefined) as T;
}

/** Pull the human-readable `detail` field out of FastAPI's error body. */
function extractDetail(text: string): string {
  if (!text) return '';
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed?.detail === 'string') return parsed.detail;
    if (Array.isArray(parsed?.detail) && parsed.detail[0]?.msg) {
      const first = parsed.detail[0];
      const field = Array.isArray(first.loc) ? first.loc.join('.') : '';
      return field ? `${field}: ${first.msg}` : first.msg;
    }
  } catch {
    // Not JSON; fall through.
  }
  return text;
}

export const apiGet = <T>(path: string, opts?: RequestOptions) =>
  request<T>('GET', path, undefined, opts);
export const apiPost = <T>(path: string, body?: unknown, opts?: RequestOptions) =>
  request<T>('POST', path, body, opts);
export const apiPatch = <T>(path: string, body?: unknown, opts?: RequestOptions) =>
  request<T>('PATCH', path, body, opts);
export const apiPut = <T>(path: string, body?: unknown, opts?: RequestOptions) =>
  request<T>('PUT', path, body, opts);
export const apiDelete = <T>(path: string, opts?: RequestOptions) =>
  request<T>('DELETE', path, undefined, opts);

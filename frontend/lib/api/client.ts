import { API_BASE_URL } from '../config';
import { getOrCreateUserId } from '../userId';

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
    headers['X-Device-Id'] = await getOrCreateUserId();
  }
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new ApiError(extractDetail(text) || `HTTP ${res.status}`, res.status);
  }
  return (text ? JSON.parse(text) : undefined) as T;
}

/** Pull the human-readable `detail` field out of FastAPI's error body. */
function extractDetail(text: string): string {
  if (!text) return '';
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed?.detail === 'string') return parsed.detail;
    if (Array.isArray(parsed?.detail) && parsed.detail[0]?.msg) return parsed.detail[0].msg;
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

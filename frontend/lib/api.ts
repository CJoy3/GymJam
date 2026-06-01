import { API_BASE_URL } from './config';

export type Pledge = {
  id: string;
  user_id: string;
  amount: number;
  created_at: string;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${res.status} ${res.statusText}: ${text || path}`);
  }
  return res.json() as Promise<T>;
}

export function listPledges(userId: string): Promise<Pledge[]> {
  return request<Pledge[]>(`/pledges?user_id=${encodeURIComponent(userId)}`);
}

export function createPledge(userId: string, amount: number): Promise<Pledge> {
  return request<Pledge>('/pledges', {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, amount }),
  });
}

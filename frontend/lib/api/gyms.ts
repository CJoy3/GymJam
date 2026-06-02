import { apiGet } from './client';

export interface Gym {
  id: string;
  name: string;
  location: string | null;
  created_at: string;
}

export const listGyms = () => apiGet<Gym[]>('/gyms', { auth: false });

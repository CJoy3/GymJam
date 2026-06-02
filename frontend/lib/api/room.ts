import { apiGet, apiPut } from './client';

export interface RoomItem {
  item_id: string;
  slot: number;
}

export const getMyRoom = () => apiGet<RoomItem[]>('/room/me');

export const setItemPlacement = (item_id: string, slot: number | null) =>
  apiPut<RoomItem[]>(`/room/me/${encodeURIComponent(item_id)}`, { slot });

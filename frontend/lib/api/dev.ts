import { apiGet, apiPost } from './client';

export interface DevClock {
  offset_days: number;
  offset_weeks: number;
  today: string;
  week_start: string;
  today_dow: number;
  // False ⇒ dev_clock table missing; offset won't survive across serverless calls.
  persisted?: boolean;
}

export const getClock = () => apiGet<DevClock>('/dev/clock');

/** Simulate the next week arriving: shifts the server clock forward 7 days. */
export const advanceWeek = () => apiPost<DevClock>('/dev/advance-week');

/** Step back one simulated week (clamped at the real current week). */
export const previousWeek = () => apiPost<DevClock>('/dev/previous-week');

/** Simulate the next day arriving. */
export const advanceDay = () => apiPost<DevClock>('/dev/advance-day');

/** Step back one simulated day (clamped at the real current day). */
export const previousDay = () => apiPost<DevClock>('/dev/previous-day');

export const resetClock = () => apiPost<DevClock>('/dev/reset-clock');

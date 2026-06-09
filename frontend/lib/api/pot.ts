import { apiGet, apiPut } from './client';

export interface PotMember {
  user_id: string;
  display_name: string;
  role: 'member' | 'leader';
  pledged_count: number;
  completed_count: number;
  missed_count: number;
  elo_at_risk: number;
  elo_lost_so_far: number;
  is_setter: boolean;
  is_on_track: boolean;
}

export interface PotDetail {
  group_id: string;
  week_start: string;
  setter_user_id: string | null;
  setter_display_name: string | null;
  required_pledges: number;
  stake_per_miss: number;
  is_finalized: boolean;
  is_practice: boolean;
  stake_type: 'elo' | 'money';
  total_pot_elo: number;
  members: PotMember[];
}

/**
 * Normalize whatever the server returns so older deployments (which serve the
 * pre-conditions shape `{ total_elo, contributor_count }`) don't crash the UI.
 * Every numeric field falls back to 0, every array to [], every flag to false.
 */
function normalizeMember(raw: any): PotMember {
  return {
    user_id: raw?.user_id ?? '',
    display_name: raw?.display_name ?? 'Anonymous',
    role: raw?.role === 'leader' ? 'leader' : 'member',
    pledged_count: typeof raw?.pledged_count === 'number' ? raw.pledged_count : 0,
    completed_count: typeof raw?.completed_count === 'number' ? raw.completed_count : 0,
    missed_count: typeof raw?.missed_count === 'number' ? raw.missed_count : 0,
    elo_at_risk: typeof raw?.elo_at_risk === 'number' ? raw.elo_at_risk : 0,
    elo_lost_so_far: typeof raw?.elo_lost_so_far === 'number' ? raw.elo_lost_so_far : 0,
    is_setter: !!raw?.is_setter,
    is_on_track: !!raw?.is_on_track,
  };
}

function normalizeDetail(raw: any): PotDetail {
  return {
    group_id: raw?.group_id ?? '',
    week_start: raw?.week_start ?? '',
    setter_user_id: raw?.setter_user_id ?? null,
    setter_display_name: raw?.setter_display_name ?? null,
    required_pledges: typeof raw?.required_pledges === 'number' ? raw.required_pledges : 0,
    stake_per_miss: typeof raw?.stake_per_miss === 'number' ? raw.stake_per_miss : 0,
    is_finalized: !!raw?.is_finalized,
    is_practice: !!raw?.is_practice,
    stake_type: raw?.stake_type === 'money' ? 'money' : 'elo',
    total_pot_elo:
      typeof raw?.total_pot_elo === 'number'
        ? raw.total_pot_elo
        : typeof raw?.total_elo === 'number'
          ? raw.total_elo
          : 0,
    members: Array.isArray(raw?.members) ? raw.members.map(normalizeMember) : [],
  };
}

export const getPotDetail = async (group_id: string, week: 'current' | 'next' = 'current') => {
  const raw = await apiGet<unknown>(`/groups/${group_id}/pot?week=${week}`);
  return normalizeDetail(raw);
};

export const updatePotConditions = async (
  group_id: string,
  week: 'current' | 'next',
  required_pledges: number,
  stake_per_miss: number,
) => {
  const raw = await apiPut<unknown>(
    `/groups/${group_id}/pot/conditions?week=${week}`,
    { required_pledges, stake_per_miss },
  );
  return normalizeDetail(raw);
};

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
  total_pot_elo: number;
  members: PotMember[];
}

export const getPotDetail = (group_id: string, week: 'current' | 'next' = 'current') =>
  apiGet<PotDetail>(`/groups/${group_id}/pot?week=${week}`);

export const updatePotConditions = (
  group_id: string,
  week: 'current' | 'next',
  required_pledges: number,
  stake_per_miss: number,
) =>
  apiPut<PotDetail>(
    `/groups/${group_id}/pot/conditions?week=${week}`,
    { required_pledges, stake_per_miss },
  );

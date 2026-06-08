/** Pure view-model helpers used by the AppState provider. No React, no I/O. */
import * as groupsApi from '../../lib/api/groups';
import * as plansApi from '../../lib/api/plans';
import * as potApi from '../../lib/api/pot';
import { showToast } from '../ui/toast';
import { DAYS, DayState, DayStatus, Group } from './types';

export function tierForElo(elo: number): string {
  return elo >= 2000 ? 'Mogger' : elo >= 1000 ? 'Regular' : elo >= 500 ? 'Rookie' : 'Beginner';
}

export function planToWeek(plan: plansApi.WeeklyPlan): DayStatus[] {
  // server returns days sorted by day_of_week 0..6
  return DAYS.map((day, i) => {
    const found = plan.days.find((d) => d.day_of_week === i);
    return { day, state: (found?.state ?? 'unselected') as DayState };
  });
}

export function daysToWeek(days: plansApi.PlanDay[]): DayStatus[] {
  return DAYS.map((day, i) => {
    const found = days.find((d) => d.day_of_week === i);
    return { day, state: (found?.state ?? 'unselected') as DayState };
  });
}

export function setSelectedDays(week: DayStatus[], selected: number[]): DayStatus[] {
  const selectedDays = new Set(selected);
  return week.map((day, i) => ({
    ...day,
    state: selectedDays.has(i) ? 'planned' : 'unselected',
  }));
}

export function setSelectedFutureDays(week: DayStatus[], selected: number[], todayDow: number): DayStatus[] {
  const selectedDays = new Set(selected);
  return week.map((day, i) => {
    if (i <= todayDow) return day;
    return { ...day, state: selectedDays.has(i) ? 'planned' : 'unselected' };
  });
}

export function toggleWeekDay(week: DayStatus[], index: number): DayStatus[] {
  return week.map((day, i) => {
    if (i !== index) return day;
    return {
      ...day,
      state: day.state === 'planned' || day.state === 'locked' ? 'unselected' : 'planned',
    };
  });
}

export function lockPlannedDays(week: DayStatus[]): DayStatus[] {
  return week.map((day) => (day.state === 'planned' ? { ...day, state: 'locked' } : day));
}

export function recalcPotDetail(
  detail: potApi.PotDetail | null,
  required: number,
  stake: number,
): potApi.PotDetail | null {
  if (!detail) return null;
  const members = detail.members.map((member) => ({
    ...member,
    elo_at_risk: member.pledged_count * stake,
    elo_lost_so_far: member.missed_count * stake,
  }));

  return {
    ...detail,
    required_pledges: required,
    stake_per_miss: stake,
    total_pot_elo: members.reduce((sum, member) => sum + member.elo_lost_so_far, 0),
    members,
  };
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (!parts[0]) return 'YOU';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function todayIndexForWeek(week: DayStatus[]): number {
  // matches the original: first 'planned' day in this week
  return week.findIndex((d) => d.state === 'planned');
}

export function summaryToGroup(s: groupsApi.GroupSummary): Group {
  return {
    id: s.id,
    name: s.name,
    members: s.member_count,
    tier: 'Regular',
    stake: `${s.weekly_stake_elo} ELO`,
    joinType: s.join_type,
    isLeader: s.is_leader,
    isMember: s.is_member,
    requested: s.join_request_pending,
  };
}

export function reportError(action: string, e: unknown): void {
  const msg = e instanceof Error ? e.message : 'Unknown error';
  showToast(`${action}: ${msg}`, 'error');
}

import React, { createContext, useContext, useState, ReactNode } from 'react';

export type DayState = 'planned' | 'checked-in' | 'missed' | 'locked' | 'unselected';
export interface DayStatus { day: string; state: DayState; }

export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const makeWeek = (planned: number[] = [], checkedIn: number[] = []): DayStatus[] =>
  DAYS.map((day, i) => ({
    day,
    state: checkedIn.includes(i) ? 'checked-in' : planned.includes(i) ? 'planned' : 'unselected',
  }));

export interface Group {
  name: string; members: number; tier: string; stake: string;
  joinType: 'open' | 'request'; isLeader?: boolean;
}
export interface JoinRequest { id: number; userName: string; groupName: string; }

interface AppStateShape {
  gymName: string; groupName: string;
  setGym: (g: string) => void; joinGroup: (g: string) => void; leaveGroup: () => void;
  groups: Group[]; addGroup: (g: Group) => void;
  joinRequests: JoinRequest[];
  requestToJoin: (g: string) => void; approveRequest: (id: number) => void; rejectRequest: (id: number) => void;
  thisWeek: DayStatus[]; checkInToday: () => void; todayIndex: number;
  nextWeek: DayStatus[]; toggleNextWeekDay: (i: number) => void; lockNextWeek: () => void; addNextWeekDay: (i: number) => void;
  elo: number; streak: number; pot: number;
}

const Ctx = createContext<AppStateShape | null>(null);

const INITIAL_GROUPS: Group[] = [
  { name: 'Morning Crew', members: 8, tier: 'Regular', stake: '500 ELO', joinType: 'open' },
  { name: 'Lunchtime Warriors', members: 6, tier: 'Rookie', stake: '300 ELO', joinType: 'request' },
  { name: 'Evening Grinders', members: 12, tier: 'Mogger', stake: '1000 ELO', joinType: 'request' },
  { name: 'Weekend Warriors', members: 4, tier: 'Beginner', stake: '100 ELO', joinType: 'open' },
  { name: 'Consistency Crew', members: 10, tier: 'Regular', stake: '500 ELO', joinType: 'open' },
];

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [gymName, setGymName] = useState('');
  const [groupName, setGroupName] = useState('');
  const [groups, setGroups] = useState<Group[]>(INITIAL_GROUPS);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [reqId, setReqId] = useState(1);

  const [thisWeek, setThisWeek] = useState<DayStatus[]>(makeWeek([1, 4], [0, 2]));
  const [nextWeek, setNextWeek] = useState<DayStatus[]>(makeWeek());

  const [elo, setElo] = useState(1450);
  const [streak] = useState(12);
  const [pot] = useState(2500);

  const todayIndex = thisWeek.findIndex((d) => d.state === 'planned');

  const setGym = (g: string) => { setGymName(g); setGroupName(''); };
  const joinGroup = (g: string) => setGroupName(g);
  const leaveGroup = () => setGroupName('');
  const addGroup = (g: Group) => setGroups((prev) => [{ ...g, isLeader: true }, ...prev]);

  const requestToJoin = (g: string) => {
    setJoinRequests((r) => [...r, { id: reqId, userName: 'You', groupName: g }]);
    setReqId((n) => n + 1);
  };
  const approveRequest = (id: number) => {
    const req = joinRequests.find((r) => r.id === id);
    setJoinRequests((r) => r.filter((x) => x.id !== id));
    if (req && req.userName === 'You') setGroupName(req.groupName);
  };
  const rejectRequest = (id: number) => setJoinRequests((r) => r.filter((x) => x.id !== id));

  const checkInToday = () => {
    setThisWeek((week) => {
      const idx = week.findIndex((d) => d.state === 'planned');
      if (idx === -1) return week;
      return week.map((d, i) => (i === idx ? { ...d, state: 'checked-in' } : d));
    });
    setElo((e) => e + 10);
  };
  const toggleNextWeekDay = (index: number) =>
    setNextWeek((days) => days.map((d, i) => (i === index ? { ...d, state: d.state === 'planned' ? 'unselected' : 'planned' } : d)));
  const addNextWeekDay = (index: number) =>
    setNextWeek((days) => days.map((d, i) => (i === index && d.state === 'unselected' ? { ...d, state: 'planned' } : d)));
  const lockNextWeek = () =>
    setNextWeek((days) => days.map((d) => (d.state === 'planned' ? { ...d, state: 'locked' } : d)));

  return (
    <Ctx.Provider value={{
      gymName, groupName, setGym, joinGroup, leaveGroup,
      groups, addGroup, joinRequests, requestToJoin, approveRequest, rejectRequest,
      thisWeek, checkInToday, todayIndex,
      nextWeek, toggleNextWeekDay, lockNextWeek, addNextWeekDay,
      elo, streak, pot,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAppState() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAppState must be used within AppStateProvider');
  return ctx;
}

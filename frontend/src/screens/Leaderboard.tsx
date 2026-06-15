import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { C, FONT, SPACE } from '../theme/tokens';
import { Card, Chip, Eyebrow, FadeInItem, H1, IconButton, Sub } from '../ui/components';
import { Avatar } from '../ui/Avatar';
import { BlobBackground } from '../ui/Blob';
import { useRefreshControl } from '../ui/useRefresh';
import { usePolling } from '../ui/usePolling';
import { showToast } from '../ui/toast';
import { userFacingMessage } from '../state/mappers';
import { useAppState } from '../state/AppState';
import { getGymsLeaderboard, type GymLeaderboardEntry } from '../../lib/api/gyms';
import { getUsersLeaderboard, type LeaderboardUser } from '../../lib/api/users';
import { sendFriendRequestToUser } from '../../lib/api/friends';
import { pageWrap, styles } from './_shared';

const RANK_TONE: Record<number, { bg: string; fg: string }> = {
  0: { bg: '#F4D58D', fg: '#6B4E00' },
  1: { bg: '#E0E0E0', fg: '#4A4A4A' },
  2: { bg: '#E3B08C', fg: '#5A3418' },
};

type MainTab = 'groups' | 'gyms' | 'squad' | 'global';
type SortMode = 'total' | 'average';

export function Leaderboard({ onBack }: { onBack: () => void }) {
  const { groupId, groups, groupMembers, userId, gymId, refreshGroupsAtGym } = useAppState();
  const refresh = useRefreshControl();
  usePolling(refreshGroupsAtGym, 12000);

  const [mainTab, setMainTab] = useState<MainTab>('groups');
  const [sortMode, setSortMode] = useState<SortMode>('total');
  const [gymBoard, setGymBoard] = useState<GymLeaderboardEntry[]>([]);
  const loadGymBoard = useCallback(() => getGymsLeaderboard().then(setGymBoard).catch(() => {}), []);
  usePolling(loadGymBoard, 12000);

  // Global leaderboard: every user ranked by ELO, with inline Add-friend.
  const [globalBoard, setGlobalBoard] = useState<LeaderboardUser[]>([]);
  const loadGlobalBoard = useCallback(() => getUsersLeaderboard().then(setGlobalBoard).catch(() => {}), []);
  usePolling(loadGlobalBoard, 15000);
  // Users we've sent a request to this session, so the button flips to 'Sent'.
  const [requested, setRequested] = useState<string[]>([]);
  const addFriend = async (u: LeaderboardUser) => {
    setRequested((prev) => [...prev, u.user_id]); // optimistic
    try {
      const res = await sendFriendRequestToUser(u.user_id);
      showToast(res.action === 'accepted' ? `You're now friends with ${u.display_name}` : 'Friend request sent', 'success');
      void loadGlobalBoard();
    } catch (e) {
      setRequested((prev) => prev.filter((id) => id !== u.user_id));
      showToast(userFacingMessage(e), 'error');
    }
  };

  const rankedGroups = [...groups].sort((a, b) => {
    if (sortMode === 'average') {
      const avgA = a.members > 0 ? a.totalElo / a.members : 0;
      const avgB = b.members > 0 ? b.totalElo / b.members : 0;
      return avgB - avgA;
    }
    return b.totalElo - a.totalElo;
  });

  const rankedGyms = [...gymBoard].sort((a, b) =>
    sortMode === 'average' ? b.avg_elo - a.avg_elo : b.total_elo - a.total_elo);

  const rankedMembers = [...groupMembers].sort((a, b) => b.elo - a.elo);

  return (
    <View style={styles.screen}>
      <BlobBackground variant="group" />
      <ScrollView refreshControl={refresh} contentContainerStyle={pageWrap} showsVerticalScrollIndicator={false}>
        <FadeInItem>
          <View style={styles.rowBetween}>
            <IconButton icon="arrow-back" onPress={onBack} />
          </View>
        </FadeInItem>

        <FadeInItem delay={60} style={{ marginTop: 18 }}>
          <Eyebrow>Rankings</Eyebrow>
          <H1 style={{ marginTop: 6 }}>Leaderboard</H1>
        </FadeInItem>

        {/* Main tabs */}
        <FadeInItem delay={100} style={{ marginTop: 20 }}>
          <View style={styles.tabBar}>
            <Pressable
              style={[styles.tab, mainTab === 'groups' && styles.tabOn]}
              onPress={() => setMainTab('groups')}
            >
              <Text style={[styles.tabText, { color: mainTab === 'groups' ? C.primaryFg : C.mutedFg }]}>
                Groups
              </Text>
            </Pressable>
            <Pressable
              style={[styles.tab, mainTab === 'gyms' && styles.tabOn]}
              onPress={() => setMainTab('gyms')}
            >
              <Text style={[styles.tabText, { color: mainTab === 'gyms' ? C.primaryFg : C.mutedFg }]}>
                Gyms
              </Text>
            </Pressable>
            <Pressable
              style={[styles.tab, mainTab === 'squad' && styles.tabOn]}
              onPress={() => setMainTab('squad')}
            >
              <Text style={[styles.tabText, { color: mainTab === 'squad' ? C.primaryFg : C.mutedFg }]}>
                My Squad
              </Text>
            </Pressable>
            <Pressable
              style={[styles.tab, mainTab === 'global' && styles.tabOn]}
              onPress={() => setMainTab('global')}
            >
              <Text style={[styles.tabText, { color: mainTab === 'global' ? C.primaryFg : C.mutedFg }]}>
                Global
              </Text>
            </Pressable>
          </View>
        </FadeInItem>

        {mainTab === 'groups' && (
          <>
            {/* Sort toggle */}
            <FadeInItem delay={120} style={{ marginTop: 14 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <SortBtn label="Total ELO" active={sortMode === 'total'} onPress={() => setSortMode('total')} />
                <SortBtn label="Average ELO" active={sortMode === 'average'} onPress={() => setSortMode('average')} />
              </View>
              <Sub style={{ marginTop: 8 }}>
                {sortMode === 'total'
                  ? 'Groups ranked by combined member ELO'
                  : 'Groups ranked by average member ELO'}
              </Sub>
            </FadeInItem>

            <View style={{ gap: 12, marginTop: 16 }}>
              {rankedGroups.length === 0 ? (
                <FadeInItem delay={140}>
                  <Card padding={SPACE.xl}><Sub style={{ textAlign: 'center' }}>No groups yet.</Sub></Card>
                </FadeInItem>
              ) : rankedGroups.map((g, i) => {
                const isMine = g.id === groupId;
                const tone = RANK_TONE[i];
                const displayElo = sortMode === 'average'
                  ? Math.round(g.totalElo / Math.max(1, g.members))
                  : g.totalElo;
                return (
                  <FadeInItem key={g.id} delay={140 + i * 40}>
                    <Card padding={SPACE.lg} style={isMine ? { borderColor: C.primary, borderWidth: 1.5 } : undefined}>
                      <View style={styles.rowGap}>
                        <View style={[styles.avatar, { backgroundColor: tone?.bg ?? C.muted }]}>
                          <Text style={{ fontFamily: FONT.bold, fontSize: 14, color: tone?.fg ?? C.inkSoft }}>{i + 1}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={[styles.rowGap, { flexWrap: 'wrap', gap: 6 }]}>
                            <Text style={styles.cardTitle}>{g.name}</Text>
                            {isMine && <Chip text="Your group" tone="success" compact />}
                          </View>
                          <View style={[styles.rowGap, { gap: 8, marginTop: 6, flexWrap: 'wrap' }]}>
                            <Sub>{g.members} {g.members === 1 ? 'member' : 'members'}</Sub>
                            <Text style={styles.dot}>·</Text>
                            <Sub>{displayElo.toLocaleString()} ELO {sortMode === 'average' ? 'avg' : ''}</Sub>
                          </View>
                        </View>
                      </View>
                    </Card>
                  </FadeInItem>
                );
              })}
            </View>
          </>
        )}

        {mainTab === 'gyms' && (
          <>
            {/* Sort toggle */}
            <FadeInItem delay={120} style={{ marginTop: 14 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <SortBtn label="Total ELO" active={sortMode === 'total'} onPress={() => setSortMode('total')} />
                <SortBtn label="Average ELO" active={sortMode === 'average'} onPress={() => setSortMode('average')} />
              </View>
              <Sub style={{ marginTop: 8 }}>
                {sortMode === 'total'
                  ? 'Gyms ranked by combined member ELO'
                  : 'Gyms ranked by average member ELO'}
              </Sub>
            </FadeInItem>

            <View style={{ gap: 12, marginTop: 16 }}>
              {rankedGyms.length === 0 ? (
                <FadeInItem delay={140}>
                  <Card padding={SPACE.xl}><Sub style={{ textAlign: 'center' }}>No gyms ranked yet.</Sub></Card>
                </FadeInItem>
              ) : rankedGyms.map((g, i) => {
                const isMine = g.id === gymId;
                const tone = RANK_TONE[i];
                const displayElo = sortMode === 'average' ? g.avg_elo : g.total_elo;
                return (
                  <FadeInItem key={g.id} delay={140 + i * 40}>
                    <Card padding={SPACE.lg} style={isMine ? { borderColor: C.primary, borderWidth: 1.5 } : undefined}>
                      <View style={styles.rowGap}>
                        <View style={[styles.avatar, { backgroundColor: tone?.bg ?? C.muted }]}>
                          <Text style={{ fontFamily: FONT.bold, fontSize: 14, color: tone?.fg ?? C.inkSoft }}>{i + 1}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={[styles.rowGap, { flexWrap: 'wrap', gap: 6 }]}>
                            <Text style={styles.cardTitle}>{g.name}</Text>
                            {isMine && <Chip text="Your gym" tone="success" compact />}
                          </View>
                          <View style={[styles.rowGap, { gap: 8, marginTop: 6, flexWrap: 'wrap' }]}>
                            <Sub>{g.member_count} {g.member_count === 1 ? 'member' : 'members'}</Sub>
                            <Text style={styles.dot}>·</Text>
                            <Sub>{displayElo.toLocaleString()} ELO {sortMode === 'average' ? 'avg' : ''}</Sub>
                          </View>
                        </View>
                      </View>
                    </Card>
                  </FadeInItem>
                );
              })}
            </View>
          </>
        )}

        {mainTab === 'squad' && (
          <>
            <FadeInItem delay={120} style={{ marginTop: 14 }}>
              <Sub>Your group members ranked by ELO</Sub>
            </FadeInItem>

            <View style={{ gap: 10, marginTop: 16 }}>
              {!groupId || rankedMembers.length === 0 ? (
                <FadeInItem delay={140}>
                  <Card padding={SPACE.xl}>
                    <Sub style={{ textAlign: 'center' }}>
                      {groupId ? 'No members yet.' : 'Join a group to see your squad.'}
                    </Sub>
                  </Card>
                </FadeInItem>
              ) : rankedMembers.map((m, i) => {
                const isMe = m.userId === userId;
                const tone = RANK_TONE[i];
                return (
                  <FadeInItem key={m.userId} delay={140 + i * 40}>
                    <Card padding={SPACE.lg} style={isMe ? { borderColor: C.primary, borderWidth: 1.5 } : undefined}>
                      <View style={styles.rowGap}>
                        <View style={[styles.avatar, { backgroundColor: tone?.bg ?? C.muted }]}>
                          <Text style={{ fontFamily: FONT.bold, fontSize: 14, color: tone?.fg ?? C.inkSoft }}>{i + 1}</Text>
                        </View>
                        <Avatar id={m.avatar} name={m.name} size={38} />
                        <View style={{ flex: 1 }}>
                          <View style={[styles.rowGap, { flexWrap: 'wrap', gap: 6 }]}>
                            <Text style={styles.cardTitle}>{m.name}</Text>
                            {isMe && <Chip text="You" tone="success" compact />}
                            {m.isLeader && <Chip text="Leader" tone="accent" compact />}
                          </View>
                          <Sub style={{ marginTop: 4 }}>{m.elo.toLocaleString()} ELO</Sub>
                        </View>
                      </View>
                    </Card>
                  </FadeInItem>
                );
              })}
            </View>
          </>
        )}

        {mainTab === 'global' && (
          <>
            <FadeInItem delay={120} style={{ marginTop: 14 }}>
              <Sub>Everyone ranked by ELO · add friends to follow their week</Sub>
            </FadeInItem>

            <View style={{ gap: 10, marginTop: 16 }}>
              {globalBoard.length === 0 ? (
                <FadeInItem delay={140}>
                  <Card padding={SPACE.xl}><Sub style={{ textAlign: 'center' }}>No one ranked yet.</Sub></Card>
                </FadeInItem>
              ) : globalBoard.map((u, i) => {
                const isMe = u.is_me || u.user_id === userId;
                const tone = RANK_TONE[i];
                const sent = u.friend_status === 'requested' || requested.includes(u.user_id);
                return (
                  <FadeInItem key={u.user_id} delay={140 + i * 30}>
                    <Card padding={SPACE.lg} style={isMe ? { borderColor: C.primary, borderWidth: 1.5 } : undefined}>
                      <View style={styles.rowGap}>
                        <View style={[styles.avatar, { backgroundColor: tone?.bg ?? C.muted }]}>
                          <Text style={{ fontFamily: FONT.bold, fontSize: 14, color: tone?.fg ?? C.inkSoft }}>{i + 1}</Text>
                        </View>
                        <Avatar id={u.avatar} name={u.display_name} size={38} />
                        <View style={{ flex: 1 }}>
                          <View style={[styles.rowGap, { flexWrap: 'wrap', gap: 6 }]}>
                            <Text style={styles.cardTitle}>{u.display_name}</Text>
                            {isMe && <Chip text="You" tone="success" compact />}
                          </View>
                          <Sub style={{ marginTop: 4 }}>
                            {u.tag ? `#${u.tag} · ` : ''}{u.elo.toLocaleString()} ELO
                          </Sub>
                        </View>
                        {/* Friends → a quiet chip; already requested → disabled 'Sent';
                            otherwise an Add button (sends a request to that user). */}
                        {!isMe && (u.friend_status === 'friends' ? (
                          <Chip text="Friends" tone="accent" compact />
                        ) : (
                          <Pressable
                            onPress={() => addFriend(u)}
                            disabled={sent}
                            style={[styles.linkBtn, sent && { opacity: 0.45 }]}
                          >
                            <MaterialIcons name={sent ? 'check' : 'person-add'} size={15} color={C.ink} />
                            <Text style={styles.linkText}>{sent ? 'Sent' : 'Add'}</Text>
                          </Pressable>
                        ))}
                      </View>
                    </Card>
                  </FadeInItem>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function SortBtn({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: 14, paddingVertical: 7,
        borderRadius: 20,
        backgroundColor: active ? C.primary : C.card,
        borderWidth: 1, borderColor: active ? C.primary : C.borderHi,
      }}
    >
      <Text style={{ fontFamily: FONT.semibold, fontSize: 13, color: active ? C.primaryFg : C.mutedFg }}>
        {label}
      </Text>
    </Pressable>
  );
}

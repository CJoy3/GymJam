import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { C, FONT, SPACE } from '../theme/tokens';
import { Card, Chip, Eyebrow, FadeInItem, H1, H3, IconButton, Sub } from '../ui/components';
import { Avatar } from '../ui/Avatar';
import { useCoachTarget } from '../ui/CoachMarks';
import { DayPicker } from '../ui/DayPicker';
import { BlobBackground } from '../ui/Blob';
import { useRefreshControl } from '../ui/useRefresh';
import { usePolling } from '../ui/usePolling';
import { useAppState } from '../state/AppState';
import { readCache, writeCache } from '../../lib/cache';
import { FriendsSection } from './FriendsSection';
import { pageWrap, styles } from './_shared';

const DISMISSED_KEY = 'dismissedActivity';

/* Group view-members, notifications menu, per-day join + nudges */

const KIND_META: Record<string, { icon: keyof typeof MaterialIcons.glyphMap; color: string }> = {
  join_request: { icon: 'person-add', color: C.accent },
  nudge: { icon: 'campaign', color: C.accent },
  missed: { icon: 'close', color: C.danger },
  checkin: { icon: 'check-circle', color: C.success },
  streak: { icon: 'local-fire-department', color: C.accent },
};

export function GroupView({ onBrowse, onLeaderboard }: { onBrowse: () => void; onLeaderboard: () => void }) {
  const {
    groupName, groupMembers, refreshGroup, potNext, userId,
    activity, refreshActivity, approveRequest, rejectRequest, nudge, nudgeCooldowns,
  } = useAppState();
  const refresh = useRefreshControl();
  const tourTarget = useCoachTarget('tour-group');
  const [showFeed, setShowFeed] = useState(false);
  // Locally-dismissed notification ids, persisted so they stay cleared across
  // sessions. Join requests are never dismissable (they're actionable), so they
  // always reappear regardless of this set.
  const [dismissed, setDismissed] = useState<string[]>([]);
  useEffect(() => { readCache<string[]>(DISMISSED_KEY).then((d) => { if (d) setDismissed(d); }); }, []);
  // Keep the group fresh: refresh on open, on app foreground, and gently while viewing.
  usePolling(refreshGroup, 9000);
  const setterName = potNext?.setter_user_id === userId ? 'You' : potNext?.setter_display_name;
  // Put my row first so I always see myself at the top of the group.
  const orderedMembers = userId
    ? [...groupMembers].sort((a, b) => Number(b.userId === userId) - Number(a.userId === userId))
    : groupMembers;

  // Join requests always show; everything else hides once dismissed.
  const visibleActivity = activity.filter((a) => a.kind === 'join_request' || !dismissed.includes(a.id));
  const actionableCount = visibleActivity.filter((a) => a.kind === 'join_request' || a.kind === 'nudge').length;
  const clearableCount = visibleActivity.filter((a) => a.kind !== 'join_request').length;

  const clearNotifications = () => {
    const ids = activity.filter((a) => a.kind !== 'join_request').map((a) => a.id);
    const next = Array.from(new Set([...dismissed, ...ids]));
    setDismissed(next);
    writeCache(DISMISSED_KEY, next);
  };

  const toggleFeed = () => {
    setShowFeed((s) => {
      if (!s) refreshActivity();
      return !s;
    });
  };

  return (
    <View style={styles.screen}>
      <BlobBackground variant="group" />
      <ScrollView refreshControl={refresh} contentContainerStyle={pageWrap} showsVerticalScrollIndicator={false}>
        <FadeInItem>
          <View ref={tourTarget} collapsable={false} style={styles.rowBetween}>
            <View style={{ flex: 1 }}>
              <Eyebrow>Your group</Eyebrow>
              <H1 style={{ marginTop: 6 }}>{groupName}</H1>
              <Sub style={{ marginTop: 6 }}>
                {groupMembers.length} {groupMembers.length === 1 ? 'member' : 'members'} · this week
              </Sub>
            </View>
            <View style={[styles.rowGap, { gap: 8 }]}>
              <IconButton
                icon={showFeed ? 'notifications-active' : 'notifications-none'}
                color={showFeed ? C.accent : C.ink}
                onPress={toggleFeed}
              >
                {actionableCount > 0 && (
                  <View style={badge.dot}>
                    <Text style={badge.text}>{actionableCount}</Text>
                  </View>
                )}
              </IconButton>
              <IconButton icon="emoji-events" onPress={onLeaderboard} />
              <IconButton icon="swap-horiz" onPress={onBrowse} />
            </View>
          </View>
        </FadeInItem>

        {showFeed && (
          <FadeInItem delay={40} style={{ marginTop: 16 }}>
            <Card padding={SPACE.lg}>
              <View style={[styles.rowBetween, { marginBottom: 12 }]}>
                <Eyebrow>Notifications</Eyebrow>
                {clearableCount > 0 && (
                  <Pressable onPress={clearNotifications} hitSlop={8} style={styles.rowGap}>
                    <MaterialIcons name="clear-all" size={15} color={C.mutedFg} />
                    <Text style={{ fontFamily: FONT.semibold, fontSize: 13, color: C.mutedFg }}>Clear</Text>
                  </Pressable>
                )}
              </View>
              {visibleActivity.length === 0 ? (
                <Sub style={{ textAlign: 'center' }}>
                  No updates yet. Plan sessions and nudge teammates to get things going.
                </Sub>
              ) : (
                <View style={{ gap: 14 }}>
                  {visibleActivity.map((a) => {
                    const meta = KIND_META[a.kind] ?? KIND_META.nudge;
                    return (
                      <View key={a.id} style={styles.rowGap}>
                        <View style={[styles.iconChip, { backgroundColor: C.muted, width: 32, height: 32 }]}>
                          <MaterialIcons name={meta.icon} size={16} color={meta.color} />
                        </View>
                        <Text style={{ flex: 1, fontFamily: FONT.medium, color: C.ink, fontSize: 14 }}>{a.message}</Text>
                        {a.kind === 'join_request' && a.request_id && (
                          <View style={{ flexDirection: 'row', gap: 8 }}>
                            <Pressable onPress={() => approveRequest(a.request_id as string)} style={[styles.miniBtn, { backgroundColor: C.success }]}>
                              <MaterialIcons name="check" size={16} color={C.primaryFg} />
                            </Pressable>
                            <Pressable onPress={async () => { await rejectRequest(a.request_id as string); refreshActivity(); }} style={[styles.miniBtn, { backgroundColor: C.muted }]}>
                              <MaterialIcons name="close" size={16} color={C.inkSoft} />
                            </Pressable>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}
            </Card>
          </FadeInItem>
        )}

        {setterName && (
          <FadeInItem delay={80} style={{ marginTop: 18 }}>
            <Card padding={SPACE.lg} tone="sage">
              <View style={styles.rowGap}>
                <View style={[styles.iconChip, { backgroundColor: C.successSoft }]}>
                  <MaterialIcons name="autorenew" size={18} color={C.success} />
                </View>
                <View style={{ flex: 1 }}>
                  <Eyebrow>Rule setter · rotates weekly</Eyebrow>
                  <H3 style={{ marginTop: 2 }}>
                    {setterName === 'You' ? "It's your turn to set next week's rules" : `${setterName} sets next week's rules`}
                  </H3>
                </View>
              </View>
            </Card>
          </FadeInItem>
        )}

        {groupMembers.length === 0 ? (
          <FadeInItem delay={140} style={{ marginTop: 18 }}>
            <Card padding={SPACE.xl}><Sub style={{ textAlign: 'center' }}>No members yet.</Sub></Card>
          </FadeInItem>
        ) : (
          <View style={{ gap: 12, marginTop: 22 }}>
            {orderedMembers.map((m, i) => {
              const pledged = m.thisWeek.filter((d) => d.state !== 'unselected').length;
              const done = m.thisWeek.filter((d) => d.state === 'checked-in').length;
              const notPledging = pledged === 0;
              const isMe = m.userId === userId;
              const onCooldown = (nudgeCooldowns[m.userId] ?? 0) > Date.now();
              return (
                <FadeInItem key={m.userId} delay={140 + i * 60}>
                  <Card
                    padding={SPACE.lg}
                    style={{
                      ...(notPledging ? { opacity: 0.55 } : null),
                      ...(isMe ? { borderColor: C.accent, borderWidth: 1.5, backgroundColor: 'rgba(232,155,124,0.06)' } : null),
                    }}
                  >
                    <View style={[styles.rowBetween, { marginBottom: 14 }]}>
                      <View style={[styles.rowGap, { flex: 1 }]}>
                        <Avatar id={m.avatar} name={m.name} accent={isMe} size={40} />
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.cardTitle, isMe && { color: C.accent }]}>{isMe ? 'You' : m.name}</Text>
                          <Sub style={{ marginTop: 2 }}>
                            {notPledging ? 'Sitting out this week' : `${done} of ${pledged} done`}
                          </Sub>
                        </View>
                      </View>
                      <View style={[styles.rowGap, { gap: 8 }]}>
                        {m.isLeader && <Chip text="Leader" tone="accent" compact />}
                        {!isMe && (
                          <Pressable
                            onPress={() => nudge(m.userId)}
                            disabled={onCooldown}
                            style={[styles.linkBtn, onCooldown && { opacity: 0.45 }]}
                          >
                            <MaterialIcons name="campaign" size={15} color={C.ink} />
                            <Text style={styles.linkText}>{onCooldown ? 'Nudged' : 'Nudge'}</Text>
                          </Pressable>
                        )}
                      </View>
                    </View>
                    <DayPicker days={m.thisWeek} />
                  </Card>
                </FadeInItem>
              );
            })}
          </View>
        )}

        {/* Friends live alongside the group: follow the pledges of people who
            aren't in it (read-only-no nudging or joining their days). */}
        <FriendsSection delay={200} />
      </ScrollView>
    </View>
  );
}

const badge = {
  dot: {
    position: 'absolute' as const,
    top: -4, right: -4,
    minWidth: 18, height: 18, borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: C.accent,
    alignItems: 'center' as const, justifyContent: 'center' as const,
  },
  text: { fontFamily: FONT.bold, fontSize: 10, color: C.primaryFg },
};

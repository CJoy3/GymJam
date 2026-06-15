import React, { useState } from 'react';
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
import { showToast } from '../ui/toast';
import { userFacingMessage } from '../state/mappers';
import { sendFriendRequestToUser } from '../../lib/api/friends';
import { FriendsSection } from './FriendsSection';
import { pageWrap, styles } from './_shared';

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
    dismissedActivity, dismissActivity,
  } = useAppState();
  const refresh = useRefreshControl();
  const tourTarget = useCoachTarget('tour-group');
  // Two pages in one screen: the group itself, and your friends (people you
  // follow who may be in other groups). Switched by the segmented tabs below.
  const [page, setPage] = useState<'group' | 'friends'>('group');
  const [showFeed, setShowFeed] = useState(false);
  // Members we've sent a friend request to this session, so the button can flip
  // to a sent state. We don't know prior friendship status here, so an existing
  // friend simply gets a toast ("already friends") when tapped.
  const [requestedFriends, setRequestedFriends] = useState<string[]>([]);

  const addFriend = async (targetUserId: string) => {
    setRequestedFriends((prev) => [...prev, targetUserId]); // optimistic
    try {
      const res = await sendFriendRequestToUser(targetUserId);
      showToast(res.action === 'accepted' ? "You're now friends" : 'Friend request sent', 'success');
      void refreshGroup(); // pick up the new friend_status from the server
    } catch (e) {
      setRequestedFriends((prev) => prev.filter((id) => id !== targetUserId));
      showToast(userFacingMessage(e), 'error');
    }
  };
  // Dismissed notification ids live in app state now (so the nav-bar unread dot
  // and this feed agree). Join requests are never dismissable (they're
  // actionable), so they always reappear regardless of this set.
  // Keep the group fresh: refresh on open, on app foreground, and gently while viewing.
  usePolling(refreshGroup, 9000);
  const setterName = potNext?.setter_user_id === userId ? 'You' : potNext?.setter_display_name;
  // Put my row first so I always see myself at the top of the group.
  const orderedMembers = userId
    ? [...groupMembers].sort((a, b) => Number(b.userId === userId) - Number(a.userId === userId))
    : groupMembers;

  // Join requests always show; everything else hides once dismissed.
  const visibleActivity = activity.filter((a) => a.kind === 'join_request' || !dismissedActivity.includes(a.id));
  const actionableCount = visibleActivity.filter((a) => a.kind === 'join_request' || a.kind === 'nudge').length;
  const clearableCount = visibleActivity.filter((a) => a.kind !== 'join_request').length;

  const clearNotifications = () => {
    dismissActivity(activity.filter((a) => a.kind !== 'join_request').map((a) => a.id));
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
            {/* Header follows the page: the group's name on the group page,
                a friends header on the friends page (and back again). */}
            <View style={{ flex: 1 }}>
              <Eyebrow>{page === 'group' ? 'Your group' : 'Your friends'}</Eyebrow>
              <H1 style={{ marginTop: 6 }}>{page === 'group' ? groupName : 'Friends'}</H1>
              <Sub style={{ marginTop: 6 }}>
                {page === 'group'
                  ? `${groupMembers.length} ${groupMembers.length === 1 ? 'member' : 'members'} · this week`
                  : 'Pledges from friends in any group'}
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

        {/* Page switcher: the group's pledges, or your friends' (read-only). */}
        <FadeInItem delay={60} style={{ marginTop: 18 }}>
          <View style={styles.tabBar}>
            <Pressable
              style={[styles.tab, page === 'group' && styles.tabOn]}
              onPress={() => setPage('group')}
            >
              <Text style={[styles.tabText, { color: page === 'group' ? C.primaryFg : C.mutedFg }]}>
                Group
              </Text>
            </Pressable>
            <Pressable
              style={[styles.tab, page === 'friends' && styles.tabOn]}
              onPress={() => setPage('friends')}
            >
              <Text style={[styles.tabText, { color: page === 'friends' ? C.primaryFg : C.mutedFg }]}>
                Friends
              </Text>
            </Pressable>
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

        {page === 'group' && setterName && (
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

        {page === 'group' && (groupMembers.length === 0 ? (
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
                      ...(isMe ? { borderColor: C.accent, borderWidth: 1.5, backgroundColor: 'rgba(232,155,124,0.06)' } : null),
                    }}
                  >
                    <View style={[styles.rowBetween, { marginBottom: 14 }]}>
                      {/* Dim only the person's info when they're sitting out-NOT the
                          action buttons, which stay fully active-looking. (RN opacity
                          composites the whole subtree, so the dim can't live on the
                          Card or a child couldn't undo it.) */}
                      <View style={[styles.rowGap, { flex: 1 }, notPledging && { opacity: 0.55 }]}>
                        <Avatar id={m.avatar} name={m.name} accent={isMe} size={40} />
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.cardTitle, isMe && { color: C.accent }]}>{isMe ? 'You' : m.name}</Text>
                          <Sub style={{ marginTop: 2 }}>
                            {notPledging ? 'Sitting out this week' : `${done} of ${pledged} done`}
                          </Sub>
                        </View>
                      </View>
                      {/* Action column: the Leader tag sits up high (lifted toward the
                          card's top edge), with the Add/Nudge buttons below it. */}
                      <View style={{ alignItems: 'flex-end', gap: 10 }}>
                        {m.isLeader && (
                          <View style={{ marginTop: -4 }}>
                            <Chip text="Leader" tone="accent" compact />
                          </View>
                        )}
                        <View style={[styles.rowGap, { gap: 8 }]}>
                          {/* Already friends → no button. Pending (from the server or
                              sent this session) → disabled 'Sent'. Otherwise 'Add'. */}
                          {!isMe && m.friendStatus !== 'friends' && (() => {
                            const requested = m.friendStatus === 'requested' || requestedFriends.includes(m.userId);
                            return (
                              <Pressable
                                onPress={() => addFriend(m.userId)}
                                disabled={requested}
                                style={[styles.linkBtn, requested && { opacity: 0.45 }]}
                              >
                                <MaterialIcons name={requested ? 'check' : 'person-add'} size={15} color={C.ink} />
                                <Text style={styles.linkText}>{requested ? 'Sent' : 'Add'}</Text>
                              </Pressable>
                            );
                          })()}
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
                    </View>
                    <View style={notPledging && { opacity: 0.55 }}>
                      <DayPicker days={m.thisWeek} />
                    </View>
                  </Card>
                </FadeInItem>
              );
            })}
          </View>
        ))}

        {/* Friends page: follow the pledges of people who aren't in the group
            (read-only-no nudging or joining their days). */}
        {page === 'friends' && <FriendsSection delay={100} showTitle={false} />}
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

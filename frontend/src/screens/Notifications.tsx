import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { C, FONT, SPACE } from '../theme/tokens';
import { Avatar } from '../ui/Avatar';
import { Card, Eyebrow, FadeInItem, IconButton, Sub } from '../ui/components';
import { useAppState } from '../state/AppState';
import { styles } from './_shared';

/* Shared notifications surface: a bell button (with unread badge) plus the feed
 * card it toggles. Used by both the group screen and the no-group screen so
 * friend requests and group activity live in ONE place — the notifications menu —
 * regardless of whether you're in a group yet. */

const KIND_META: Record<string, { icon: keyof typeof MaterialIcons.glyphMap; color: string }> = {
  join_request: { icon: 'person-add', color: C.accent },
  nudge: { icon: 'campaign', color: C.accent },
  missed: { icon: 'close', color: C.danger },
  checkin: { icon: 'check-circle', color: C.success },
  streak: { icon: 'local-fire-department', color: C.accent },
};

/** Derived notification counts/lists shared by the bell badge and the feed. */
export function useNotificationData() {
  const { activity, dismissedActivity, friendRequests } = useAppState();
  // Join requests always show; everything else hides once dismissed.
  const groupItems = activity.filter((a) => a.kind === 'join_request' || !dismissedActivity.includes(a.id));
  // Actionable = things awaiting a tap: friend requests, join requests, nudges.
  const actionableCount = friendRequests.length
    + groupItems.filter((a) => a.kind === 'join_request' || a.kind === 'nudge').length;
  const clearableCount = groupItems.filter((a) => a.kind !== 'join_request').length;
  const isEmpty = groupItems.length === 0 && friendRequests.length === 0;
  return { groupItems, actionableCount, clearableCount, isEmpty };
}

/** The notifications bell. Refreshes the feed's data when opened. */
export function NotificationsBell({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const { refreshActivity, refreshFriendRequests } = useAppState();
  const { actionableCount } = useNotificationData();
  return (
    <IconButton
      icon={open ? 'notifications-active' : 'notifications-none'}
      color={open ? C.accent : C.ink}
      onPress={() => { if (!open) { void refreshActivity(); void refreshFriendRequests(); } onToggle(); }}
    >
      {actionableCount > 0 && (
        <View style={badge.dot}>
          <Text style={badge.text}>{actionableCount}</Text>
        </View>
      )}
    </IconButton>
  );
}

/** The feed card the bell toggles. Renders nothing when closed. */
export function NotificationsFeed({ open, delay = 40 }: { open: boolean; delay?: number }) {
  const {
    activity, approveRequest, rejectRequest, refreshActivity,
    friendRequests, acceptFriendRequest, declineFriendRequest,
    dismissActivity,
  } = useAppState();
  const { groupItems, clearableCount, isEmpty } = useNotificationData();
  if (!open) return null;

  const clearNotifications = () =>
    dismissActivity(activity.filter((a) => a.kind !== 'join_request').map((a) => a.id));

  return (
    <FadeInItem delay={delay} style={{ marginTop: 16 }}>
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
        {isEmpty ? (
          <Sub style={{ textAlign: 'center' }}>
            No updates yet. Friend requests and group activity will show up here.
          </Sub>
        ) : (
          <View style={{ gap: 14 }}>
            {/* Friend requests: accept (auto-friends) or decline. */}
            {friendRequests.map((r) => (
              <View key={`fr-${r.id}`} style={styles.rowGap}>
                <Avatar id={r.avatar} name={r.display_name} size={32} />
                <Text style={{ flex: 1, fontFamily: FONT.medium, color: C.ink, fontSize: 14 }}>
                  <Text style={{ fontFamily: FONT.semibold }}>{r.display_name}</Text> sent you a friend request
                </Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Pressable onPress={() => acceptFriendRequest(r.id)} style={[styles.miniBtn, { backgroundColor: C.success }]}>
                    <MaterialIcons name="check" size={16} color={C.primaryFg} />
                  </Pressable>
                  <Pressable onPress={() => declineFriendRequest(r.id)} style={[styles.miniBtn, { backgroundColor: C.muted }]}>
                    <MaterialIcons name="close" size={16} color={C.inkSoft} />
                  </Pressable>
                </View>
              </View>
            ))}
            {/* Group activity: join requests are actionable; the rest are read-only. */}
            {groupItems.map((a) => {
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

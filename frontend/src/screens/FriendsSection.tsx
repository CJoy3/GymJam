import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { C, SPACE } from '../theme/tokens';
import { Avatar } from '../ui/Avatar';
import { Card, Chip, Eyebrow, FadeInItem, Sub } from '../ui/components';
import { DayPicker } from '../ui/DayPicker';
import { usePolling } from '../ui/usePolling';
import { showToast } from '../ui/toast';
import { daysToWeek, userFacingMessage } from '../state/mappers';
import {
  listFriends, removeFriend, sendFriendRequest, type Friend,
} from '../../lib/api/friends';
import { styles } from './_shared';

/**
 * Friends-mutual links that live ALONGSIDE groups. Lets you follow the weekly
 * pledges of friends who aren't in your group (read-only: no nudging, no
 * joining their days). Self-contained: fetches its own data so it can render
 * on any screen without touching the global app state.
 *
 * Incoming friend requests are NOT shown here-they live in the notifications
 * menu (see Notifications.tsx) alongside group join requests.
 */
export function FriendsSection({ delay = 0, showTitle = true }: {
  delay?: number;
  /** Hide the section's own "Friends" eyebrow when the host screen already
   *  provides a Friends header (e.g. the Group screen's friends page). */
  showTitle?: boolean;
}) {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [tag, setTag] = useState('');
  const [sending, setSending] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setFriends(await listFriends());
      setLoaded(true);
    } catch {
      // keep prior state; transient errors shouldn't blank the list
    }
  }, []);
  // Friends' pledges change as they check in-poll gently while visible.
  usePolling(refresh, 15000);

  const submit = async () => {
    const t = tag.trim().toLowerCase().replace(/^#/, '');
    if (!t || sending) return;
    setSending(true);
    try {
      const res = await sendFriendRequest(t);
      showToast(res.action === 'accepted' ? `You're now friends with #${t}` : 'Friend request sent', 'success');
      setTag('');
      setShowAdd(false);
      void refresh();
    } catch (e) {
      showToast(userFacingMessage(e), 'error');
    } finally {
      setSending(false);
    }
  };

  const unfriend = async (f: Friend) => {
    setFriends((prev) => prev.filter((x) => x.user_id !== f.user_id)); // optimistic
    try {
      await removeFriend(f.user_id);
      showToast(`Removed ${f.display_name}`, 'info');
    } catch (e) {
      showToast(userFacingMessage(e), 'error');
      void refresh();
    }
  };

  return (
    <View>
      <FadeInItem delay={delay} style={{ marginTop: showTitle ? 28 : 18 }}>
        <View style={[styles.rowBetween, { marginBottom: 12 }, !showTitle && { justifyContent: 'flex-end' }]}>
          {showTitle && <Eyebrow>Friends</Eyebrow>}
          <Pressable onPress={() => setShowAdd((s) => !s)} hitSlop={8} style={styles.linkBtn}>
            <MaterialIcons name={showAdd ? 'close' : 'person-add'} size={15} color={C.ink} />
            <Text style={styles.linkText}>{showAdd ? 'Cancel' : 'Add friend'}</Text>
          </Pressable>
        </View>
      </FadeInItem>

      {showAdd && (
        <FadeInItem style={{ marginBottom: 12 }}>
          <Card padding={SPACE.lg}>
            <Sub>Add a friend by their #tag</Sub>
            <View style={[styles.rowGap, { marginTop: 4 }]}>
              <TextInput
                value={tag}
                onChangeText={setTag}
                placeholder="#tag"
                placeholderTextColor={C.mutedFg}
                autoCapitalize="none"
                autoCorrect={false}
                onSubmitEditing={submit}
                style={[styles.input, { flex: 1 }]}
              />
              <Pressable
                onPress={submit}
                disabled={sending || !tag.trim()}
                style={[styles.miniBtn, { backgroundColor: C.primary, width: 48, height: 48, borderRadius: 24, marginTop: 6 }, (sending || !tag.trim()) && { opacity: 0.45 }]}
              >
                {sending
                  ? <ActivityIndicator size="small" color={C.primaryFg} />
                  : <MaterialIcons name="send" size={18} color={C.primaryFg} />}
              </Pressable>
            </View>
          </Card>
        </FadeInItem>
      )}

      {friends.length === 0 ? (
        <FadeInItem>
          <Card padding={SPACE.lg}>
            <Sub style={{ textAlign: 'center' }}>
              {loaded
                ? 'No friends yet. Add one by their #tag to follow their weekly pledges-even if they’re in another group.'
                : 'Loading friends…'}
            </Sub>
          </Card>
        </FadeInItem>
      ) : (
        <View style={{ gap: 12 }}>
          {friends.map((f, i) => (
            <FadeInItem key={f.user_id} delay={i * 50}>
              <Card padding={SPACE.lg}>
                <View style={[styles.rowBetween, { marginBottom: 14 }]}>
                  <View style={[styles.rowGap, { flex: 1 }]}>
                    <Avatar id={f.avatar} name={f.display_name} size={40} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle}>{f.display_name}</Text>
                      <Sub style={{ marginTop: 2 }}>
                        {f.tag ? `#${f.tag} · ` : ''}{f.elo.toLocaleString()} ELO
                      </Sub>
                    </View>
                  </View>
                  <View style={[styles.rowGap, { gap: 8 }]}>
                    {f.in_my_group && <Chip text="In your group" tone="accent" compact />}
                    <Pressable onPress={() => unfriend(f)} hitSlop={8} style={[styles.miniBtn, { backgroundColor: C.muted }]}>
                      <MaterialIcons name="person-remove" size={15} color={C.inkSoft} />
                    </Pressable>
                  </View>
                </View>
                {/* Read-only: friends' pledges are visible but not interactive. */}
                <DayPicker days={daysToWeek(f.this_week_days)} />
              </Card>
            </FadeInItem>
          ))}
        </View>
      )}
    </View>
  );
}

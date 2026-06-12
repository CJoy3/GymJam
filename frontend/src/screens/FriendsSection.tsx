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
  acceptFriendRequest, declineFriendRequest, listFriendRequests, listFriends,
  removeFriend, sendFriendRequest, type Friend, type FriendRequest,
} from '../../lib/api/friends';
import { styles } from './_shared';

/**
 * Friends-mutual links that live ALONGSIDE groups. Lets you follow the weekly
 * pledges of friends who aren't in your group (read-only: no nudging, no
 * joining their days). Self-contained: fetches its own data so it can render
 * on any screen without touching the global app state.
 */
export function FriendsSection({ delay = 0 }: { delay?: number }) {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [tag, setTag] = useState('');
  const [sending, setSending] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [f, r] = await Promise.all([listFriends(), listFriendRequests()]);
      setFriends(f);
      setRequests(r);
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

  const accept = async (r: FriendRequest) => {
    setRequests((prev) => prev.filter((x) => x.id !== r.id)); // optimistic
    try {
      await acceptFriendRequest(r.id);
      showToast(`You're now friends with ${r.display_name}`, 'success');
      void refresh();
    } catch (e) {
      showToast(userFacingMessage(e), 'error');
      void refresh();
    }
  };

  const decline = async (r: FriendRequest) => {
    setRequests((prev) => prev.filter((x) => x.id !== r.id)); // optimistic
    try {
      await declineFriendRequest(r.id);
    } catch (e) {
      showToast(userFacingMessage(e), 'error');
      void refresh();
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
      <FadeInItem delay={delay} style={{ marginTop: 28 }}>
        <View style={[styles.rowBetween, { marginBottom: 12 }]}>
          <Eyebrow>Friends</Eyebrow>
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

      {requests.length > 0 && (
        <FadeInItem style={{ marginBottom: 12 }}>
          <Card padding={SPACE.lg}>
            <Eyebrow style={{ marginBottom: 10 }}>Friend requests</Eyebrow>
            <View style={{ gap: 12 }}>
              {requests.map((r) => (
                <View key={r.id} style={styles.rowGap}>
                  <Avatar id={r.avatar} name={r.display_name} size={36} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{r.display_name}</Text>
                    {!!r.tag && <Sub style={{ marginTop: 1 }}>#{r.tag}</Sub>}
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Pressable onPress={() => accept(r)} style={[styles.miniBtn, { backgroundColor: C.success }]}>
                      <MaterialIcons name="check" size={16} color={C.primaryFg} />
                    </Pressable>
                    <Pressable onPress={() => decline(r)} style={[styles.miniBtn, { backgroundColor: C.muted }]}>
                      <MaterialIcons name="close" size={16} color={C.inkSoft} />
                    </Pressable>
                  </View>
                </View>
              ))}
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

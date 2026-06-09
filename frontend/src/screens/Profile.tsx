import React, { useCallback, useEffect, useState } from 'react';
import {
  Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { C, FONT, RADIUS, SPACE, tierForElo } from '../theme/tokens';
import { Btn, Card, Chip, Eyebrow, FadeInItem, H1, Sub } from '../ui/components';
import { Avatar } from '../ui/Avatar';
import { BlobBackground } from '../ui/Blob';
import { ProfileMap, type Presence } from '../ui/ProfileMap';
import { useRefreshControl } from '../ui/useRefresh';
import { useAppState } from '../state/AppState';
import { AVATAR_IDS } from '../gymspace';
import { getSquadMap, type SquadMapMember } from '../../lib/api/groups';
import { getGymsMap, type GymMapPoint } from '../../lib/api/gyms';
import { ensureSupabase } from '../../lib/supabase';
import { clearCache } from '../../lib/cache';

const pageWrap = { padding: SPACE.xl, paddingTop: 56, paddingBottom: 40 } as const;

export function ProfileView({ onSettings, onSquadMap }: { onSettings: () => void; onSquadMap: () => void }) {
  const {
    elo, gymName, groupName, groupId, displayName, avatar,
    todayDow, groupMembers, money, moneyWeekChange,
    tag, updateDisplayName, updateAvatar,
  } = useAppState();
  const refresh = useRefreshControl();

  const statusById: Record<string, Presence> = {};
  for (const m of groupMembers) {
    const s = m.thisWeek[todayDow]?.state;
    statusById[m.userId] = s === 'checked-in' ? 'in' : s === 'planned' || s === 'locked' ? 'pledged' : 'rest';
  }

  const [squadMembers, setSquadMembers] = useState<SquadMapMember[]>([]);
  const [gyms, setGyms] = useState<GymMapPoint[]>([]);
  const loadSquad = useCallback(async () => {
    getGymsMap().then(setGyms).catch(() => setGyms([]));
    if (!groupId) { setSquadMembers([]); return; }
    try { setSquadMembers(await getSquadMap(groupId)); } catch { setSquadMembers([]); }
  }, [groupId]);
  useEffect(() => { loadSquad(); }, [loadSquad]);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(displayName);
  const [pickerOpen, setPickerOpen] = useState(false);
  useEffect(() => { if (!editing) setDraft(displayName); }, [displayName, editing]);

  const save = async () => {
    const next = draft.trim();
    if (next && next !== displayName) await updateDisplayName(next);
    setEditing(false);
  };

  const signOut = async () => {
    clearCache('snapshot');
    const sb = await ensureSupabase();
    await sb.auth.signOut();
  };

  return (
    <View style={styles.screen}>
      <BlobBackground variant="profile" />
      <ScrollView refreshControl={refresh} contentContainerStyle={pageWrap} showsVerticalScrollIndicator={false}>
        <FadeInItem>
          <Eyebrow>Profile</Eyebrow>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
            <H1>Your space</H1>
            <Pressable onPress={onSettings} style={styles.settingsBtn}>
              <MaterialIcons name="settings" size={20} color={C.ink} />
            </Pressable>
          </View>
        </FadeInItem>

        {/* Profile hero card */}
        <FadeInItem delay={80} style={{ marginTop: 24 }}>
          <Card padding={0} style={{ overflow: 'hidden' }}>
            {/* The whole hero is the map; identity is overlaid on top of it. */}
            <Pressable onPress={onSquadMap} style={StyleSheet.absoluteFill}>
              <ProfileMap members={squadMembers} gyms={gyms} statusById={statusById} />
            </Pressable>
            <Pressable onPress={onSquadMap} style={styles.expandBtn}>
              <MaterialIcons name="open-in-full" size={15} color={C.ink} />
            </Pressable>

            <View style={styles.heroContent}>
              <Pressable onPress={() => setPickerOpen((o) => !o)} style={styles.avatarWrap}>
                <Avatar id={avatar} name={displayName} size={84} style={{ borderWidth: 3, borderColor: C.bg }} />
                <View style={styles.editBadge}>
                  <MaterialIcons name={pickerOpen ? 'close' : 'edit'} size={14} color={C.primaryFg} />
                </View>
              </Pressable>

              {pickerOpen && (
                <View style={{ width: '100%', marginBottom: 16 }}>
                  <Eyebrow style={{ marginBottom: 10, textAlign: 'center' }}>Choose your look</Eyebrow>
                  <View style={styles.avatarGrid}>
                    {AVATAR_IDS.map((id) => {
                      const selected = id === avatar;
                      return (
                        <Pressable key={id} onPress={() => { updateAvatar(id); setPickerOpen(false); }}>
                          <Avatar
                            id={id}
                            name={displayName}
                            size={54}
                            style={{ borderWidth: 2, borderColor: selected ? C.accent : 'transparent' }}
                          />
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              )}

              {editing ? (
                <View style={{ width: '100%', gap: 8 }}>
                  <TextInput
                    value={draft}
                    onChangeText={setDraft}
                    placeholder="Your name"
                    placeholderTextColor={C.mutedFg}
                    autoFocus
                    maxLength={48}
                    style={styles.nameInput}
                  />
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Btn label="Save" size="md" disabled={!draft.trim()} onPress={save} style={{ flex: 1 }} />
                    <Btn label="Cancel" variant="ghost" size="md" onPress={() => { setEditing(false); setDraft(displayName); }} style={{ flex: 1 }} />
                  </View>
                </View>
              ) : (
                <Pressable onPress={() => setEditing(true)} style={{ alignItems: 'center' }}>
                  <View style={styles.rowGap}>
                    <Text style={styles.name}>{displayName}</Text>
                    <MaterialIcons name="edit" size={16} color={C.mutedFg} />
                  </View>
                </Pressable>
              )}

              {tag && <Text style={styles.tagDisplay}>#{tag}</Text>}

              <View style={{ marginTop: 8 }}>
                <Chip text={tierForElo(elo)} tone="accent" icon="emoji-events" />
              </View>

              {!!gymName && (
                <View style={[styles.rowGap, { marginTop: 10 }]}>
                  <MaterialIcons name="place" size={14} color={C.mutedFg} />
                  <Sub>{groupName ? `${groupName} · ${gymName}` : gymName}</Sub>
                </View>
              )}
            </View>
          </Card>
        </FadeInItem>

        {/* Wallet */}
        <FadeInItem delay={220} style={{ marginTop: 22 }}>
          <Card padding={SPACE.xl}>
            <View style={[styles.rowGap, { marginBottom: 16 }]}>
              <View style={styles.iconChip}>
                <MaterialIcons name="account-balance-wallet" size={18} color={C.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionTitle}>Wallet</Text>
                <Sub style={{ marginTop: 2 }}>Money-pot balance</Sub>
              </View>
            </View>
            <View style={styles.walletRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.walletLabel}>Deposited</Text>
                <Text style={styles.walletBalance}>£{(money / 100).toFixed(2)}</Text>
              </View>
              <View style={styles.walletDivider} />
              <View style={{ flex: 1, alignItems: 'flex-end' }}>
                <Text style={styles.walletLabel}>This week</Text>
                <View style={styles.rowGap}>
                  <MaterialIcons
                    name={moneyWeekChange > 0 ? 'arrow-upward' : moneyWeekChange < 0 ? 'arrow-downward' : 'remove'}
                    size={16}
                    color={moneyWeekChange > 0 ? C.success : moneyWeekChange < 0 ? C.danger : C.mutedFg}
                  />
                  <Text style={[styles.walletChange, { color: moneyWeekChange > 0 ? C.success : moneyWeekChange < 0 ? C.danger : C.mutedFg }]}>
                    {moneyWeekChange > 0 ? '+' : moneyWeekChange < 0 ? '−' : ''}£{(Math.abs(moneyWeekChange) / 100).toFixed(2)}
                  </Text>
                </View>
              </View>
            </View>
          </Card>
        </FadeInItem>

        {/* Sign out */}
        <FadeInItem delay={260} style={{ marginTop: 22 }}>
          <Pressable onPress={signOut} style={styles.signOutBtn}>
            <MaterialIcons name="logout" size={18} color={C.danger} />
            <Text style={styles.signOutText}>Sign out</Text>
          </Pressable>
        </FadeInItem>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  rowGap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  iconChip: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(199,160,110,0.15)', alignItems: 'center', justifyContent: 'center' },

  avatarWrap: { position: 'relative' },
  expandBtn: {
    position: 'absolute', top: 10, right: 10,
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(242,229,210,0.88)',
    alignItems: 'center', justifyContent: 'center',
    zIndex: 2,
  },
  // The map fills the whole card; this padding leaves the upper band of the map
  // visible above the avatar, with identity content overlaid on the darker base.
  heroContent: { paddingTop: 96, paddingHorizontal: SPACE.xl, paddingBottom: SPACE.xl, alignItems: 'center' },
  editBadge: {
    position: 'absolute', right: -2, bottom: -2,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: C.accent, borderWidth: 2, borderColor: C.card,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12 },
  settingsBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.borderHi,
    alignItems: 'center', justifyContent: 'center',
  },
  name: { fontFamily: FONT.bold, fontSize: 22, color: C.ink, letterSpacing: -0.3 },
  tagDisplay: { fontFamily: FONT.semibold, fontSize: 14, color: C.mutedFg, marginTop: 4, letterSpacing: 0.2 },
  nameInput: {
    height: 48, paddingHorizontal: 14, borderRadius: RADIUS.md,
    backgroundColor: C.bgSoft, borderWidth: 1, borderColor: C.borderHi,
    color: C.ink, fontFamily: FONT.semibold, fontSize: 16, textAlign: 'center',
  },

  sectionTitle: { fontFamily: FONT.bold, fontSize: 15, color: C.ink },

  walletRow: { flexDirection: 'row', alignItems: 'center' },
  walletDivider: { width: 1, alignSelf: 'stretch', backgroundColor: C.border, marginHorizontal: SPACE.lg },
  walletLabel: { fontFamily: FONT.medium, fontSize: 12, color: C.mutedFg, marginBottom: 6 },
  walletBalance: { fontFamily: FONT.extra, fontSize: 26, color: C.ink, letterSpacing: -0.6 },
  walletChange: { fontFamily: FONT.bold, fontSize: 18, letterSpacing: -0.3 },

  signOutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: 14, borderRadius: RADIUS.md,
    backgroundColor: 'rgba(199,122,111,0.08)',
    borderWidth: 1, borderColor: 'rgba(199,122,111,0.2)',
  },
  signOutText: { fontFamily: FONT.semibold, fontSize: 15, color: C.danger },
});

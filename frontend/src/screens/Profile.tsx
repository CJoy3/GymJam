import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { C, FONT, RADIUS, SPACE, tierForElo } from '../theme/tokens';
import { Btn, Card, Chip, Eyebrow, FadeInItem, H1, H3, Stat, Sub } from '../ui/components';
import { Avatar } from '../ui/Avatar';
import { BlobBackground } from '../ui/Blob';
import { ProfileMap, type Presence } from '../ui/ProfileMap';
import { useRefreshControl } from '../ui/useRefresh';
import { showToast } from '../ui/toast';
import { useAppState } from '../state/AppState';
import { AVATAR_IDS } from '../gymspace';
import { getSquadMap, type SquadMapMember } from '../../lib/api/groups';
import { checkTagAvailable } from '../../lib/api/users';
import { ensureSupabase } from '../../lib/supabase';

const pageWrap = { padding: SPACE.xl, paddingTop: 56, paddingBottom: 40 } as const;

function useDebounce<T>(value: T, delay: number): T {
  const [d, setD] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setD(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return d;
}

export function ProfileView({ onSettings, onSquadMap }: { onSettings: () => void; onSquadMap: () => void }) {
  const {
    elo, streak, gymName, gymId, gyms, groupName, groupId, displayName, avatar,
    thisWeek, todayDow, groupMembers,
    tag, tagChanges, updateDisplayName, updateAvatar, updateTag, setGym,
  } = useAppState();
  const refresh = useRefreshControl();
  const sessionsDone = thisWeek.filter((d) => d.state === 'checked-in').length;

  // Live presence for the map halos, derived from this week's check-ins.
  const statusById: Record<string, Presence> = {};
  for (const m of groupMembers) {
    const s = m.thisWeek[todayDow]?.state;
    statusById[m.userId] = s === 'checked-in' ? 'in' : s === 'planned' || s === 'locked' ? 'pledged' : 'rest';
  }

  const [squadMembers, setSquadMembers] = useState<SquadMapMember[]>([]);
  const loadSquad = useCallback(async () => {
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

  // --- Tag editing ---
  const canChangeTag = tagChanges === 0;
  const [editingTag, setEditingTag] = useState(false);
  const [tagDraft, setTagDraft] = useState('');
  const [tagStatus, setTagStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  const [savingTag, setSavingTag] = useState(false);
  const abortRef = React.useRef(0);
  const debouncedTag = useDebounce(tagDraft, 400);

  useEffect(() => {
    if (!editingTag) return;
    const clean = debouncedTag.trim();
    if (!clean) { setTagStatus('idle'); return; }
    if (!/^[a-zA-Z0-9_-]{3,20}$/.test(clean)) { setTagStatus('invalid'); return; }
    const id = ++abortRef.current;
    setTagStatus('checking');
    checkTagAvailable(clean).then((r) => {
      if (id !== abortRef.current) return;
      setTagStatus(r.available ? 'available' : 'taken');
    }).catch(() => {
      if (id !== abortRef.current) return;
      setTagStatus('idle');
    });
  }, [debouncedTag, editingTag]);

  const openTagEdit = () => {
    setTagDraft(tag ?? '');
    setTagStatus('idle');
    setEditingTag(true);
  };

  const saveTag = async () => {
    if (tagStatus !== 'available') return;
    setSavingTag(true);
    try {
      await updateTag(tagDraft.trim().toLowerCase());
      setEditingTag(false);
      showToast('Tag updated', 'success');
    } catch { /* error shown by updateTag */ } finally {
      setSavingTag(false);
    }
  };

  // --- Gym editing ---
  const [editingGym, setEditingGym] = useState(false);
  const [savingGym, setSavingGym] = useState(false);

  const changeGym = async (id: string) => {
    setSavingGym(true);
    try {
      await setGym(id);
      setEditingGym(false);
      showToast('Home gym updated', 'success');
    } catch { /* error shown inside setGym */ } finally {
      setSavingGym(false);
    }
  };

  const signOut = async () => {
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
            {/* Map rectangle behind the profile image — squad members pinned at
                their gyms with check-in status halos. */}
            <View style={styles.mapBanner}>
              <Pressable onPress={onSquadMap} style={StyleSheet.absoluteFill}>
                <ProfileMap members={squadMembers} statusById={statusById} />
              </Pressable>
              <Pressable onPress={onSquadMap} style={styles.expandBtn}>
                <MaterialIcons name="open-in-full" size={15} color={C.ink} />
              </Pressable>
              <Pressable onPress={() => setPickerOpen((o) => !o)} style={styles.avatarOnMap}>
                <Avatar id={avatar} name={displayName} size={92} style={{ borderWidth: 3, borderColor: C.bg }} />
                <View style={styles.editBadge}>
                  <MaterialIcons name={pickerOpen ? 'close' : 'edit'} size={14} color={C.primaryFg} />
                </View>
              </Pressable>
            </View>

            <View style={styles.heroBody}>
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

              {tag && !editingTag && (
                <Text style={styles.tagDisplay}>#{tag}</Text>
              )}

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

        {/* Stats */}
        <FadeInItem delay={140} style={{ marginTop: 14 }}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Card padding={SPACE.lg} style={{ flex: 1 }}><Stat label="ELO" value={elo.toLocaleString()} /></Card>
            <Card padding={SPACE.lg} style={{ flex: 1 }}><Stat label="Streak" value={`${streak} wk`} accent /></Card>
          </View>
        </FadeInItem>
        <FadeInItem delay={180} style={{ marginTop: 12 }}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Card padding={SPACE.lg} style={{ flex: 1 }}><Stat label="Sessions" value={sessionsDone} sub="this week" /></Card>
            <Card padding={SPACE.lg} style={{ flex: 1 }}><Stat label="Tier" value={tierForElo(elo)} /></Card>
          </View>
        </FadeInItem>

        {/* Tag section */}
        <FadeInItem delay={220} style={{ marginTop: 22 }}>
          <Card padding={SPACE.xl}>
            <View style={[styles.rowGap, { marginBottom: 14 }]}>
              <View style={[styles.iconChip, { backgroundColor: C.accentSoft }]}>
                <MaterialIcons name="tag" size={18} color={C.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <H3>Your tag</H3>
                <Sub style={{ marginTop: 2 }}>Unique handle visible to your group</Sub>
              </View>
              {!editingTag && canChangeTag && (
                <Pressable onPress={openTagEdit} style={styles.smallEditBtn}>
                  <MaterialIcons name="edit" size={15} color={C.mutedFg} />
                </Pressable>
              )}
            </View>

            {editingTag ? (
              <View style={{ gap: 10 }}>
                <View style={styles.tagInputRow}>
                  <Text style={styles.tagPrefix}>#</Text>
                  <TextInput
                    style={styles.tagInput}
                    value={tagDraft}
                    onChangeText={(t) => {
                      setTagDraft(t.toLowerCase().replace(/[^a-z0-9_-]/g, ''));
                      setTagStatus('idle');
                    }}
                    placeholder="newhandle"
                    placeholderTextColor={C.mutedFg}
                    autoCapitalize="none"
                    autoFocus
                    maxLength={20}
                  />
                  {tagStatus === 'checking' && <ActivityIndicator size="small" color={C.mutedFg} style={{ marginRight: 10 }} />}
                  {tagStatus === 'available' && <MaterialIcons name="check-circle" size={20} color={C.success} style={{ marginRight: 10 }} />}
                  {tagStatus === 'taken' && <MaterialIcons name="cancel" size={20} color={C.accent} style={{ marginRight: 10 }} />}
                </View>
                {tagStatus === 'available' && <Sub style={{ color: C.success }}>#{tagDraft} is available</Sub>}
                {tagStatus === 'taken' && <Sub style={{ color: C.accent }}>#{tagDraft} is already taken</Sub>}
                {tagStatus === 'invalid' && <Sub>3–20 characters, letters/numbers/_/- only</Sub>}
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Btn
                    label={savingTag ? 'Saving…' : 'Save tag'}
                    size="md"
                    loading={savingTag}
                    disabled={tagStatus !== 'available' || savingTag}
                    onPress={saveTag}
                    style={{ flex: 1 }}
                  />
                  <Btn label="Cancel" variant="ghost" size="md" onPress={() => setEditingTag(false)} style={{ flex: 1 }} />
                </View>
                <Sub style={{ color: C.mutedFg, fontSize: 11, marginTop: 2 }}>
                  You can only change your tag once. This is your last change.
                </Sub>
              </View>
            ) : (
              <View>
                <Text style={styles.tagValue}>#{tag ?? '—'}</Text>
                {!canChangeTag && (
                  <View style={[styles.rowGap, { marginTop: 8 }]}>
                    <MaterialIcons name="lock" size={13} color={C.mutedFg} />
                    <Sub style={{ fontSize: 12 }}>Tag cannot be changed again</Sub>
                  </View>
                )}
                {canChangeTag && (
                  <Sub style={{ marginTop: 6, fontSize: 12 }}>You have 1 tag change remaining.</Sub>
                )}
              </View>
            )}
          </Card>
        </FadeInItem>

        {/* Home gym section */}
        <FadeInItem delay={260} style={{ marginTop: 14 }}>
          <Card padding={SPACE.xl}>
            <View style={[styles.rowGap, { marginBottom: 14 }]}>
              <View style={[styles.iconChip, { backgroundColor: C.accentSoft }]}>
                <MaterialIcons name="place" size={18} color={C.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <H3>Home gym</H3>
                <Sub style={{ marginTop: 2 }}>Where you train</Sub>
              </View>
              {!editingGym && (
                <Pressable onPress={() => setEditingGym(true)} style={styles.smallEditBtn}>
                  <MaterialIcons name="edit" size={15} color={C.mutedFg} />
                </Pressable>
              )}
            </View>

            {editingGym ? (
              <View style={{ gap: 10 }}>
                {gyms.map((g) => {
                  const on = gymId === g.id;
                  return (
                    <Pressable
                      key={g.id}
                      onPress={() => changeGym(g.id)}
                      disabled={savingGym}
                      style={[styles.gymOption, on && styles.gymOptionSelected]}
                    >
                      <MaterialIcons name="place" size={18} color={on ? C.primaryFg : C.mutedFg} />
                      <Text style={[styles.gymOptionText, on && { color: C.primaryFg }]}>{g.name}</Text>
                      {on && <MaterialIcons name="check" size={18} color={C.primaryFg} style={{ marginLeft: 'auto' }} />}
                      {savingGym && on && <ActivityIndicator size="small" color={C.primaryFg} />}
                    </Pressable>
                  );
                })}
                <Btn label="Cancel" variant="ghost" size="md" onPress={() => setEditingGym(false)} />
              </View>
            ) : (
              <Text style={styles.gymValue}>{gymName || 'No gym set'}</Text>
            )}
          </Card>
        </FadeInItem>

        {/* Sign out */}
        <FadeInItem delay={300} style={{ marginTop: 22 }}>
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
  iconChip: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },

  mapBanner: {
    height: 184,
    width: '100%',
    backgroundColor: C.bgSoft,
  },
  avatarOnMap: {
    position: 'absolute',
    bottom: -46,
    left: '50%',
    marginLeft: -46,
  },
  expandBtn: {
    position: 'absolute', top: 12, right: 12,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(242,229,210,0.88)',
    alignItems: 'center', justifyContent: 'center',
  },
  heroBody: {
    paddingTop: 60,
    paddingHorizontal: SPACE.xl,
    paddingBottom: SPACE.xl,
    alignItems: 'center',
  },

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

  smallEditBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: C.bgSoft, borderWidth: 1, borderColor: C.borderHi,
    alignItems: 'center', justifyContent: 'center',
  },

  tagInputRow: {
    flexDirection: 'row', alignItems: 'center', height: 48,
    borderRadius: RADIUS.md, backgroundColor: C.bgSoft,
    borderWidth: 1, borderColor: C.borderHi,
  },
  tagPrefix: { fontFamily: FONT.bold, fontSize: 16, color: C.mutedFg, paddingLeft: 12, paddingRight: 2 },
  tagInput: { flex: 1, height: '100%', fontFamily: FONT.semibold, fontSize: 15, color: C.ink },
  tagValue: { fontFamily: FONT.bold, fontSize: 18, color: C.ink, letterSpacing: -0.2 },

  gymOption: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 14, borderRadius: RADIUS.md,
    backgroundColor: C.bgSoft, borderWidth: 1, borderColor: C.borderHi,
  },
  gymOptionSelected: { backgroundColor: C.primary, borderColor: C.primary },
  gymOptionText: { fontFamily: FONT.semibold, fontSize: 15, color: C.ink, flex: 1 },
  gymValue: { fontFamily: FONT.bold, fontSize: 18, color: C.ink, letterSpacing: -0.2 },

  signOutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: 14, borderRadius: RADIUS.md,
    backgroundColor: 'rgba(199,122,111,0.08)',
    borderWidth: 1, borderColor: 'rgba(199,122,111,0.2)',
  },
  signOutText: { fontFamily: FONT.semibold, fontSize: 15, color: C.danger },
});

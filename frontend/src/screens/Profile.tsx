import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { C, FONT, RADIUS, SPACE, tierForElo } from '../theme/tokens';
import { Btn, Card, Chip, Eyebrow, FadeInItem, H1, Stat, Sub } from '../ui/components';
import { Avatar } from '../ui/Avatar';
import { BlobBackground } from '../ui/Blob';
import { SquadMap } from '../ui/SquadMap';
import { useRefreshControl } from '../ui/useRefresh';
import { useAppState } from '../state/AppState';
import { AVATAR_IDS } from '../gymspace';
import { getSquadMap, type SquadMapMember } from '../../lib/api/groups';

const pageWrap = { padding: SPACE.xl, paddingTop: 56, paddingBottom: 40 } as const;
const HALO_SIZE = 156;

export function ProfileView({ onSettings, onSquadMap }: { onSettings: () => void; onSquadMap: () => void }) {
  const { elo, streak, gymName, groupName, groupId, displayName, avatar, thisWeek, updateDisplayName, updateAvatar } = useAppState();
  const refresh = useRefreshControl();
  const sessionsDone = thisWeek.filter((d) => d.state === 'checked-in').length;

  // Squad map "halo" peeking out from behind the avatar — a live preview of
  // where the group's members train, fetched once per group.
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

        <FadeInItem delay={80} style={{ marginTop: 24 }}>
          <Card padding={SPACE.xl} style={{ alignItems: 'center' }}>
            <View style={styles.haloStage}>
              <Pressable onPress={onSquadMap} style={styles.mapHalo}>
                <SquadMap members={squadMembers} width={HALO_SIZE} height={HALO_SIZE} compact />
              </Pressable>
              <Pressable onPress={() => setPickerOpen((o) => !o)} style={styles.avatarWrap}>
                <Avatar id={avatar} name={displayName} size={96} style={{ borderWidth: 2, borderColor: C.borderHi }} />
                <View style={styles.editBadge}>
                  <MaterialIcons name={pickerOpen ? 'close' : 'edit'} size={14} color={C.primaryFg} />
                </View>
              </Pressable>
            </View>
            <Pressable onPress={onSquadMap} style={styles.squadMapLink}>
              <MaterialIcons name="map" size={13} color={C.mutedFg} />
              <Text style={styles.squadMapLinkText}>Squad map</Text>
            </Pressable>

            {pickerOpen && (
              <View style={{ width: '100%', marginTop: 16 }}>
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
              <View style={{ width: '100%', marginTop: 16, gap: 8 }}>
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
              <Pressable onPress={() => setEditing(true)} style={{ alignItems: 'center', marginTop: 16 }}>
                <View style={styles.rowGap}>
                  <Text style={styles.name}>{displayName}</Text>
                  <MaterialIcons name="edit" size={16} color={C.mutedFg} />
                </View>
              </Pressable>
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
          </Card>
        </FadeInItem>

        <FadeInItem delay={140} style={{ marginTop: 14 }}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Card padding={SPACE.lg} style={{ flex: 1 }}>
              <Stat label="ELO" value={elo.toLocaleString()} />
            </Card>
            <Card padding={SPACE.lg} style={{ flex: 1 }}>
              <Stat label="Streak" value={`${streak} wk`} accent />
            </Card>
          </View>
        </FadeInItem>

        <FadeInItem delay={180} style={{ marginTop: 12 }}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Card padding={SPACE.lg} style={{ flex: 1 }}>
              <Stat label="Sessions" value={sessionsDone} sub="this week" />
            </Card>
            <Card padding={SPACE.lg} style={{ flex: 1 }}>
              <Stat label="Tier" value={tierForElo(elo)} />
            </Card>
          </View>
        </FadeInItem>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  rowGap: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  haloStage: {
    width: HALO_SIZE, height: HALO_SIZE,
    alignItems: 'center', justifyContent: 'center',
  },
  mapHalo: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: HALO_SIZE / 2,
    overflow: 'hidden',
    borderWidth: 1, borderColor: C.borderHi,
  },
  squadMapLink: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    marginTop: 12,
  },
  squadMapLinkText: { fontFamily: FONT.medium, fontSize: 12, color: C.mutedFg },

  avatarWrap: { position: 'relative' },
  editBadge: {
    position: 'absolute', right: -2, bottom: -2,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: C.accent,
    borderWidth: 2, borderColor: C.card,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    justifyContent: 'center', gap: 12,
  },

  settingsBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.borderHi,
    alignItems: 'center', justifyContent: 'center',
  },
  name: { fontFamily: FONT.bold, fontSize: 22, color: C.ink, letterSpacing: -0.3 },

  nameInput: {
    height: 48, paddingHorizontal: 14,
    borderRadius: RADIUS.md,
    backgroundColor: C.bgSoft,
    borderWidth: 1, borderColor: C.borderHi,
    color: C.ink, fontFamily: FONT.semibold, fontSize: 16,
    textAlign: 'center',
  },
});

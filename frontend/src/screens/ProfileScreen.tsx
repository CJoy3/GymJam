import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { C, FONT, RADIUS, SPACE, tierForElo } from '../theme/tokens';
import { Btn, Card, Chip, Eyebrow, FadeInItem, H1, Stat, Sub } from '../ui/components';
import { BlobBackground } from '../ui/Blob';
import { useRefreshControl } from '../ui/useRefresh';
import { useAppState } from '../state/AppState';

const pageWrap = { padding: SPACE.xl, paddingTop: 56, paddingBottom: 40 } as const;

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (!parts[0]) return 'YOU';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function ProfileView({ onBrowse }: { onBrowse: () => void }) {
  const { elo, streak, gymName, groupName, displayName, thisWeek, updateDisplayName } = useAppState();
  const refresh = useRefreshControl();
  const sessionsDone = thisWeek.filter((d) => d.state === 'checked-in').length;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(displayName);
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
          <H1 style={{ marginTop: 6 }}>Your space</H1>
        </FadeInItem>

        <FadeInItem delay={80} style={{ marginTop: 24 }}>
          <Card padding={SPACE.xl} style={{ alignItems: 'center' }}>
            <View style={styles.bigAvatar}>
              <Text style={styles.bigAvatarText}>{initialsOf(displayName)}</Text>
            </View>

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

        <FadeInItem delay={240} style={{ marginTop: 24, gap: 10 }}>
          <Btn label="Browse / switch groups" variant="inverse" icon="group" onPress={onBrowse} />
        </FadeInItem>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  rowGap: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  bigAvatar: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: C.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  bigAvatarText: { fontFamily: FONT.extra, fontSize: 32, color: C.primaryFg, letterSpacing: -0.6 },

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

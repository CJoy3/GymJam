import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { C, RADIUS, SPACE, tierForElo } from '../theme/tokens';
import { Card, Btn, Chip, H1, Sub } from '../ui/components';
import { useAppState } from '../state/AppState';

const wrap = { padding: SPACE.lg, paddingTop: 56, paddingBottom: 40 } as const;

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return 'YOU';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function ProfileView({ onBrowse }: { onBrowse: () => void }) {
  const { elo, streak, gymName, groupName, displayName, thisWeek, updateDisplayName } = useAppState();
  const sessionsDone = thisWeek.filter((d) => d.state === 'checked-in').length;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(displayName);
  // Keep the draft in sync when the persisted name changes (e.g. after save).
  useEffect(() => { if (!editing) setDraft(displayName); }, [displayName, editing]);

  const stats = [
    { icon: 'emoji-events' as const, label: 'ELO', value: elo.toLocaleString(), color: C.primary },
    { icon: 'local-fire-department' as const, label: 'Streak', value: `${streak} wks`, color: C.accent },
    { icon: 'event-available' as const, label: 'Sessions', value: `${sessionsDone}`, color: C.ink },
    { icon: 'verified' as const, label: 'Tier', value: tierForElo(elo), color: C.ink },
  ];

  const save = async () => {
    const next = draft.trim();
    if (next && next !== displayName) {
      await updateDisplayName(next);
    }
    setEditing(false);
  };

  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={wrap}>
      <H1 style={{ marginBottom: 16 }}>Profile</H1>

      <Card style={{ marginBottom: 16, alignItems: 'center' }}>
        <View style={styles.bigAvatar}><Text style={styles.bigAvatarTxt}>{initialsOf(displayName)}</Text></View>
        {editing ? (
          <View style={{ width: '100%', marginTop: 12, gap: 8 }}>
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
              <Btn label="Save" onPress={save} disabled={!draft.trim()} style={{ flex: 1 }} />
              <Btn label="Cancel" variant="secondary" onPress={() => { setEditing(false); setDraft(displayName); }} style={{ flex: 1 }} />
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
        <Chip text={tierForElo(elo)} tone="primary" />
        {!!gymName && (
          <View style={[styles.rowGap, { marginTop: 8 }]}>
            <MaterialIcons name="place" size={14} color={C.mutedFg} />
            <Sub>{groupName ? `${groupName} · ${gymName}` : gymName}</Sub>
          </View>
        )}
      </Card>

      <View style={styles.statGrid}>
        {stats.map((s) => (
          <Card key={s.label} style={{ width: '48%' }}>
            <View style={styles.rowGap}>
              <MaterialIcons name={s.icon} size={20} color={s.color} />
              <Sub>{s.label}</Sub>
            </View>
            <Text style={styles.statValue}>{s.value}</Text>
          </Card>
        ))}
      </View>

      <View style={{ gap: 12 }}>
        <Btn label="Browse / switch groups" variant="secondary" icon="group" onPress={onBrowse} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  rowGap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  h2: { fontSize: 18, fontWeight: '600', color: C.ink },
  cardTitle: { fontSize: 15, fontWeight: '600', color: C.ink },
  name: { fontSize: 22, fontWeight: '700', color: C.ink, marginTop: 12, marginBottom: 6 },
  bigAvatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },
  bigAvatarTxt: { fontSize: 28, fontWeight: '700', color: C.primaryFg },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 },
  statValue: { fontSize: 22, fontWeight: '700', color: C.ink, marginTop: 4 },
  nameInput: {
    height: 44,
    paddingHorizontal: 12,
    borderRadius: RADIUS.md,
    backgroundColor: C.muted,
    borderWidth: 1,
    borderColor: C.border,
    color: C.ink,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});
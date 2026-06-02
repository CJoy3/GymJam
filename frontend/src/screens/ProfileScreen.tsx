import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
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
  const { elo, streak, gymName, groupName, displayName, thisWeek } = useAppState();
  const sessionsDone = thisWeek.filter((d) => d.state === 'checked-in').length;

  const stats = [
    { icon: 'emoji-events' as const, label: 'ELO', value: elo.toLocaleString(), color: C.primary },
    { icon: 'local-fire-department' as const, label: 'Streak', value: `${streak} wks`, color: C.accent },
    { icon: 'event-available' as const, label: 'Sessions', value: `${sessionsDone}`, color: C.ink },
    { icon: 'verified' as const, label: 'Tier', value: tierForElo(elo), color: C.ink },
  ];

  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={wrap}>
      <H1 style={{ marginBottom: 16 }}>Profile</H1>

      <Card style={{ marginBottom: 16, alignItems: 'center' }}>
        <View style={styles.bigAvatar}><Text style={styles.bigAvatarTxt}>{initialsOf(displayName)}</Text></View>
        <Text style={styles.name}>{displayName}</Text>
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
  activityRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: SPACE.lg },
  divider: { borderBottomWidth: 1, borderBottomColor: C.border },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.primary },
});
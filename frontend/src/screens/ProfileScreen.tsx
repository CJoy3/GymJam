import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { C, RADIUS, SPACE, tierForElo } from '../theme/tokens';
import { Card, Btn, Chip, H1, Sub } from '../ui/components';
import { useAppState } from '../state/AppState';

const wrap = { padding: SPACE.lg, paddingTop: 56, paddingBottom: 40 } as const;

export function ProfileView({ onBrowse }: { onBrowse: () => void }) {
  const { elo, streak, gymName, groupName } = useAppState();

  const stats = [
    { icon: 'emoji-events' as const, label: 'ELO', value: elo.toLocaleString(), color: C.primary },
    { icon: 'local-fire-department' as const, label: 'Streak', value: `${streak} wks`, color: C.accent },
    { icon: 'event-available' as const, label: 'Sessions', value: '48', color: C.ink },
    { icon: 'verified' as const, label: 'Pledges', value: '11', color: C.ink },
  ];

  const activity = [
    { text: 'Checked in at the gym', when: 'Today, 7:14am' },
    { text: "Joined Priya's Tuesday pledge", when: 'Yesterday' },
    { text: "Completed last week's pledge", when: '3 days ago' },
    { text: 'Won 250 ELO from the pot', when: '1 week ago' },
  ];

  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={wrap}>
      <H1 style={{ marginBottom: 16 }}>Profile</H1>

      <Card style={{ marginBottom: 16, alignItems: 'center' }}>
        <View style={styles.bigAvatar}><Text style={styles.bigAvatarTxt}>JD</Text></View>
        <Text style={styles.name}>Jamie Doe</Text>
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

      <Text style={[styles.h2, { marginVertical: 12 }]}>Recent Activity</Text>
      <Card style={{ padding: 0, marginBottom: 16 }}>
        {activity.map((a, i) => (
          <View key={i} style={[styles.activityRow, i < activity.length - 1 && styles.divider]}>
            <View style={styles.dot} />
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{a.text}</Text>
              <Sub>{a.when}</Sub>
            </View>
          </View>
        ))}
      </Card>

      <View style={{ gap: 12 }}>
        <Btn label="Browse / switch groups" variant="secondary" icon="group" onPress={onBrowse} />
        <Btn label="Sign Out" variant="tertiary" icon="logout" />
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
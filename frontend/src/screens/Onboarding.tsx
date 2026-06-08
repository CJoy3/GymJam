import React, { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { C, SPACE } from '../theme/tokens';
import { Btn, Card, Eyebrow, FadeInItem, H1, Sub } from '../ui/components';
import { BlobBackground } from '../ui/Blob';
import { useAppState } from '../state/AppState';
import { pageWrap, styles } from './_shared';

/* Onboarding — first-launch gym picker */

export function Onboarding({ onDone }: { onDone: () => void }) {
  const { gyms, setGym } = useAppState();
  const [selId, setSelId] = useState<string | null>(null);
  const selName = gyms.find((g) => g.id === selId)?.name;
  return (
    <View style={styles.screen}>
      <BlobBackground variant="celebrate" />
      <ScrollView contentContainerStyle={pageWrap} showsVerticalScrollIndicator={false}>
        <FadeInItem>
          <Eyebrow style={{ marginBottom: 10 }}>Welcome to GymJam</Eyebrow>
          <H1 style={{ marginBottom: 12 }}>Find your home gym</H1>
          <Sub style={{ marginBottom: 28 }}>
            Pick where you train. You'll join your group once you're settled in.
          </Sub>
        </FadeInItem>

        <View style={{ gap: 12 }}>
          {gyms.map((g, i) => {
            const on = selId === g.id;
            return (
              <FadeInItem key={g.id} delay={80 * (i + 1)}>
                <Card
                  onPress={() => setSelId(g.id)}
                  tone={on ? 'cream' : 'default'}
                  padding={SPACE.xl - 4}
                  style={on ? { borderColor: C.primary } : undefined}
                >
                  <View style={styles.rowBetween}>
                    <View style={[styles.rowGap, { flex: 1 }]}>
                      <View style={[styles.iconChip, { backgroundColor: on ? 'rgba(27,23,20,0.08)' : C.accentSoft }]}>
                        <MaterialIcons name="place" size={20} color={on ? C.primaryFg : C.accent} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.cardTitle, on && { color: C.primaryFg }]}>{g.name}</Text>
                      </View>
                    </View>
                    {on && <MaterialIcons name="check-circle" size={22} color={C.primaryFg} />}
                  </View>
                </Card>
              </FadeInItem>
            );
          })}
        </View>
      </ScrollView>
      <View style={styles.footer}>
        <Btn
          label={selName ? `Continue with ${selName}` : 'Pick a gym to continue'}
          disabled={!selId}
          onPress={async () => { if (selId) { await setGym(selId); onDone(); } }}
        />
      </View>
    </View>
  );
}

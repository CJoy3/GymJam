import React from 'react';
import { Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';

import { C, FONT, SPACE } from '../theme/tokens';
import { Btn, Card, FadeInItem, H1, Sub } from '../ui/components';
import { BlobBackground } from '../ui/Blob';
import { useAppState } from '../state/AppState';
import { EASE_OUT, styles } from './_shared';

/* CheckIn — celebratory success screen */

export function CheckIn({ onClose }: { onClose: () => void }) {
  const { thisWeek, gymName, elo } = useAppState();
  const done = thisWeek.filter((d) => d.state === 'checked-in').length;
  const pledged = thisWeek.filter((d) => d.state === 'checked-in' || d.state === 'planned' || d.state === 'locked').length;

  return (
    <View style={styles.screen}>
      <BlobBackground variant="celebrate" />
      <View style={{ flex: 1, padding: SPACE.xl, paddingTop: 80, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View entering={FadeIn.duration(320).easing(EASE_OUT)} style={styles.bigCheck}>
          <MaterialIcons name="check" size={56} color={C.success} />
        </Animated.View>
        <FadeInItem delay={120} style={{ alignItems: 'center', marginTop: 28 }}>
          <H1 style={{ textAlign: 'center' }}>Well done</H1>
          <Sub style={{ textAlign: 'center', marginTop: 6 }}>Session counted at {gymName || 'your gym'}</Sub>
        </FadeInItem>

        <FadeInItem delay={220} style={{ width: '100%', marginTop: 36 }}>
          <Card padding={SPACE.xl}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
              <SimpleStat label="Done"    value={String(done)}    color={C.success} />
              <SimpleStat label="Pledged" value={String(pledged)} />
              <SimpleStat label="ELO"     value="+10"             color={C.accent} />
            </View>
          </Card>
        </FadeInItem>

        <FadeInItem delay={320} style={{ width: '100%', marginTop: 36 }}>
          <Btn label="Back to home" onPress={onClose} />
        </FadeInItem>

        <Sub style={{ marginTop: 24, textAlign: 'center' }}>Now at {elo.toLocaleString()} ELO</Sub>
      </View>
    </View>
  );
}

function SimpleStat({ label, value, color = C.ink }: { label: string; value: string; color?: string }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={{ fontFamily: FONT.bold, fontSize: 26, color, letterSpacing: -0.4 }}>{value}</Text>
      <Text style={{ fontFamily: FONT.medium, fontSize: 12, color: C.mutedFg, letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 4 }}>{label}</Text>
    </View>
  );
}

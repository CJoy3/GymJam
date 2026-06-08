import React from 'react';
import { View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { C, SPACE } from '../theme/tokens';
import { Btn, FadeInItem, H1, Sub } from '../ui/components';
import { BlobBackground } from '../ui/Blob';
import { styles } from './_shared';

/* NoGroup — empty state */

export function NoGroup({ onBrowse }: { onBrowse: () => void }) {
  return (
    <View style={styles.screen}>
      <BlobBackground variant="celebrate" />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACE.xl }}>
        <View style={styles.bigCheck}>
          <MaterialIcons name="group" size={48} color={C.accent} />
        </View>
        <FadeInItem delay={100} style={{ alignItems: 'center', marginTop: 24 }}>
          <H1 style={{ textAlign: 'center' }}>Join a group</H1>
          <Sub style={{ textAlign: 'center', marginTop: 8, maxWidth: 280 }}>
            You're at your gym but not in a group yet. Find one to start the weekly challenge.
          </Sub>
        </FadeInItem>
        <FadeInItem delay={200} style={{ width: '100%', marginTop: 32 }}>
          <Btn label="Browse groups" onPress={onBrowse} icon="search" />
        </FadeInItem>
      </View>
    </View>
  );
}

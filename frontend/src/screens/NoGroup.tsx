import React from 'react';
import { ScrollView, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { C, SPACE } from '../theme/tokens';
import { Btn, FadeInItem, H1, Sub } from '../ui/components';
import { BlobBackground } from '../ui/Blob';
import { useCoachTarget } from '../ui/CoachMarks';
import { FriendsSection } from './FriendsSection';
import { pageWrap, styles } from './_shared';

/* NoGroup-empty state (friends still work without a group, so they render here too) */

export function NoGroup({ onBrowse }: { onBrowse: () => void }) {
  const tourTarget = useCoachTarget('tour-group');
  return (
    <View style={styles.screen}>
      <BlobBackground variant="group" />
      <ScrollView contentContainerStyle={pageWrap} showsVerticalScrollIndicator={false}>
        <View style={{ alignItems: 'center', paddingTop: 36 }}>
          <View style={styles.bigCheck}>
            <MaterialIcons name="group" size={48} color={C.accent} />
          </View>
          <View ref={tourTarget} collapsable={false} style={{ alignItems: 'center', width: '100%' }}>
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

        {/* Friends are independent of groups-keep them visible here so you can
            still follow people's pledges before you've joined one. */}
        <FriendsSection delay={280} />
        <View style={{ height: SPACE.xl }} />
      </ScrollView>
    </View>
  );
}

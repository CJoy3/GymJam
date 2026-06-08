import React, { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { C, FONT, RADIUS, SPACE } from '../theme/tokens';
import { Btn, Card, Eyebrow, FadeInItem, H1 } from '../ui/components';
import { BlobBackground } from '../ui/Blob';
import { useAppState } from '../state/AppState';
import { pageWrap } from './_shared';

export function DevSettings({ onBack }: { onBack: () => void }) {
  const { elo, goToPreviousWeek, goToNextWeek, goToPreviousDay, goToNextDay, setElo } = useAppState();

  const [steppingClock, setSteppingClock] = useState<null | 'prevWeek' | 'nextWeek' | 'prevDay' | 'nextDay'>(null);
  const [eloDraft, setEloDraft] = useState(String(elo));
  const [settingElo, setSettingElo] = useState(false);

  const step = (key: typeof steppingClock, action: () => Promise<void>) => async () => {
    setSteppingClock(key);
    try { await action(); } finally { setSteppingClock(null); }
  };

  const handleSetElo = async () => {
    const val = parseInt(eloDraft, 10);
    if (isNaN(val) || val < 0) return;
    setSettingElo(true);
    try { await setElo(val); } finally { setSettingElo(false); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <BlobBackground variant="profile" />
      <ScrollView contentContainerStyle={pageWrap} showsVerticalScrollIndicator={false}>

        <FadeInItem>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View>
              <Eyebrow>Debug</Eyebrow>
              <H1 style={{ marginTop: 6 }}>Dev Settings</H1>
            </View>
            <Pressable onPress={onBack} style={closeBtn}>
              <MaterialIcons name="close" size={20} color={C.ink} />
            </Pressable>
          </View>
        </FadeInItem>

        <FadeInItem delay={80} style={{ marginTop: 28 }}>
          <Card padding={SPACE.xl}>
            <Eyebrow style={{ marginBottom: 16 }}>Simulated Clock</Eyebrow>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <ClockBtn
                label="← Week"
                loading={steppingClock === 'prevWeek'}
                disabled={!!steppingClock}
                onPress={step('prevWeek', goToPreviousWeek)}
              />
              <ClockBtn
                label="← Day"
                loading={steppingClock === 'prevDay'}
                disabled={!!steppingClock}
                onPress={step('prevDay', goToPreviousDay)}
              />
              <ClockBtn
                label="Day →"
                loading={steppingClock === 'nextDay'}
                disabled={!!steppingClock}
                onPress={step('nextDay', goToNextDay)}
              />
              <ClockBtn
                label="Week →"
                loading={steppingClock === 'nextWeek'}
                disabled={!!steppingClock}
                onPress={step('nextWeek', goToNextWeek)}
              />
            </View>
          </Card>
        </FadeInItem>

        <FadeInItem delay={140} style={{ marginTop: 14 }}>
          <Card padding={SPACE.xl}>
            <Eyebrow style={{ marginBottom: 4 }}>Set ELO</Eyebrow>
            <Text style={currentEloText}>Current: {elo.toLocaleString()} ELO</Text>
            <TextInput
              value={eloDraft}
              onChangeText={setEloDraft}
              keyboardType="numeric"
              placeholder="Enter ELO value"
              placeholderTextColor={C.mutedFg}
              style={eloInput}
            />
            <View style={{ marginTop: 10 }}>
              <Btn
                label={settingElo ? 'Saving…' : 'Set ELO'}
                disabled={settingElo || !eloDraft || isNaN(parseInt(eloDraft, 10))}
                onPress={handleSetElo}
              />
            </View>
          </Card>
        </FadeInItem>

      </ScrollView>
    </View>
  );
}

function ClockBtn({ label, loading, disabled, onPress }: {
  label: string; loading: boolean; disabled: boolean; onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[clockBtn, disabled && { opacity: 0.5 }]}>
      <Text style={clockBtnText}>{loading ? '…' : label}</Text>
    </Pressable>
  );
}

const closeBtn = {
  width: 40, height: 40, borderRadius: 20,
  backgroundColor: C.card, borderWidth: 1, borderColor: C.borderHi,
  alignItems: 'center' as const, justifyContent: 'center' as const,
};

const clockBtn = {
  flex: 1, height: 44, borderRadius: RADIUS.pill,
  backgroundColor: C.ink,
  alignItems: 'center' as const, justifyContent: 'center' as const,
};

const clockBtnText = { fontFamily: FONT.semibold, fontSize: 12, color: C.primaryFg, letterSpacing: 0.2 };

const currentEloText = { fontFamily: FONT.medium, fontSize: 13, color: C.mutedFg, marginBottom: 10 };

const eloInput = {
  height: 48, paddingHorizontal: 14,
  borderRadius: RADIUS.md, backgroundColor: C.bgSoft,
  borderWidth: 1, borderColor: C.borderHi,
  color: C.ink, fontFamily: FONT.semibold, fontSize: 16,
  marginTop: 4,
};

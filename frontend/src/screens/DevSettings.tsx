import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { C, FONT, RADIUS, SPACE } from '../theme/tokens';
import { Btn, Card, Eyebrow, FadeInItem, H1 } from '../ui/components';
import { BlobBackground } from '../ui/Blob';
import { showToast } from '../ui/toast';
import { useAppState } from '../state/AppState';
import { checkTagAvailable } from '../../lib/api/users';
import { milesTo, sortByProximity } from '../../lib/location';
import { pageWrap } from './_shared';

function useDebounce<T>(value: T, delay: number): T {
  const [d, setD] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setD(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return d;
}

export function AppSettings({ onBack }: { onBack: () => void }) {
  const {
    elo, money,
    tag, tagChanges, updateTag,
    gyms, gymId, setGym,
    goToPreviousWeek, goToNextWeek, goToPreviousDay, goToNextDay,
    setElo, setMoney, shareLocation, setShareLocation, myLocation,
  } = useAppState();
  const sortedGyms = sortByProximity(gyms, myLocation);

  // ── Tag ──────────────────────────────────────────────────────────────────
  const canChangeTag = tagChanges === 0;
  const [editingTag, setEditingTag] = useState(false);
  const [tagDraft, setTagDraft] = useState('');
  const [tagStatus, setTagStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  const [savingTag, setSavingTag] = useState(false);
  const abortRef = useRef(0);
  const debouncedTag = useDebounce(tagDraft, 400);

  useEffect(() => {
    if (!editingTag) return;
    const clean = debouncedTag.trim();
    if (!clean) { setTagStatus('idle'); return; }
    if (!/^[a-zA-Z0-9_-]{3,20}$/.test(clean)) { setTagStatus('invalid'); return; }
    const id = ++abortRef.current;
    setTagStatus('checking');
    checkTagAvailable(clean).then((r) => {
      if (id !== abortRef.current) return;
      setTagStatus(r.available ? 'available' : 'taken');
    }).catch(() => {
      if (id !== abortRef.current) return;
      setTagStatus('idle');
    });
  }, [debouncedTag, editingTag]);

  const openTagEdit = () => {
    setTagDraft(tag ?? '');
    setTagStatus('idle');
    setEditingTag(true);
  };

  const saveTag = async () => {
    if (tagStatus !== 'available') return;
    setSavingTag(true);
    try {
      await updateTag(tagDraft.trim().toLowerCase());
      setEditingTag(false);
      showToast('Tag updated', 'success');
    } catch { /* error shown by updateTag */ } finally {
      setSavingTag(false);
    }
  };

  // ── Gym ───────────────────────────────────────────────────────────────────
  const [editingGym, setEditingGym] = useState(false);
  const [savingGym, setSavingGym] = useState(false);

  const changeGym = async (id: string) => {
    setSavingGym(true);
    try {
      await setGym(id);
      setEditingGym(false);
      showToast('Home gym updated', 'success');
    } catch { /* error shown inside setGym */ } finally {
      setSavingGym(false);
    }
  };

  // ── Dev tools ─────────────────────────────────────────────────────────────
  const [steppingClock, setSteppingClock] = useState<null | 'prevWeek' | 'nextWeek' | 'prevDay' | 'nextDay'>(null);
  const [eloDraft, setEloDraft] = useState(String(elo));
  const [settingElo, setSettingElo] = useState(false);
  const [moneyDraft, setMoneyDraft] = useState((money / 100).toFixed(2));
  const [settingMoney, setSettingMoney] = useState(false);

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

  const moneyPence = Math.round((parseFloat(moneyDraft) || 0) * 100);
  const handleSetMoney = async () => {
    if (isNaN(parseFloat(moneyDraft)) || moneyPence < 0) return;
    setSettingMoney(true);
    try { await setMoney(moneyPence); } finally { setSettingMoney(false); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <BlobBackground variant="profile" />
      <ScrollView contentContainerStyle={pageWrap} showsVerticalScrollIndicator={false}>

        <FadeInItem>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View>
              <Eyebrow>Account</Eyebrow>
              <H1 style={{ marginTop: 6 }}>Settings</H1>
            </View>
            <Pressable onPress={onBack} style={closeBtn}>
              <MaterialIcons name="close" size={20} color={C.ink} />
            </Pressable>
          </View>
        </FadeInItem>

        {/* ── User Settings ── */}
        <FadeInItem delay={60} style={{ marginTop: 28 }}>
          <Card padding={SPACE.xl}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <View style={sectionIcon}>
                <MaterialIcons name="tag" size={16} color={C.accent} />
              </View>
              <Eyebrow>Your Tag</Eyebrow>
            </View>

            {editingTag ? (
              <View style={{ gap: 10 }}>
                <View style={tagInputRow}>
                  <Text style={tagPrefix}>#</Text>
                  <TextInput
                    style={tagInput}
                    value={tagDraft}
                    onChangeText={(t) => {
                      setTagDraft(t.toLowerCase().replace(/[^a-z0-9_-]/g, ''));
                      setTagStatus('idle');
                    }}
                    placeholder="yourhandle"
                    placeholderTextColor={C.mutedFg}
                    autoCapitalize="none"
                    autoFocus
                    maxLength={20}
                  />
                  {tagStatus === 'checking' && <ActivityIndicator size="small" color={C.mutedFg} style={{ marginRight: 10 }} />}
                  {tagStatus === 'available' && <MaterialIcons name="check-circle" size={20} color={C.success} style={{ marginRight: 10 }} />}
                  {tagStatus === 'taken' && <MaterialIcons name="cancel" size={20} color={C.accent} style={{ marginRight: 10 }} />}
                </View>
                {tagStatus === 'available' && <Text style={[hint, { color: C.success }]}>#{tagDraft} is available</Text>}
                {tagStatus === 'taken' && <Text style={[hint, { color: C.accent }]}>#{tagDraft} is already taken</Text>}
                {tagStatus === 'invalid' && <Text style={hint}>3–20 chars, letters / numbers / _ / - only</Text>}
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Btn label={savingTag ? 'Saving…' : 'Save tag'} size="md" loading={savingTag} disabled={tagStatus !== 'available' || savingTag} onPress={saveTag} style={{ flex: 1 }} />
                  <Btn label="Cancel" variant="ghost" size="md" onPress={() => setEditingTag(false)} style={{ flex: 1 }} />
                </View>
                <Text style={[hint, { color: C.mutedFg, marginTop: 2 }]}>You can only change your tag once.</Text>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View>
                  <Text style={valueText}>#{tag ?? '—'}</Text>
                  {!canChangeTag
                    ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                        <MaterialIcons name="lock" size={12} color={C.mutedFg} />
                        <Text style={hint}>Tag is locked</Text>
                      </View>
                    : <Text style={[hint, { marginTop: 4 }]}>1 change remaining</Text>
                  }
                </View>
                {canChangeTag && (
                  <Pressable onPress={openTagEdit} style={editBtn}>
                    <MaterialIcons name="edit" size={15} color={C.mutedFg} />
                  </Pressable>
                )}
              </View>
            )}
          </Card>
        </FadeInItem>

        <FadeInItem delay={100} style={{ marginTop: 14 }}>
          <Card padding={SPACE.xl}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <View style={sectionIcon}>
                <MaterialIcons name="place" size={16} color={C.accent} />
              </View>
              <Eyebrow>Home Gym</Eyebrow>
            </View>

            {editingGym ? (
              <View style={{ gap: 10 }}>
                {sortedGyms.map((g) => {
                  const on = gymId === g.id;
                  const miles = milesTo(myLocation, g);
                  return (
                    <Pressable
                      key={g.id}
                      onPress={() => changeGym(g.id)}
                      disabled={savingGym}
                      style={[gymOption, on && gymOptionSelected]}
                    >
                      <MaterialIcons name="place" size={18} color={on ? C.primaryFg : C.mutedFg} />
                      <Text style={[gymOptionText, on && { color: C.primaryFg }]}>{g.name}</Text>
                      {Number.isFinite(miles) && (
                        <Text style={[gymOptionText, { marginLeft: 'auto', color: on ? C.primaryFg : C.mutedFg, fontSize: 12 }]}>{miles.toFixed(1)} mi</Text>
                      )}
                      {on && <MaterialIcons name="check" size={18} color={C.primaryFg} style={{ marginLeft: Number.isFinite(miles) ? 8 : 'auto' }} />}
                      {savingGym && on && <ActivityIndicator size="small" color={C.primaryFg} />}
                    </Pressable>
                  );
                })}
                <Btn label="Cancel" variant="ghost" size="md" onPress={() => setEditingGym(false)} />
              </View>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={valueText}>{gyms.find((g) => g.id === gymId)?.name ?? 'Not set'}</Text>
                <Pressable onPress={() => setEditingGym(true)} style={editBtn}>
                  <MaterialIcons name="edit" size={15} color={C.mutedFg} />
                </Pressable>
              </View>
            )}
          </Card>
        </FadeInItem>

        {/* ── Location sharing ── */}
        <FadeInItem delay={150} style={{ marginTop: 14 }}>
          <Card padding={SPACE.xl}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={sectionIcon}>
                <MaterialIcons name="my-location" size={16} color={shareLocation ? C.accent : C.mutedFg} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={rowTitle}>Share my location</Text>
                <Text style={subText}>Show your live spot to your squad on the map.</Text>
              </View>
              <Pressable
                onPress={() => setShareLocation(!shareLocation)}
                style={[toggleTrack, shareLocation && { backgroundColor: C.accent, borderColor: C.accent }]}
              >
                <View style={[toggleKnob, shareLocation && { alignSelf: 'flex-end' }]} />
              </Pressable>
            </View>
          </Card>
        </FadeInItem>

        {/* ── Dev Tools ── */}
        <FadeInItem delay={160} style={{ marginTop: 32 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <View style={sectionIcon}>
              <MaterialIcons name="bug-report" size={16} color={C.mutedFg} />
            </View>
            <Eyebrow>Dev Tools</Eyebrow>
          </View>

          <Card padding={SPACE.xl}>
            <Eyebrow style={{ marginBottom: 16 }}>Simulated Clock</Eyebrow>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <ClockBtn label="← Week" loading={steppingClock === 'prevWeek'} disabled={!!steppingClock} onPress={step('prevWeek', goToPreviousWeek)} />
              <ClockBtn label="← Day"  loading={steppingClock === 'prevDay'}  disabled={!!steppingClock} onPress={step('prevDay',  goToPreviousDay)}  />
              <ClockBtn label="Day →"  loading={steppingClock === 'nextDay'}  disabled={!!steppingClock} onPress={step('nextDay',  goToNextDay)}       />
              <ClockBtn label="Week →" loading={steppingClock === 'nextWeek'} disabled={!!steppingClock} onPress={step('nextWeek', goToNextWeek)}       />
            </View>
          </Card>
        </FadeInItem>

        <FadeInItem delay={200} style={{ marginTop: 14 }}>
          <Card padding={SPACE.xl}>
            <Eyebrow style={{ marginBottom: 4 }}>Set ELO</Eyebrow>
            <Text style={subText}>Current: {elo.toLocaleString()} ELO</Text>
            <TextInput value={eloDraft} onChangeText={setEloDraft} keyboardType="numeric" placeholder="Enter ELO" placeholderTextColor={C.mutedFg} style={numInput} />
            <View style={{ marginTop: 10 }}>
              <Btn label={settingElo ? 'Saving…' : 'Set ELO'} disabled={settingElo || !eloDraft || isNaN(parseInt(eloDraft, 10))} onPress={handleSetElo} />
            </View>
          </Card>
        </FadeInItem>

        <FadeInItem delay={240} style={{ marginTop: 14 }}>
          <Card padding={SPACE.xl}>
            <Eyebrow style={{ marginBottom: 4 }}>Set wallet balance</Eyebrow>
            <Text style={subText}>Current: £{(money / 100).toFixed(2)}</Text>
            <TextInput value={moneyDraft} onChangeText={setMoneyDraft} keyboardType="decimal-pad" placeholder="Enter £ amount" placeholderTextColor={C.mutedFg} style={numInput} />
            <View style={{ marginTop: 10 }}>
              <Btn label={settingMoney ? 'Saving…' : 'Set money'} disabled={settingMoney || isNaN(parseFloat(moneyDraft))} onPress={handleSetMoney} />
            </View>
          </Card>
        </FadeInItem>

      </ScrollView>
    </View>
  );
}

// Keep the old export name so the barrel doesn't break during the rename.
export { AppSettings as DevSettings };

function ClockBtn({ label, loading, disabled, onPress }: { label: string; loading: boolean; disabled: boolean; onPress: () => void }) {
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

const sectionIcon = {
  width: 28, height: 28, borderRadius: 8,
  backgroundColor: C.bgSoft, borderWidth: 1, borderColor: C.border,
  alignItems: 'center' as const, justifyContent: 'center' as const,
};

const editBtn = {
  width: 34, height: 34, borderRadius: RADIUS.md,
  backgroundColor: C.bgSoft, borderWidth: 1, borderColor: C.borderHi,
  alignItems: 'center' as const, justifyContent: 'center' as const,
};

const tagInputRow = {
  flexDirection: 'row' as const, alignItems: 'center' as const,
  height: 52, borderRadius: RADIUS.md, backgroundColor: C.bgSoft,
  borderWidth: 1, borderColor: C.borderHi,
};
const tagPrefix = { fontFamily: FONT.bold, fontSize: 18, color: C.mutedFg, paddingHorizontal: 12 };
const tagInput = { flex: 1, color: C.ink, fontFamily: FONT.medium, fontSize: 15 };

const gymOption = {
  flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10,
  padding: 14, borderRadius: RADIUS.md,
  backgroundColor: C.bgSoft, borderWidth: 1, borderColor: C.border,
};
const gymOptionSelected = { backgroundColor: C.primary, borderColor: C.primary };
const gymOptionText = { fontFamily: FONT.semibold, fontSize: 14, color: C.ink, flex: 1 };

const valueText = { fontFamily: FONT.semibold, fontSize: 16, color: C.ink };
const hint = { fontFamily: FONT.regular, fontSize: 12, color: C.mutedFg };

const clockBtn = {
  flex: 1, height: 44, borderRadius: RADIUS.pill,
  backgroundColor: C.ink,
  alignItems: 'center' as const, justifyContent: 'center' as const,
};
const clockBtnText = { fontFamily: FONT.semibold, fontSize: 12, color: C.primaryFg, letterSpacing: 0.2 };

const subText = { fontFamily: FONT.medium, fontSize: 13, color: C.mutedFg, marginBottom: 10 };
const rowTitle = { fontFamily: FONT.bold, fontSize: 15, color: C.ink, marginBottom: 2 };
const toggleTrack = {
  width: 46, height: 28, borderRadius: 14, padding: 3,
  backgroundColor: C.bgSoft, borderWidth: 1, borderColor: C.borderHi,
  justifyContent: 'center' as const,
};
const toggleKnob = {
  width: 20, height: 20, borderRadius: 10, backgroundColor: C.ink, alignSelf: 'flex-start' as const,
};
const numInput = {
  height: 48, paddingHorizontal: 14, marginTop: 4,
  borderRadius: RADIUS.md, backgroundColor: C.bgSoft,
  borderWidth: 1, borderColor: C.borderHi,
  color: C.ink, fontFamily: FONT.semibold, fontSize: 16,
};

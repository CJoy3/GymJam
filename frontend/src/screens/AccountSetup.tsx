import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { checkTagAvailable } from '../../lib/api/users';
import { C, FONT, RADIUS, SPACE } from '../theme/tokens';
import { Btn, Card, Eyebrow, FadeInItem, H1, Sub } from '../ui/components';
import { BlobBackground } from '../ui/Blob';
import { showToast } from '../ui/toast';
import { useAppState } from '../state/AppState';
import { pageWrap, styles } from './_shared';

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export function AccountSetup({ onDone }: { onDone: () => void }) {
  const { gyms, setGym, updateTag } = useAppState();

  const [tag, setTagVal] = useState('');
  const [tagStatus, setTagStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  const [gymId, setGymId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const checkAbortRef = useRef<number>(0);

  const debouncedTag = useDebounce(tag, 400);

  const validateTagFormat = (t: string) => /^[a-zA-Z0-9_-]{3,20}$/.test(t);

  useEffect(() => {
    const clean = debouncedTag.trim();
    if (!clean) { setTagStatus('idle'); return; }
    if (!validateTagFormat(clean)) { setTagStatus('invalid'); return; }

    const id = ++checkAbortRef.current;
    setTagStatus('checking');
    checkTagAvailable(clean).then((res) => {
      if (id !== checkAbortRef.current) return;
      setTagStatus(res.available ? 'available' : 'taken');
    }).catch(() => {
      if (id !== checkAbortRef.current) return;
      setTagStatus('idle');
    });
  }, [debouncedTag]);

  const onTagChange = useCallback((t: string) => {
    const clean = t.toLowerCase().replace(/[^a-z0-9_-]/g, '');
    setTagVal(clean);
    setTagStatus('idle');
  }, []);

  const canContinue = tagStatus === 'available' && !!gymId && !saving;

  const handleContinue = async () => {
    if (!canContinue) return;
    setSaving(true);
    try {
      await Promise.all([
        updateTag(tag.trim()),
        setGym(gymId!),
      ]);
      onDone();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Could not save, please retry', 'error');
    } finally {
      setSaving(false);
    }
  };

  const tagHint = () => {
    switch (tagStatus) {
      case 'available': return { text: `#${tag} is available`, color: C.success };
      case 'taken': return { text: `#${tag} is already taken`, color: C.accent };
      case 'invalid': return { text: '3–20 characters, letters/numbers/_/- only', color: C.mutedFg };
      case 'checking': return { text: 'Checking…', color: C.mutedFg };
      default: return null;
    }
  };
  const hint = tagHint();

  return (
    <View style={styles.screen}>
      <BlobBackground variant="profile" />
      <ScrollView contentContainerStyle={[pageWrap, { paddingBottom: 140 }]} showsVerticalScrollIndicator={false}>
        <FadeInItem>
          <Eyebrow>Welcome to GymJam</Eyebrow>
          <H1 style={{ marginTop: 6 }}>Set up your account</H1>
          <Sub style={{ marginTop: 8 }}>
            Choose a unique tag and home gym — you can always change your gym later.
          </Sub>
        </FadeInItem>

        {/* Tag picker */}
        <FadeInItem delay={80} style={{ marginTop: 28 }}>
          <Card padding={SPACE.xl}>
            <View style={localS.sectionHeader}>
              <View style={[styles.iconChip, { backgroundColor: C.accentSoft }]}>
                <MaterialIcons name="tag" size={18} color={C.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Eyebrow>Your tag</Eyebrow>
                <Sub style={{ marginTop: 2 }}>Your unique handle — visible to your group.</Sub>
              </View>
            </View>

            <View style={localS.tagInputWrap}>
              <Text style={localS.tagPrefix}>#</Text>
              <TextInput
                style={localS.tagInput}
                value={tag}
                onChangeText={onTagChange}
                placeholder="yournametag"
                placeholderTextColor={C.mutedFg}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={20}
              />
              {tagStatus === 'checking' && (
                <ActivityIndicator size="small" color={C.mutedFg} style={{ marginRight: 12 }} />
              )}
              {tagStatus === 'available' && (
                <MaterialIcons name="check-circle" size={22} color={C.success} style={{ marginRight: 12 }} />
              )}
              {tagStatus === 'taken' && (
                <MaterialIcons name="cancel" size={22} color={C.accent} style={{ marginRight: 12 }} />
              )}
            </View>
            {hint && (
              <Text style={[localS.tagHint, { color: hint.color }]}>{hint.text}</Text>
            )}
          </Card>
        </FadeInItem>

        {/* Gym picker */}
        <FadeInItem delay={140} style={{ marginTop: 14 }}>
          <Eyebrow style={{ marginBottom: 12 }}>Choose your home gym</Eyebrow>
          <View style={{ gap: 10 }}>
            {gyms.map((g, i) => {
              const on = gymId === g.id;
              return (
                <FadeInItem key={g.id} delay={80 * (i + 1)}>
                  <Card
                    onPress={() => setGymId(g.id)}
                    tone={on ? 'cream' : 'default'}
                    padding={SPACE.xl - 4}
                    style={on ? { borderColor: C.primary } : undefined}
                  >
                    <View style={styles.rowBetween}>
                      <View style={[styles.rowGap, { flex: 1 }]}>
                        <View style={[styles.iconChip, { backgroundColor: on ? 'rgba(27,23,20,0.08)' : C.accentSoft }]}>
                          <MaterialIcons name="place" size={20} color={on ? C.primaryFg : C.accent} />
                        </View>
                        <Text style={[styles.cardTitle, on && { color: C.primaryFg }]}>{g.name}</Text>
                      </View>
                      {on && <MaterialIcons name="check-circle" size={22} color={C.primaryFg} />}
                    </View>
                  </Card>
                </FadeInItem>
              );
            })}
          </View>
        </FadeInItem>
      </ScrollView>

      <View style={styles.footer}>
        <Btn
          label={saving ? 'Setting up…' : (!gymId ? 'Pick a gym to continue' : tagStatus !== 'available' ? 'Enter a valid tag' : 'Continue')}
          loading={saving}
          disabled={!canContinue}
          onPress={handleContinue}
        />
      </View>
    </View>
  );
}

const localS = StyleSheet.create({
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 16 },

  tagInputWrap: {
    flexDirection: 'row', alignItems: 'center',
    height: 52,
    borderRadius: RADIUS.md, backgroundColor: C.bgSoft,
    borderWidth: 1, borderColor: C.borderHi,
  },
  tagPrefix: {
    fontFamily: FONT.bold, fontSize: 18, color: C.mutedFg,
    paddingLeft: 14, paddingRight: 4,
  },
  tagInput: {
    flex: 1, height: '100%',
    fontFamily: FONT.semibold, fontSize: 16, color: C.ink,
  },
  tagHint: {
    fontFamily: FONT.medium, fontSize: 12, marginTop: 8, paddingLeft: 2,
  },
});

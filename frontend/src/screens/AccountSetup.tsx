import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { checkTagAvailable } from '../../lib/api/users';
import { boundsAround, getGymsMap, type GymMapPoint } from '../../lib/api/gyms';
import { milesTo, sortByProximity } from '../../lib/location';
import { userFacingMessage } from '../state/mappers';
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

// A selectable home-gym option — either a curated DB gym (has a real id) or a
// live map (OSM) gym that must be resolved into a real gym row when chosen.
type GymOption = {
  key: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  gymId: string;        // every gym (nearby or curated) is a real DB row now
};

const NEARBY_RADIUS_MILES = 8;
const NEARBY_LIMIT = 15;

export function AccountSetup({ onDone }: { onDone: () => void }) {
  const { gyms, setGym, updateTag, myLocation, refreshMyLocation } = useAppState();
  const [locating, setLocating] = useState(false);

  // Real gyms near the user, pulled live from the map (OSM) once location is
  // granted. Falls back to the curated seed list when we have no location/results.
  const [nearby, setNearby] = useState<GymMapPoint[] | null>(null);
  const [loadingNearby, setLoadingNearby] = useState(false);

  const fetchNearby = useCallback(async (loc: { lat: number; lng: number }) => {
    setLoadingNearby(true);
    try {
      const points = await getGymsMap(boundsAround(loc.lat, loc.lng, NEARBY_RADIUS_MILES));
      const sorted = sortByProximity(points, loc).slice(0, NEARBY_LIMIT);
      setNearby(sorted);
    } catch {
      setNearby([]); // signal "we tried" so we fall back to curated gyms
    } finally {
      setLoadingNearby(false);
    }
  }, []);

  // If we already have a stored location on mount, surface nearby gyms straight away.
  useEffect(() => {
    if (myLocation && nearby === null) fetchNearby(myLocation);
  }, [myLocation, nearby, fetchNearby]);

  // Grant the PRIVATE device location, then pull real nearby gyms from the map.
  // Stays on-device — not the public squad-map sharing.
  const useMyLocation = async () => {
    setLocating(true);
    try {
      const c = await refreshMyLocation();
      if (c) {
        await fetchNearby(c);
        showToast('Found gyms near you', 'success');
      } else {
        showToast('Location permission denied', 'info');
      }
    } finally {
      setLocating(false);
    }
  };

  // Unified option list: real nearby gyms when we have them, else curated seeds.
  const hasNearby = !!nearby && nearby.length > 0;
  const options: GymOption[] = hasNearby
    ? nearby!.map((p) => ({ key: p.id, name: p.name, latitude: p.latitude, longitude: p.longitude, gymId: p.id }))
    : sortByProximity(gyms, myLocation).map((g) => ({ key: g.id, name: g.name, latitude: g.latitude, longitude: g.longitude, gymId: g.id }));

  const [tag, setTagVal] = useState('');
  const [tagStatus, setTagStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const selected = options.find((o) => o.key === selectedKey) ?? null;
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

  const canContinue = tagStatus === 'available' && !!selected && !saving;

  const handleContinue = async () => {
    if (!canContinue || !selected) return;
    setSaving(true);
    try {
      // Every gym on the map is a real `gyms` row now (seeded from OpenStreetMap),
      // so the picked option already carries its id — no resolve round-trip.
      await Promise.all([
        updateTag(tag.trim()),
        setGym(selected.gymId),
      ]);
      onDone();
    } catch (e: unknown) {
      // Failures stay silent (no error popup) — log only for debugging.
      if (__DEV__) console.warn('Account setup failed', userFacingMessage(e), e);
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
          <Eyebrow style={{ marginBottom: 12 }}>
            {hasNearby ? 'Choose your home gym · gyms near you' : myLocation ? 'Choose your home gym · nearest first' : 'Choose your home gym'}
          </Eyebrow>

          {/* Use your location to find real gyms near you. Private — on-device only. */}
          <Pressable
            style={[localS.locBtn, myLocation && localS.locBtnOn]}
            onPress={useMyLocation}
            disabled={locating || loadingNearby}
          >
            {locating || loadingNearby ? (
              <ActivityIndicator color={C.ink} size="small" />
            ) : (
              <>
                <MaterialIcons name={myLocation ? 'check-circle' : 'near-me'} size={18} color={myLocation ? C.success : C.ink} />
                <Text style={localS.locBtnText}>{myLocation ? 'Showing gyms near you' : 'Find gyms near me'}</Text>
              </>
            )}
          </Pressable>
          <Text style={localS.locHint}>Private — used only to find nearby gyms, never shared.</Text>

          {myLocation && nearby !== null && nearby.length === 0 && !loadingNearby && (
            <Text style={[localS.locHint, { marginTop: 10 }]}>
              No gyms found nearby — pick one of ours below for now.
            </Text>
          )}

          <View style={{ gap: 10, marginTop: 14 }}>
            {options.map((g, i) => {
              const on = selectedKey === g.key;
              const miles = milesTo(myLocation, g);
              return (
                <FadeInItem key={g.key} delay={Math.min(80 * (i + 1), 400)}>
                  <Card
                    onPress={() => setSelectedKey(g.key)}
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
                      {Number.isFinite(miles) && (
                        <Text style={[localS.distance, on && { color: C.primaryFg }]}>{miles.toFixed(1)} mi</Text>
                      )}
                      {on && <MaterialIcons name="check-circle" size={22} color={C.primaryFg} style={{ marginLeft: 8 }} />}
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
          label={saving ? 'Setting up…' : (!selected ? 'Pick a gym to continue' : tagStatus !== 'available' ? 'Enter a valid tag' : 'Continue')}
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
  distance: {
    fontFamily: FONT.semibold, fontSize: 12, color: C.mutedFg,
  },
  locBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 46, borderRadius: RADIUS.md,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.borderHi,
  },
  locBtnOn: { borderColor: C.success },
  locBtnText: { fontFamily: FONT.semibold, fontSize: 14, color: C.ink },
  locHint: {
    fontFamily: FONT.regular, fontSize: 11, color: C.mutedFg, marginTop: 8, paddingLeft: 2,
  },
});

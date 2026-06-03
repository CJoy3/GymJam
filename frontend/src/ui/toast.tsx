import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { C, FONT, RADIUS, SPACE } from '../theme/tokens';

export type ToastVariant = 'success' | 'error' | 'info';
type Toast = { id: number; message: string; variant: ToastVariant };

let push: ((t: Omit<Toast, 'id'>) => void) | null = null;

export function showToast(message: string, variant: ToastVariant = 'info') {
  push?.({ message, variant });
}

const VISIBLE_MS = 2400;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const seq = useRef(0);

  useEffect(() => {
    push = (t) => {
      const id = ++seq.current;
      setItems((cur) => [...cur, { id, ...t }]);
      setTimeout(() => setItems((cur) => cur.filter((x) => x.id !== id)), VISIBLE_MS);
    };
    return () => { push = null; };
  }, []);

  return (
    <>
      {children}
      <SafeAreaView pointerEvents="none" style={styles.layer} edges={['bottom']}>
        <View style={styles.stack}>
          {items.map((t) => <ToastBubble key={t.id} toast={t} />)}
        </View>
      </SafeAreaView>
    </>
  );
}

function ToastBubble({ toast }: { toast: Toast }) {
  const slide = useRef(new Animated.Value(20)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slide, { toValue: 0, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(fade,  { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
    const t = setTimeout(() => {
      Animated.parallel([
        Animated.timing(slide, { toValue: 20, duration: 200, useNativeDriver: true }),
        Animated.timing(fade,  { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }, VISIBLE_MS - 260);
    return () => clearTimeout(t);
  }, [fade, slide]);

  const palette =
    toast.variant === 'error' ? { fg: C.danger, icon: 'error-outline' as const }
    : toast.variant === 'success' ? { fg: C.success, icon: 'check-circle' as const }
    : { fg: C.ink, icon: 'info-outline' as const };

  return (
    <Animated.View style={[styles.bubble, { opacity: fade, transform: [{ translateY: slide }] }]}>
      <MaterialIcons name={palette.icon} size={18} color={palette.fg} />
      <Text style={styles.text}>{toast.message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center' },
  stack: { gap: 8, marginBottom: 96, alignItems: 'center' },
  bubble: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: SPACE.lg, paddingVertical: 12,
    borderRadius: RADIUS.pill,
    backgroundColor: C.card,
    borderWidth: 1, borderColor: C.borderHi,
    shadowColor: '#000', shadowOpacity: 0.45, shadowRadius: 18, shadowOffset: { width: 0, height: 8 },
    maxWidth: '92%',
  },
  text: { color: C.ink, fontFamily: FONT.medium, fontSize: 13.5 },
});

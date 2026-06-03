import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { C, RADIUS, SPACE } from '../theme/tokens';

export type ToastVariant = 'success' | 'error' | 'info';
type Toast = { id: number; message: string; variant: ToastVariant };

/**
 * Imperative toast queue. The provider mounts once at app root and registers
 * a setter that {@link showToast} calls from anywhere — including non-component
 * code (AppState callbacks, API error handlers).
 */
let push: ((t: Omit<Toast, 'id'>) => void) | null = null;

export function showToast(message: string, variant: ToastVariant = 'info') {
  push?.({ message, variant });
}

const VISIBLE_MS = 2200;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const seq = useRef(0);

  useEffect(() => {
    push = (t) => {
      const id = ++seq.current;
      setItems((cur) => [...cur, { id, ...t }]);
      setTimeout(() => {
        setItems((cur) => cur.filter((x) => x.id !== id));
      }, VISIBLE_MS);
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
      Animated.timing(slide, { toValue: 0, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(fade,  { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
    const t = setTimeout(() => {
      Animated.parallel([
        Animated.timing(slide, { toValue: 20, duration: 180, useNativeDriver: true }),
        Animated.timing(fade,  { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start();
    }, VISIBLE_MS - 220);
    return () => clearTimeout(t);
  }, [fade, slide]);

  const accent =
    toast.variant === 'error' ? C.danger :
    toast.variant === 'success' ? C.primary :
    C.inkSoft;

  return (
    <Animated.View style={[styles.bubble, { opacity: fade, transform: [{ translateY: slide }] }]}>
      <View style={[styles.dot, { backgroundColor: accent }]} />
      <Text style={styles.text}>{toast.message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center' },
  stack: { gap: 8, marginBottom: 90, alignItems: 'center' },
  bubble: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: SPACE.lg, paddingVertical: 12,
    borderRadius: RADIUS.pill,
    backgroundColor: C.card,
    borderWidth: 1, borderColor: C.border,
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 16, shadowOffset: { width: 0, height: 6 },
    maxWidth: '92%',
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  text: { color: C.ink, fontSize: 14, fontWeight: '500' },
});

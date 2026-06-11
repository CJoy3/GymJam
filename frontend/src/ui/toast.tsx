import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { C, FONT, RADIUS, SPACE } from '../theme/tokens';
import { Glass } from './Glass';

export type ToastVariant = 'success' | 'error' | 'info';
type Toast = { id: number; message: string; variant: ToastVariant };

let push: ((t: Omit<Toast, 'id'>) => void) | null = null;

export function showToast(message: string, variant: ToastVariant = 'info') {
  // Product decision: never pop error toasts to the user. Failed actions stay
  // silent (logged for debugging only); only successes and input guidance show.
  // This is the single guarantee that no raw/internal error -"Internal Server
  // Error", network failures, auth faults- can ever reach the UI, regardless
  // of which call site produced it. Keep it here so the rule can't drift.
  if (variant === 'error') {
    if (__DEV__) console.warn('[suppressed error toast]', message);
    return;
  }
  push?.({ message, variant });
}

const VISIBLE_MS = 2400;

const ToastCtx = createContext<Toast[]>([]);

/**
 * Holds the toast queue and registers the global `push`. It does NOT render the
 * toasts itself — that's `<ToastViewport />`, which must be placed *inside* the
 * app's screen layer. Why: the toast bubble is liquid glass, and a glass/blur
 * view can only refract content in its own native layer. Rendered here (outside
 * expo-router's <Stack>) the glass had nothing to sample and looked transparent;
 * rendered inside the screen (next to the nav bar) it refracts like everything else.
 */
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

  return <ToastCtx.Provider value={items}>{children}</ToastCtx.Provider>;
}

/** Renders the active toasts. Place this inside a screen (same native layer as
 *  other content) so the glass bubbles can refract the backdrop. */
export function ToastViewport() {
  const items = useContext(ToastCtx);
  return (
    <SafeAreaView pointerEvents="none" style={styles.layer} edges={['bottom']}>
      <View style={styles.stack}>
        {items.map((t) => <ToastBubble key={t.id} toast={t} />)}
      </View>
    </SafeAreaView>
  );
}

function ToastBubble({ toast }: { toast: Toast }) {
  // IMPORTANT: only the slide (translateY) is animated, never opacity. iOS
  // disables a blur/Liquid-Glass effect while its view (or an ancestor) has
  // alpha < 1 and doesn't reliably restore it — so animating the bubble's
  // opacity made the glass render clear/transparent. Sliding keeps alpha at 1,
  // so the glass refracts the whole time. The content fades via the inner view.
  const slide = useRef(new Animated.Value(28)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slide, { toValue: 0, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
    const t = setTimeout(() => {
      Animated.parallel([
        Animated.timing(slide, { toValue: 40, duration: 220, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
        Animated.timing(fade, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start();
    }, VISIBLE_MS - 280);
    return () => clearTimeout(t);
  }, [fade, slide]);

  const palette =
    toast.variant === 'error' ? { fg: C.danger, icon: 'error-outline' as const }
      : toast.variant === 'success' ? { fg: C.success, icon: 'check-circle' as const }
        : { fg: C.ink, icon: 'info-outline' as const };

  return (
    <Animated.View style={[styles.bubble, { transform: [{ translateY: slide }] }]}>
      <Glass radius={RADIUS.pill} dim={0.22} style={StyleSheet.absoluteFill} />
      <Animated.View style={[styles.row, { opacity: fade }]}>
        <MaterialIcons name={palette.icon} size={18} color={palette.fg} />
        <Text style={styles.text}>{toast.message}</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center' },
  stack: { gap: 8, marginBottom: 96, alignItems: 'center' },
  bubble: {
    paddingHorizontal: SPACE.lg, paddingVertical: 12,
    borderRadius: RADIUS.pill,
    borderWidth: 1, borderColor: C.borderHi,
    shadowColor: '#000', shadowOpacity: 0.45, shadowRadius: 18, shadowOffset: { width: 0, height: 8 },
    maxWidth: '92%',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  text: { color: C.ink, fontFamily: FONT.medium, fontSize: 13.5 },
});

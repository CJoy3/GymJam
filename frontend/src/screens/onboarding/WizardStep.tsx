/**
 * One step of the first-run welcome wizard: eyebrow + title + body, an optional
 * illustration block, progress dots, and the Continue / Skip footer. Pure
 * layout — the overlay owns step state and persistence.
 */
import React, { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { C, FONT, SPACE } from '../../theme/tokens';
import { Body, Btn, Eyebrow, H1 } from '../../ui/components';

export function WizardStep({
  eyebrow, title, body, illustration, primaryLabel, onPrimary, onSkip, step, total,
}: {
  eyebrow: string;
  title: string;
  body: string;
  illustration?: ReactNode;
  primaryLabel: string;
  onPrimary: () => void;
  /** Omit to hide the skip option (step 1). */
  onSkip?: () => void;
  step: number; // 0-based
  total: number;
}) {
  return (
    <View style={s.wrap}>
      <View style={s.content}>
        <Eyebrow>{eyebrow}</Eyebrow>
        <H1 style={{ marginTop: 8 }}>{title}</H1>
        <Body style={s.body}>{body}</Body>
        {illustration && <View style={s.illustration}>{illustration}</View>}
      </View>

      <View>
        <View style={s.dots}>
          {Array.from({ length: total }, (_, i) => (
            <View key={i} style={[s.dot, i === step && s.dotOn]} />
          ))}
        </View>
        <Btn label={primaryLabel} onPress={onPrimary} />
        {onSkip ? (
          <Pressable onPress={onSkip} hitSlop={10} style={s.skip}>
            <Text style={s.skipText}>Skip</Text>
          </Pressable>
        ) : (
          // Keep the footer height stable so the button doesn't jump between steps.
          <View style={s.skip} />
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, padding: SPACE.xl, paddingBottom: SPACE.lg, justifyContent: 'space-between' },
  content: { marginTop: 48 },
  body: { marginTop: 12, color: C.inkSoft },
  illustration: { marginTop: 28 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: SPACE.lg },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.muted },
  dotOn: { width: 18, backgroundColor: C.accent },
  skip: { height: 44, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  skipText: { fontFamily: FONT.semibold, fontSize: 14, color: C.mutedFg },
});

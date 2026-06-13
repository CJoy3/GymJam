import React from 'react';
import { View, StyleSheet } from 'react-native';
import { C } from '../theme/tokens';

/**
 * Atmospheric background blobs-soft warm glows behind the content layer.
 * Variants tint different corners depending on screen mood.
 */
export function BlobBackground({ variant = 'home' }: { variant?: 'home' | 'group' | 'progress' | 'profile' }) {
  switch (variant) {
    case 'group':
      return (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <View style={[styles.blob, { width: 320, height: 320, top: -60, right: -110, backgroundColor: C.glowSage }]} />
          <View style={[styles.blob, { width: 260, height: 260, top: 240, left: -110, backgroundColor: C.glowPeach }]} />
        </View>
      );
    case 'progress':
      return (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <View style={[styles.blob, { width: 360, height: 360, top: -100, right: -140, backgroundColor: C.glowCream }]} />
        </View>
      );
    case 'profile':
      return (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <View style={[styles.blob, { width: 320, height: 320, top: -90, left: -110, backgroundColor: C.glowPeach }]} />
        </View>
      );
    case 'home':
    default:
      return (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <View style={[styles.blob, { width: 380, height: 380, top: -120, right: -120, backgroundColor: C.glowPeach }]} />
          <View style={[styles.blob, { width: 280, height: 280, top: 380, left: -120, backgroundColor: C.glowSage }]} />
        </View>
      );
  }
}

const styles = StyleSheet.create({
  blob: {
    position: 'absolute',
    borderRadius: 999,
  },
});

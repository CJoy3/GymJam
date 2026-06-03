import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { C } from '../theme/tokens';

/**
 * Atmospheric background blobs — soft warm glows behind the content layer.
 * Variants tint different corners; combine them for a richer feel.
 */
export function BlobBackground({ variant = 'home' }: { variant?: 'home' | 'group' | 'progress' | 'profile' | 'celebrate' }) {
  switch (variant) {
    case 'celebrate':
      return (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <LinearGradient
            colors={['rgba(232,155,124,0.22)', 'rgba(27,23,20,0)']}
            start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.65 }}
            style={[StyleSheet.absoluteFill]}
          />
          <View style={[styles.blob, { width: 360, height: 360, top: -80, right: -120, backgroundColor: C.glowPeach }]} />
          <View style={[styles.blob, { width: 280, height: 280, bottom: -60, left: -90, backgroundColor: C.glowCream }]} />
        </View>
      );
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

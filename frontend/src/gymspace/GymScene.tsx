/**
 * The animated pixel-art gym diorama. Everything is derived from `elo`:
 * the room palette + character come from the arena tier, and props pop in at
 * their own ELO thresholds so the room fills up as you progress. Purely visual
 * (passive) — there is nothing to maintain.
 */
import React, { useEffect, useState } from 'react';
import { LayoutChangeEvent, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing, FadeIn, useAnimatedStyle, useSharedValue, withRepeat, withTiming,
} from 'react-native-reanimated';

import { C, RADIUS } from '../theme/tokens';
import { PixelSprite, spriteSize } from './pixel';
import { CHARACTERS } from './sprites';
import {
  CHARACTER_BAND, FLOOR_ITEMS, Tier, TIERS, WALL_ITEMS, tierForScene,
} from './manifest';

const WALL_FRAC = 0.6;       // top 60% is wall, rest is floor
const VIRTUAL_COLS = 64;     // scene is ~64 pixels wide; one px = width / 64

export function GymScene({
  elo,
  aspect = 1.45,
  style,
}: {
  elo: number;
  aspect?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const [w, setW] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width);

  const { tier } = tierForScene(elo);

  // Idle "breathing" bob for the character.
  const bob = useSharedValue(0);
  useEffect(() => {
    bob.value = withRepeat(
      withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [bob]);
  const charStyle = useAnimatedStyle(() => ({ transform: [{ translateY: bob.value * -2 }] }));

  const h = w / aspect;
  const px = w / VIRTUAL_COLS;
  const floorLine = h * WALL_FRAC;

  return (
    <View style={[styles.frame, { aspectRatio: aspect }, style]} onLayout={onLayout}>
      {w > 0 && (
        <>
          {/* Room: warm wall + floor blocks, palette set by tier. */}
          <View style={[StyleSheet.absoluteFill, { backgroundColor: tier.wall }]} />
          <View style={{ position: 'absolute', left: 0, right: 0, top: floorLine, bottom: 0, backgroundColor: tier.floor }} />
          <View style={{ position: 'absolute', left: 0, right: 0, top: floorLine, height: 1, backgroundColor: C.borderHi }} />

          {/* Warm overhead light wash; intensifies with tier. */}
          <LinearGradient
            pointerEvents="none"
            colors={[`rgba(232,155,124,${tier.glow})`, 'rgba(232,155,124,0)']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 0.7 }}
            style={StyleSheet.absoluteFill}
          />

          {/* Wall-mounted decor. */}
          {WALL_ITEMS.filter((it) => elo >= it.elo).map((it, i) => {
            const s = spriteSize(it.sprite);
            return (
              <Animated.View
                key={it.id}
                entering={FadeIn.duration(420).delay(120 + i * 80)}
                style={{
                  position: 'absolute',
                  left: it.x * w - (s.w * px) / 2,
                  top: it.top * floorLine,
                }}
              >
                <PixelSprite rows={it.sprite} pixel={px} />
              </Animated.View>
            );
          })}

          {/* Floor props + character, drawn back-to-front by depth. */}
          {buildFloorNodes(elo, tier).map((node, i) => {
            const s = spriteSize(node.sprite);
            const baseY = floorLine + node.band * (h - floorLine);
            const left = node.x * w - (s.w * px) / 2;
            const top = baseY - s.h * px;
            if (node.isCharacter) {
              return (
                <Animated.View
                  key="character"
                  entering={FadeIn.duration(500)}
                  style={[{ position: 'absolute', left, top }, charStyle]}
                >
                  {/* contact shadow */}
                  <View
                    style={{
                      position: 'absolute',
                      left: s.w * px * 0.12,
                      top: s.h * px - px * 1.5,
                      width: s.w * px * 0.76,
                      height: px * 2.5,
                      borderRadius: px * 2,
                      backgroundColor: 'rgba(0,0,0,0.28)',
                    }}
                  />
                  <PixelSprite rows={node.sprite} pixel={px} />
                </Animated.View>
              );
            }
            return (
              <Animated.View
                key={node.id}
                entering={FadeIn.duration(420).delay(200 + i * 70)}
                style={{ position: 'absolute', left, top }}
              >
                <PixelSprite rows={node.sprite} pixel={px} />
              </Animated.View>
            );
          })}
        </>
      )}
    </View>
  );
}

type FloorNode = { id: string; sprite: string[]; x: number; band: number; isCharacter?: boolean };

function buildFloorNodes(elo: number, tier: Tier): FloorNode[] {
  const nodes: FloorNode[] = FLOOR_ITEMS.filter((it) => elo >= it.elo).map((it) => ({
    id: it.id, sprite: it.sprite, x: it.x, band: it.band,
  }));
  nodes.push({
    id: 'character',
    sprite: CHARACTERS[tier.character] ?? CHARACTERS.scrawny,
    x: 0.5,
    band: CHARACTER_BAND,
    isCharacter: true,
  });
  // Back-to-front so nearer (higher band) items overlap those behind them.
  return nodes.sort((a, b) => a.band - b.band);
}

// Re-exported for callers that want tier metadata (e.g. labels).
export { TIERS, tierForScene };

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    backgroundColor: C.bgSoft,
    borderWidth: 1,
    borderColor: C.border,
  },
});

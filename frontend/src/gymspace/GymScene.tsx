/**
 * The animated pixel-art gym diorama. Room palette + character come from the
 * arena tier (derived from `elo`); the character plays a looping dumbbell-curl.
 *
 * Props are user-placed: pass `placedItemIds` to control which appear. In
 * `editable` mode every *unlocked* prop is tappable-placed ones show solid
 * (tap to remove), unplaced ones show ghosted with a + (tap to add).
 */
import React, { useEffect, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing, FadeIn, useAnimatedStyle, useSharedValue, withRepeat, withTiming,
} from 'react-native-reanimated';

import { C, FONT, RADIUS } from '../theme/tokens';
import { AnimatedPixelSprite, PixelSprite, spriteSize } from './pixel';
import { CHARACTER_FRAMES } from './characters';
import {
  CHARACTER_BAND, FLOOR_ITEMS, Tier, TIERS, WALL_ITEMS, tierForScene,
} from './manifest';

const WALL_FRAC = 0.6;
const VIRTUAL_COLS = 70;
const CURL_FPS = 2.2;

export function GymScene({
  elo,
  aspect = 1.45,
  editable = false,
  placedItemIds,
  onToggleItem,
  unlockElo,
  style,
}: {
  elo: number;
  aspect?: number;
  editable?: boolean;
  placedItemIds?: Set<string>;
  onToggleItem?: (id: string) => void;
  /** ELO used for the unlock checks only (room tier still follows `elo`).
   *  Defaults to `elo`. The community gym passes Infinity so every item a
   *  member contributed renders, whatever the group's average tier. */
  unlockElo?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const [w, setW] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width);
  const { tier } = tierForScene(elo);
  const unlock = unlockElo ?? elo;

  // Gentle whole-body bob layered under the curl frames.
  const bob = useSharedValue(0);
  useEffect(() => {
    bob.value = withRepeat(withTiming(1, { duration: 1700, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [bob]);
  const charStyle = useAnimatedStyle(() => ({ transform: [{ translateY: bob.value * -1.5 }] }));

  const h = w / aspect;
  const px = w / VIRTUAL_COLS;
  const floorLine = h * WALL_FRAC;
  const placed = placedItemIds ?? new Set<string>();

  // Decide whether a placeable prop should render, and how.
  const propVisual = (id: string, unlocked: boolean): 'solid' | 'ghost' | null => {
    if (!unlocked) return null;
    if (placed.has(id)) return 'solid';
    return editable ? 'ghost' : null;
  };

  const frames = CHARACTER_FRAMES[tier.character] ?? CHARACTER_FRAMES.scrawny;
  const charSize = spriteSize(frames[0]);

  return (
    <View style={[styles.frame, { aspectRatio: aspect }, style]} onLayout={onLayout}>
      {w > 0 && (
        <>
          <View style={[StyleSheet.absoluteFill, { backgroundColor: tier.wall }]} />
          <View style={{ position: 'absolute', left: 0, right: 0, top: floorLine, bottom: 0, backgroundColor: tier.floor }} />
          <View style={{ position: 'absolute', left: 0, right: 0, top: floorLine, height: 1, backgroundColor: C.borderHi }} />

          <LinearGradient
            pointerEvents="none"
            colors={[`rgba(232,155,124,${tier.glow})`, 'rgba(232,155,124,0)']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 0.7 }}
            style={StyleSheet.absoluteFill}
          />

          {/* Wall decor: structural always shows; placeable obeys placement. */}
          {WALL_ITEMS.map((it) => {
            const visual = it.structural ? 'solid' : propVisual(it.id, unlock >= it.elo);
            if (!visual) return null;
            const s = spriteSize(it.sprite);
            const left = it.x * w - (s.w * px) / 2;
            const top = it.top * floorLine;
            return (
              <PropNode
                key={it.id}
                id={it.id}
                rows={it.sprite}
                px={px}
                left={left}
                top={top}
                ghost={visual === 'ghost'}
                editable={editable && !it.structural}
                onToggle={onToggleItem}
              />
            );
          })}

          {/* Floor props + character, drawn back-to-front by depth. */}
          {buildFloorNodes(unlock, tier).map((node) => {
            const isChar = node.isCharacter;
            const rows = isChar ? frames[0] : node.sprite!;
            const s = isChar ? charSize : spriteSize(rows);
            const baseY = floorLine + node.band * (h - floorLine);
            const left = node.x * w - (s.w * px) / 2;
            const top = baseY - s.h * px;

            if (isChar) {
              return (
                <Animated.View key="character" entering={FadeIn.duration(500)} style={[{ position: 'absolute', left, top }, charStyle]}>
                  <View style={{ position: 'absolute', left: s.w * px * 0.12, top: s.h * px - px * 1.5, width: s.w * px * 0.76, height: px * 2.5, borderRadius: px * 2, backgroundColor: 'rgba(0,0,0,0.28)' }} />
                  <AnimatedPixelSprite frames={frames} pixel={px} fps={CURL_FPS} />
                </Animated.View>
              );
            }

            const visual = propVisual(node.id, true); // floor nodes are pre-filtered to unlocked
            if (!visual) return null;
            return (
              <PropNode
                key={node.id}
                id={node.id}
                rows={rows}
                px={px}
                left={left}
                top={top}
                ghost={visual === 'ghost'}
                editable={editable}
                onToggle={onToggleItem}
              />
            );
          })}
        </>
      )}
    </View>
  );
}

function PropNode({
  id, rows, px, left, top, ghost, editable, onToggle,
}: {
  id: string;
  rows: string[];
  px: number;
  left: number;
  top: number;
  ghost: boolean;
  editable: boolean;
  onToggle?: (id: string) => void;
}) {
  const body = (
    <Animated.View entering={FadeIn.duration(380)} style={{ opacity: ghost ? 0.32 : 1 }}>
      <PixelSprite rows={rows} pixel={px} />
      {ghost && (
        <View style={styles.plus}>
          <Text style={styles.plusText}>＋</Text>
        </View>
      )}
    </Animated.View>
  );
  if (!editable) {
    return <View style={{ position: 'absolute', left, top }}>{body}</View>;
  }
  return (
    <Pressable onPress={() => onToggle?.(id)} style={{ position: 'absolute', left, top }}>
      {body}
    </Pressable>
  );
}

type FloorNode = { id: string; sprite?: string[]; x: number; band: number; isCharacter?: boolean };

function buildFloorNodes(elo: number, tier: Tier): FloorNode[] {
  const nodes: FloorNode[] = FLOOR_ITEMS.filter((it) => elo >= it.elo).map((it) => ({
    id: it.id, sprite: it.sprite, x: it.x, band: it.band,
  }));
  nodes.push({ id: 'character', x: 0.5, band: CHARACTER_BAND, isCharacter: true });
  return nodes.sort((a, b) => a.band - b.band);
}

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
  plus: {
    position: 'absolute',
    top: '50%', left: '50%',
    marginLeft: -9, marginTop: -9,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: C.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  plusText: { fontFamily: FONT.bold, fontSize: 12, color: C.primaryFg, lineHeight: 14 },
});

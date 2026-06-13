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
  FLOOR_ITEMS, TIERS, WALL_ITEMS, tierForScene,
} from './manifest';

const WALL_FRAC = 0.6;
const VIRTUAL_COLS = 70;
const CURL_FPS = 2.2;

/** Floor spots for the community roster, in fill order. Slot 0 is the classic
 *  solo position (centre of the floor), so a single character renders exactly
 *  where it always has. The rest are spread around the floor items so a full
 *  squad reads as a busy shared gym rather than a pile of sprites. */
const CHAR_SLOTS: { x: number; band: number }[] = [
  { x: 0.50, band: 0.50 },
  { x: 0.26, band: 0.62 },
  { x: 0.70, band: 0.54 },
  { x: 0.42, band: 0.82 },
  { x: 0.86, band: 0.62 },
  { x: 0.14, band: 0.40 },
  { x: 0.62, band: 0.92 },
  { x: 0.90, band: 0.30 },
];

export function GymScene({
  elo,
  aspect = 1.45,
  editable = false,
  placedItemIds,
  onToggleItem,
  unlockElo,
  characters,
  cols,
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
  /** Community mode: one character per entry (their build follows their own
   *  ELO tier), spread across the floor. Omitted ⇒ the classic single
   *  character driven by `elo`. Capped to the available floor spots. */
  characters?: { id: string; elo: number }[];
  /** Virtual pixel columns (default 70). More columns ⇒ smaller sprites
   *  relative to the room, making the space read as a LARGER gym-used by the
   *  community gym so the whole squad fits comfortably. */
  cols?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const [w, setW] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width);
  const { tier } = tierForScene(elo);
  const unlock = unlockElo ?? elo;

  // Gentle whole-body bob layered under the curl frames. Two phases so a
  // roster of characters doesn't bob in eerie unison.
  const bob = useSharedValue(0);
  useEffect(() => {
    bob.value = withRepeat(withTiming(1, { duration: 1700, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [bob]);
  const charStyle = useAnimatedStyle(() => ({ transform: [{ translateY: bob.value * -1.5 }] }));
  const charStyleAlt = useAnimatedStyle(() => ({ transform: [{ translateY: (1 - bob.value) * -1.5 }] }));

  const h = w / aspect;
  const px = w / (cols ?? VIRTUAL_COLS);
  const floorLine = h * WALL_FRAC;
  const placed = placedItemIds ?? new Set<string>();

  // Decide whether a placeable prop should render, and how.
  const propVisual = (id: string, unlocked: boolean): 'solid' | 'ghost' | null => {
    if (!unlocked) return null;
    if (placed.has(id)) return 'solid';
    return editable ? 'ghost' : null;
  };

  // The cast: either the classic solo character (slot 0, same spot as ever) or
  // the community roster, each with their own tier's build and a slightly
  // staggered animation so the room feels alive.
  const roster: CharNode[] = (characters?.length ? characters : [{ id: 'solo', elo }])
    .slice(0, CHAR_SLOTS.length)
    .map((c, i) => ({
      id: `char-${c.id}`,
      frames: CHARACTER_FRAMES[tierForScene(c.elo).tier.character] ?? CHARACTER_FRAMES.scrawny,
      fps: CURL_FPS + (i % 3) * 0.4,
      alt: i % 2 === 1,
      x: CHAR_SLOTS[i].x,
      band: CHAR_SLOTS[i].band,
    }));

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

          {/* Floor props + characters, drawn back-to-front by depth. */}
          {buildFloorNodes(unlock, roster).map((node) => {
            const rows = node.char ? node.char.frames[0] : node.sprite!;
            const s = spriteSize(rows);
            const baseY = floorLine + node.band * (h - floorLine);
            const left = node.x * w - (s.w * px) / 2;
            const top = baseY - s.h * px;

            if (node.char) {
              return (
                <Animated.View key={node.id} entering={FadeIn.duration(500)} style={[{ position: 'absolute', left, top }, node.char.alt ? charStyleAlt : charStyle]}>
                  <View style={{ position: 'absolute', left: s.w * px * 0.12, top: s.h * px - px * 1.5, width: s.w * px * 0.76, height: px * 2.5, borderRadius: px * 2, backgroundColor: 'rgba(0,0,0,0.28)' }} />
                  <AnimatedPixelSprite frames={node.char.frames} pixel={px} fps={node.char.fps} />
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

/** A character to draw on the floor: its frame set (build = its owner's tier),
 *  a slightly staggered animation, and a floor spot. */
type CharNode = { id: string; frames: string[][]; fps: number; alt: boolean; x: number; band: number };

type FloorNode = { id: string; sprite?: string[]; x: number; band: number; char?: CharNode };

function buildFloorNodes(elo: number, roster: CharNode[]): FloorNode[] {
  const nodes: FloorNode[] = FLOOR_ITEMS.filter((it) => elo >= it.elo).map((it) => ({
    id: it.id, sprite: it.sprite, x: it.x, band: it.band,
  }));
  for (const c of roster) nodes.push({ id: c.id, x: c.x, band: c.band, char: c });
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

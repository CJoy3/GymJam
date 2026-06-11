/** Constants and the shared StyleSheet used across the screen files.
 *
 * The styles here are app-wide layout/design-token styles reused by several
 * screens (cards, rows, avatars, inputs, the footer, etc.). Screen-specific
 * styling lives in the styles object but is kept here as one source of truth so
 * the visual language stays consistent and behaviour is identical to the
 * pre-split monolith. */
import { StyleSheet } from 'react-native';
import { Easing } from 'react-native-reanimated';

import { C, FONT, RADIUS, SPACE } from '../theme/tokens';

export const EASE_OUT = Easing.out(Easing.cubic);
export const pageWrap = { padding: SPACE.xl, paddingTop: 56, paddingBottom: 32 } as const;
export const LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },

  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowGap: { flexDirection: 'row', alignItems: 'center', gap: 10 },

  cardTitle: { fontFamily: FONT.bold, fontSize: 16, color: C.ink, letterSpacing: -0.2 },
  h2: { fontFamily: FONT.bold, fontSize: 22, color: C.ink, letterSpacing: -0.3, lineHeight: 28, marginTop: 4 },
  // Pledge Overview card: "This week" is now the prominent header; "Your pledge" is de-emphasized.
  thisWeekHeader: { fontFamily: FONT.extra, fontSize: 20, color: C.ink, letterSpacing: -0.3, textTransform: 'none' },
  pledgeSubhead: { fontFamily: FONT.regular, fontSize: 14, color: C.mutedFg, letterSpacing: 0, marginTop: 3 },

  eyebrowOnCream: { fontFamily: FONT.bold, fontSize: 11, color: 'rgba(27,23,20,0.55)', letterSpacing: 0.8, textTransform: 'uppercase' },
  subOnCream: { fontFamily: FONT.medium, fontSize: 13, color: 'rgba(27,23,20,0.65)' },
  potValue: { fontFamily: FONT.extra, fontSize: 36, color: C.primaryFg, letterSpacing: -0.8, marginTop: 8 },
  potUnit: { fontFamily: FONT.semibold, fontSize: 16, color: C.primaryFg },
  creamArrow: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(27,23,20,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },

  // Dev clock controls-four small pills (« week, « day, day », week ») that
  // step the simulated "today" so testers can walk pledges through their
  // states without waiting for real time to pass.
  devClockBar: {
    position: 'absolute', top: 52, right: SPACE.xl,
    flexDirection: 'row', gap: 6,
  },
  devClockBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 9, height: 34, borderRadius: RADIUS.pill,
    backgroundColor: C.ink, opacity: 0.9,
  },
  devFabText: { fontFamily: FONT.semibold, fontSize: 12, color: C.primaryFg, letterSpacing: 0.2 },

  iconChip: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  closeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.card, borderWidth: 1, borderColor: C.borderHi, alignItems: 'center', justifyContent: 'center' },
  iconBtn:  { width: 40, height: 40, borderRadius: 20, backgroundColor: C.card, borderWidth: 1, borderColor: C.borderHi, alignItems: 'center', justifyContent: 'center' },

  footer: {
    padding: SPACE.xl, paddingBottom: 32,
    backgroundColor: C.bg, borderTopWidth: 1, borderTopColor: C.border,
  },

  bigCheck: {
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: C.successSoft,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(156,181,143,0.35)',
  },

  divider: { borderTopWidth: 1, borderTopColor: C.border, marginTop: 18, paddingTop: 18 },

  input: {
    height: 48, paddingHorizontal: 14,
    borderRadius: RADIUS.md, backgroundColor: C.bgSoft,
    borderWidth: 1, borderColor: C.borderHi,
    color: C.ink, fontFamily: FONT.semibold, fontSize: 15,
    marginTop: 6,
  },

  tabBar: { flexDirection: 'row', gap: 6, backgroundColor: C.card, borderRadius: RADIUS.pill, padding: 4, borderWidth: 1, borderColor: C.border },
  tab: { flex: 1, paddingVertical: 10, borderRadius: RADIUS.pill, alignItems: 'center' },
  tabOn: { backgroundColor: C.primary },
  tabText: { fontFamily: FONT.semibold, fontSize: 13 },

  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.muted, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: C.ink, fontFamily: FONT.bold, fontSize: 13 },

  inboxBtn: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, height: 36,
    borderRadius: RADIUS.pill,
    backgroundColor: C.accentSoft,
  },
  miniBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  linkBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, height: 32, borderRadius: RADIUS.pill, backgroundColor: C.card, borderWidth: 1, borderColor: C.borderHi },
  linkText: { fontFamily: FONT.semibold, fontSize: 13, color: C.ink },
  jtOpt: { flex: 1, padding: 12, borderRadius: RADIUS.md, borderWidth: 1, borderColor: C.borderHi, backgroundColor: C.bgSoft },
  dot: { color: C.mutedFg, fontSize: 14 },

  megaNumber: { fontFamily: FONT.extra, fontSize: 56, color: C.ink, letterSpacing: -1.4, lineHeight: 64 },
  ruleValue: { fontFamily: FONT.bold, fontSize: 16, color: C.ink, letterSpacing: -0.2 },

  progressTrack: { height: 8, backgroundColor: C.muted, borderRadius: 4, marginTop: 8, overflow: 'hidden' },
  progressFill: { height: 8, backgroundColor: C.accent, borderRadius: 4 },

  ladderRow: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: SPACE.lg },
  ladderIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },

  badgeIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  badgeName: { fontFamily: FONT.semibold, fontSize: 11, color: C.ink, textAlign: 'center', letterSpacing: 0.1 },

  roomGrid: { flexDirection: 'row', flexWrap: 'wrap', aspectRatio: 1, backgroundColor: C.bgSoft, borderRadius: RADIUS.lg, padding: 6 },
  roomCell: { width: '33.33%', aspectRatio: 1, padding: 5 },
  roomTile: { flex: 1, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.border, borderStyle: 'dashed' },

  itemTile: { aspectRatio: 1, backgroundColor: C.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center', gap: 4, padding: 6 },
  itemName: { fontFamily: FONT.medium, fontSize: 11, color: C.inkSoft, textAlign: 'center' },
  lockBadge: { position: 'absolute', top: 8, right: 8, flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: C.muted, borderRadius: RADIUS.pill, paddingHorizontal: 6, paddingVertical: 2 },
  lockText: { fontFamily: FONT.semibold, fontSize: 9, color: C.mutedFg },
  placedBadge: { position: 'absolute', top: 8, right: 8, width: 18, height: 18, backgroundColor: C.success, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
});

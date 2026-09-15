import React, { memo, useEffect, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { Note } from './api';
import { radius, space, type, Theme } from './theme';
import { fmtDate, fmtDur } from './ui';

/**
 * Adapted from a supplied "testimonials-columns-1" (Next.js + Tailwind + framer-motion)
 * component: continuously auto-scrolling vertical columns, content duplicated so the
 * loop is seamless. Rebuilt on reanimated (no `motion`/Tailwind/shadcn here — this is
 * Expo RN, not Next.js) and re-themed to show note history instead of testimonials.
 *
 * This is the ONLY note-history view in Notes.tsx (by explicit user choice — the
 * separate tap-to-expand/delete list was removed in favor of this alone). Note:
 * React Native hit-testing uses a view's laid-out frame, not its `transform`, so
 * these cards are NOT tappable (a continuously translateY-animated view can't also
 * be reliably touch-targeted, since the hit region and the visual position drift
 * apart as it scrolls) — this is a read-only "Sorotan" display, not an interaction
 * surface. Per-note delete/expand is no longer available anywhere in this screen.
 */

const CARD_W = 220;
const COLUMN_H = 220; // fixed, not inherited via flex stretch — see Column's clip note below
const LABEL_H = 26;
const WRAP_H = LABEL_H + COLUMN_H;

function Column({ notes, duration, t }: { notes: Note[]; duration: number; t: Theme }) {
  const [h, setH] = useState(0);
  const y = useSharedValue(0);

  useEffect(() => {
    if (h <= 0) return;
    y.value = 0;
    y.value = withRepeat(withTiming(-h, { duration: duration * 1000, easing: Easing.linear }), -1, false);
  }, [h, duration, y]);

  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  const onLayout = (e: LayoutChangeEvent) => { if (h === 0) setH(e.nativeEvent.layout.height); };

  const renderSet = (keyPrefix: string) => notes.map((n) => (
    <View key={`${keyPrefix}-${n.id}`} style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
      <Text numberOfLines={3} style={{ color: t.fg, fontSize: type.small, lineHeight: 20 }}>{n.summary || n.transcript}</Text>
      <View style={styles.cardFooter}>
        <View style={[styles.avatar, { backgroundColor: t.accentSoft }]}>
          <Ionicons name="mic" size={16} color={t.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ color: t.fg, fontSize: type.tiny, fontWeight: '600' }}>{n.title}</Text>
          <Text style={{ color: t.muted, fontSize: type.tiny }}>{fmtDate(n.created_at)} · {fmtDur(n.duration_ms)}</Text>
        </View>
      </View>
    </View>
  ));

  return (
    // Explicit height (not '100%'/flex-stretch inherited from the row) so overflow:hidden
    // has something concrete to clip against — the earlier overlap bug was this view
    // relying on inherited stretch height, which didn't reliably apply in this nested
    // Animated-View-inside-flex-row context, so content bled past its bounds uncropped.
    <View style={{ width: CARD_W, height: COLUMN_H, overflow: 'hidden' }}>
      <Animated.View style={style}>
        {/* Measured, un-duplicated set — establishes the loop height */}
        <View onLayout={onLayout} style={{ gap: space.sm }}>{renderSet('a')}</View>
        {/* Duplicate set right after — once translateY reaches -h it looks identical to 0, so the loop is seamless */}
        <View style={{ gap: space.sm, marginTop: space.sm }}>{renderSet('b')}</View>
      </Animated.View>
    </View>
  );
}

export const NoteColumns = memo(function NoteColumns({ notes, t }: { notes: Note[]; t: Theme }) {
  const { width } = useWindowDimensions();
  const columnCount = width >= 1024 ? Math.min(3, notes.length) : width >= 768 ? Math.min(2, notes.length) : 1;
  if (notes.length === 0) return null;

  const columns: Note[][] = Array.from({ length: columnCount }, () => []);
  notes.forEach((n, i) => columns[i % columnCount].push(n));
  const durations = [15, 19, 17];

  return (
    <View style={[styles.wrap, { marginTop: space.xs }]}>
      <Text style={{ color: t.faint, fontSize: type.tiny, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6, height: LABEL_H }}>Sorotan</Text>
      <View style={styles.row}>
        {columns.map((col, i) => <Column key={i} notes={col} duration={durations[i % durations.length]} t={t} />)}
      </View>
      <LinearGradient pointerEvents="none" colors={[t.bg, `${t.bg}00`]} style={[styles.fade, { top: LABEL_H }]} />
      <LinearGradient pointerEvents="none" colors={[`${t.bg}00`, t.bg]} style={[styles.fade, { bottom: 0 }]} />
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { height: WRAP_H, position: 'relative' },
  row: { flexDirection: 'row', gap: space.sm, justifyContent: 'center', height: COLUMN_H },
  card: { width: CARD_W, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md, padding: space.md, gap: space.sm },
  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  avatar: { width: 32, height: 32, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  fade: { position: 'absolute', left: 0, right: 0, height: 40 },
});

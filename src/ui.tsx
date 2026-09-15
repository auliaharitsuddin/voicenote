import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, TextInputProps, View, ViewProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Animated, {
  Easing, FadeIn, FadeInDown, LinearTransition, cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withSpring, withTiming,
} from 'react-native-reanimated';
import { radius, space, spring, type, useTheme } from './theme';

export function Screen({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      {/* Ambient mesh wash: fixed, pointer-events-none — never repaints on scroll (perf guardrail) */}
      <LinearGradient
        pointerEvents="none"
        colors={[t.accentSoft, `${t.bg}00`]}
        start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 0.6 }}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View entering={FadeInDown.springify().damping(18).stiffness(200)} style={s.header}>
        <BlurView intensity={40} tint={t.bg === '#141311' ? 'dark' : 'light'} style={[StyleSheet.absoluteFill, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.border }]} />
        <Text accessibilityRole="header" style={{ color: t.fg, fontSize: type.title, fontWeight: '700', letterSpacing: -0.6 }}>{title}</Text>
        {right}
      </Animated.View>
      {children}
    </View>
  );
}

/**
 * Card with cursor-reactive 3D tilt (rotates toward whichever half was pressed) plus
 * lift + spotlight sheen. Interactive cards (`onPress` set — history/list rows) also
 * get a slow, per-item-phased idle float ("mengambang") and animate their own layout
 * changes with a spring (`LinearTransition`) so expand/collapse and list reflow move
 * smoothly instead of snapping — the RN equivalent of a framer-motion `layout` prop.
 */
export function Card({ style, onPress, index = 0, ...p }: ViewProps & { onPress?: () => void; index?: number }) {
  const t = useTheme();
  const pressed = useSharedValue(0);
  const tiltDir = useSharedValue(0); // -1 (pressed left) .. 1 (pressed right)
  const idle = useSharedValue(0);
  useEffect(() => {
    if (!onPress) return;
    idle.value = withRepeat(withTiming(1, { duration: 3200 + (index % 4) * 350, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => cancelAnimation(idle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const aStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 900 },
      { scale: withSpring(1 - pressed.value * 0.025, spring) },
      { translateY: withSpring(pressed.value * 2, spring) + (idle.value - 0.5) * 3 },
      { rotateX: withSpring(`${pressed.value * -2.5}deg`, spring) },
      { rotateY: withSpring(`${pressed.value * tiltDir.value * 3}deg`, spring) },
    ],
  }));
  const sheenStyle = useAnimatedStyle(() => ({ opacity: withTiming(pressed.value * 0.5, { duration: 120 }) }));
  const base = { backgroundColor: t.surface, borderColor: t.border, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md, padding: space.md, overflow: 'hidden' as const };
  const shadow = Platform.OS === 'web'
    ? { boxShadow: `0 8px 24px -12px ${t.shadow}` as unknown as undefined }
    : { shadowColor: t.shadow, shadowOpacity: 1, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 3 };

  if (!onPress) return <Animated.View entering={FadeInDown.delay(index * 45).springify().damping(18).stiffness(200)} {...p} style={[base, shadow, style]} />;

  return (
    // Layout animation lives on this outer wrapper (no transform style of its own);
    // the tilt/press transform lives on the inner view — Reanimated warns if both a
    // `layout` transition and a `transform`-animated style share one component.
    <Animated.View entering={FadeInDown.delay(index * 45).springify().damping(18).stiffness(200)} layout={LinearTransition.springify().damping(18).stiffness(200)}>
      <Animated.View style={aStyle}>
        <Pressable
          onPress={onPress}
          onPressIn={(e) => {
            tiltDir.value = e.nativeEvent.locationX > 140 ? 1 : -1;
            pressed.value = 1;
          }}
          onPressOut={() => { pressed.value = 0; }}
          style={[base, shadow, style] as never}
          {...(p as object)}
        >
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, sheenStyle]}>
            <LinearGradient colors={[`${t.accent}22`, `${t.accent}00`]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          </Animated.View>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

type BtnProps = { label: string; onPress: () => void; kind?: 'primary' | 'accent' | 'ghost' | 'danger'; loading?: boolean; disabled?: boolean; icon?: keyof typeof Ionicons.glyphMap; small?: boolean };
export function Button({ label, onPress, kind = 'accent', loading, disabled, icon, small }: BtnProps) {
  const t = useTheme();
  const bg = { primary: t.primary, accent: t.accent, ghost: 'transparent', danger: t.dangerSoft }[kind];
  const fg = { primary: t.onPrimary, accent: t.onAccent, ghost: t.accent, danger: t.danger }[kind];
  const off = disabled || loading;
  const pressed = useSharedValue(0);
  const aStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 600 },
      { scale: withSpring(1 - pressed.value * 0.05, spring) },
      { rotateX: withSpring(`${pressed.value * 6}deg`, spring) },
    ],
  }));
  return (
    <Animated.View style={aStyle}>
      <Pressable
        accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: off, busy: loading }}
        onPress={onPress} disabled={off} hitSlop={6}
        onPressIn={() => { pressed.value = 1; }} onPressOut={() => { pressed.value = 0; }}
        style={[s.btn, small && { minHeight: 40, paddingHorizontal: space.md }, { backgroundColor: bg, opacity: off ? 0.45 : 1, borderColor: kind === 'ghost' ? t.border : 'transparent', borderWidth: kind === 'ghost' ? 1 : 0 }]}
      >
        {loading ? <ActivityIndicator color={fg} /> : icon ? <Ionicons name={icon} size={18} color={fg} /> : null}
        <Text style={{ color: fg, fontWeight: '600', fontSize: small ? type.small : type.body }}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

export function IconButton({ icon, label, onPress, color }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; color?: string }) {
  const t = useTheme();
  const pressed = useSharedValue(0);
  const [hovered, setHovered] = useState(false);
  const aStyle = useAnimatedStyle(() => ({ transform: [{ scale: withSpring(1 - pressed.value * 0.12, spring) }, { rotate: withSpring(`${pressed.value * -8}deg`, spring) }] }));
  return (
    <View>
      <Animated.View style={aStyle}>
        <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={8}
          onPressIn={() => { pressed.value = 1; }} onPressOut={() => { pressed.value = 0; }}
          onHoverIn={() => setHovered(true)} onHoverOut={() => setHovered(false)}
          style={s.iconBtn}>
          <Ionicons name={icon} size={22} color={color ?? t.muted} />
        </Pressable>
      </Animated.View>
      {/* Hover tooltip — only ever shows on mouse input (onHoverIn never fires on touch), so this is a no-op visual on iOS/Android */}
      {hovered && (
        <Animated.View entering={FadeIn.duration(120)} pointerEvents="none" style={[s.tooltip, { backgroundColor: t.fg }]}>
          <Text style={{ color: t.bg, fontSize: type.tiny, fontWeight: '600' }}>{label}</Text>
        </Animated.View>
      )}
    </View>
  );
}

export function Field({ label, hint, error, onFocus, onBlur, ...p }: TextInputProps & { label: string; hint?: string; error?: string }) {
  const t = useTheme();
  const [focused, setFocused] = useState(false);
  const focus = useSharedValue(0);
  useEffect(() => { focus.value = withTiming(focused ? 1 : 0, { duration: 180, easing: Easing.out(Easing.cubic) }); }, [focused, focus]);
  const aStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + focus.value * 0.01 }],
    borderColor: error ? t.danger : focused ? t.accent : t.border,
    ...(Platform.OS === 'web' ? { boxShadow: `0 0 0 ${focus.value * 3}px ${t.accentSoft}` as unknown as undefined } : {}),
  }));
  return (
    <View style={{ gap: space.xs }}>
      <Text style={{ color: t.fg, fontSize: type.small, fontWeight: '600' }}>{label}</Text>
      <Animated.View style={[s.input, { backgroundColor: t.surface, borderWidth: 1.5 }, aStyle]}>
        <TextInput
          {...p} accessibilityLabel={label} placeholderTextColor={t.faint}
          onFocus={(e) => { setFocused(true); onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); onBlur?.(e); }}
          style={[{ color: t.fg, fontSize: type.body, height: '100%' }, p.style]}
        />
      </Animated.View>
      {error ? <Text accessibilityRole="alert" style={{ color: t.danger, fontSize: type.tiny }}>{error}</Text>
        : hint ? <Text style={{ color: t.muted, fontSize: type.tiny }}>{hint}</Text> : null}
    </View>
  );
}

export function Empty({ icon, title, body }: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string }) {
  const t = useTheme();
  const float = useSharedValue(0);
  useEffect(() => {
    const cycle = () => {
      float.value = withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.sin) }, () => {
        float.value = withTiming(0, { duration: 1400, easing: Easing.inOut(Easing.sin) });
      });
    };
    cycle();
    const id = setInterval(cycle, 2800);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const aStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 500 }, { translateY: -float.value * 6 }, { rotateY: `${(float.value - 0.5) * 10}deg` }],
  }));
  return (
    <Animated.View entering={FadeIn.duration(400)} style={{ alignItems: 'center', padding: space.xl, gap: space.sm }}>
      <Animated.View style={[{ width: 72, height: 72, borderRadius: radius.full, backgroundColor: t.accentSoft, alignItems: 'center', justifyContent: 'center' }, aStyle]}>
        <Ionicons name={icon} size={32} color={t.accent} />
      </Animated.View>
      <Text style={{ color: t.fg, fontSize: type.h2, fontWeight: '600', textAlign: 'center' }}>{title}</Text>
      <Text style={{ color: t.muted, fontSize: type.small, textAlign: 'center', lineHeight: 21, maxWidth: 320 }}>{body}</Text>
    </Animated.View>
  );
}

export function Banner({ text, kind = 'error' }: { text: string; kind?: 'error' | 'success' | 'info' }) {
  const t = useTheme();
  const bg = { error: t.dangerSoft, success: t.successSoft, info: t.accentSoft }[kind];
  const fg = { error: t.danger, success: t.success, info: t.accent }[kind];
  const icon = { error: 'alert-circle', success: 'checkmark-circle', info: 'information-circle' } as const;
  return (
    <Animated.View entering={FadeInDown.springify().damping(16).stiffness(200)} accessibilityLiveRegion="polite"
      style={{ backgroundColor: bg, borderRadius: radius.sm, padding: space.sm + 4, flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
      <Ionicons name={icon[kind]} size={18} color={fg} />
      <Text style={{ color: fg, fontSize: type.small, flex: 1 }}>{text}</Text>
    </Animated.View>
  );
}

export const fmtDate = (iso: string) => new Date(iso).toLocaleString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
export const fmtDur = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`;

const s = StyleSheet.create({
  header: { paddingHorizontal: space.md, paddingTop: space.md, paddingBottom: space.sm + 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  btn: { minHeight: 48, paddingHorizontal: space.lg, borderRadius: radius.full, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.full },
  input: { minHeight: 48, borderRadius: radius.sm, paddingHorizontal: space.md, justifyContent: 'center' },
  tooltip: { position: 'absolute', top: '100%', right: 0, marginTop: space.xs, paddingHorizontal: space.sm, paddingVertical: 4, borderRadius: radius.sm, zIndex: 20 },
});

import React, { memo, useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming,
} from 'react-native-reanimated';
import { radius, spring, Theme } from './theme';

/**
 * Native (iOS/Android) record button. `ogl`'s WebGL renderer needs a browser
 * <canvas>/DOM context that doesn't exist on native, so this platform gets a
 * reanimated-driven equivalent instead: perpetual breathing rings + idle 3D
 * wobble, both modulated by the live mic `level` (0-1, from expo-audio
 * metering) so it visibly reacts to speech, not just an on/off boolean.
 * Isolated + memoized so its loop never re-renders the parent screen.
 */
export const RecordOrb = memo(function RecordOrb({
  recording, busy, onPress, t, level = 0,
}: { recording: boolean; busy: boolean; onPress: () => void; t: Theme; level?: number }) {
  const ringA = useSharedValue(0);
  const ringB = useSharedValue(0);
  const pressed = useSharedValue(0);
  const idleWobble = useSharedValue(0);
  const voice = useSharedValue(0);

  useEffect(() => {
    idleWobble.value = withRepeat(withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => cancelAnimation(idleWobble);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (recording) {
      ringA.value = withRepeat(withTiming(1, { duration: 1100, easing: Easing.out(Easing.quad) }), -1, false);
      ringB.value = withDelay(550, withRepeat(withTiming(1, { duration: 1100, easing: Easing.out(Easing.quad) }), -1, false));
    } else {
      cancelAnimation(ringA); cancelAnimation(ringB);
      ringA.value = withTiming(0, { duration: 200 });
      ringB.value = withTiming(0, { duration: 200 });
    }
  }, [recording, ringA, ringB]);

  useEffect(() => { voice.value = withTiming(level, { duration: 120, easing: Easing.out(Easing.quad) }); }, [level, voice]);

  const ringAStyle = useAnimatedStyle(() => ({ opacity: 0.32 * (1 - ringA.value), transform: [{ scale: 1 + ringA.value * (0.75 + voice.value * 0.5) }] }));
  const ringBStyle = useAnimatedStyle(() => ({ opacity: 0.22 * (1 - ringB.value), transform: [{ scale: 1 + ringB.value * (1.1 + voice.value * 0.6) }] }));
  const orbStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 700 },
      { scale: withSpring((recording ? 1.08 : 1) + voice.value * 0.1 - pressed.value * 0.08, spring) },
      { rotateX: withSpring(`${pressed.value * -10 + (idleWobble.value - 0.5) * 4}deg`, spring) },
      { rotateY: `${(idleWobble.value - 0.5) * 6 + voice.value * 4}deg` },
    ],
  }));

  return (
    <Animated.View style={styles.wrap}>
      <Animated.View pointerEvents="none" style={[styles.ring, ringBStyle, { backgroundColor: t.primary }]} />
      <Animated.View pointerEvents="none" style={[styles.ring, ringAStyle, { backgroundColor: t.primary }]} />
      <Animated.View style={orbStyle}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={recording ? 'Berhenti merekam' : 'Mulai merekam'}
          accessibilityState={{ disabled: busy, busy }}
          disabled={busy}
          onPress={() => {
            pressed.value = withSequence(withTiming(1, { duration: 90 }), withSpring(0, spring));
            onPress();
          }}
          style={{ borderRadius: radius.full, overflow: 'hidden', opacity: busy ? 0.5 : 1 }}
        >
          <LinearGradient
            colors={[`${t.primary}FF`, `${t.primary}CC`]}
            start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }}
            style={styles.btn}
          >
            <Ionicons name={recording ? 'stop' : 'mic'} size={30} color={t.onPrimary} />
          </LinearGradient>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  wrap: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 64, height: 64, borderRadius: radius.full },
  btn: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center' },
});

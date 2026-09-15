import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { loadSettings, Settings } from './src/api';
import { space, spring, type, useTheme } from './src/theme';
import { NotesScreen } from './src/screens/Notes';
import { RemindersScreen } from './src/screens/Reminders';
import { SettingsScreen } from './src/screens/Settings';

type Tab = 'notes' | 'reminders' | 'settings';
const TABS: { key: Tab; label: string; icon: keyof typeof Ionicons.glyphMap; active: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'notes', label: 'Catatan', icon: 'mic-outline', active: 'mic' },
  { key: 'reminders', label: 'Pengingat', icon: 'notifications-outline', active: 'notifications' },
  { key: 'settings', label: 'Pengaturan', icon: 'settings-outline', active: 'settings' },
];

/** Tab icon+label with a spring pop when it becomes active — isolated per-tab so only the switching pair animates. */
function TabItem({ x, on, sidebar, onPress }: { x: (typeof TABS)[number]; on: boolean; sidebar: boolean; onPress: () => void }) {
  const t = useTheme();
  const lift = useSharedValue(on ? 1 : 0);
  useEffect(() => { lift.value = withSpring(on ? 1 : 0, spring); }, [on, lift]);
  const aStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + lift.value * 0.12 }, { translateY: -lift.value * (sidebar ? 0 : 2) }] }));
  return (
    <Pressable accessibilityRole="tab" accessibilityLabel={x.label} accessibilityState={{ selected: on }} onPress={onPress}
      style={({ pressed }) => [s.tab, sidebar && s.tabSide, { opacity: pressed ? 0.6 : 1, backgroundColor: on && sidebar ? t.accentSoft : 'transparent' }]}>
      <Animated.View style={aStyle}>
        <Ionicons name={on ? x.active : x.icon} size={24} color={on ? t.accent : t.muted} />
      </Animated.View>
      <Text style={{ color: on ? t.accent : t.muted, fontSize: sidebar ? type.body : type.tiny, fontWeight: on ? '700' : '500' }}>{x.label}</Text>
    </Pressable>
  );
}

function Root() {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const sidebar = width >= 1024;
  const [settings, setSettings] = useState<Settings | null>(null);
  const [tab, setTab] = useState<Tab>('notes');

  useEffect(() => { loadSettings().then((s) => { setSettings(s); if (!s.token) setTab('settings'); }); }, []);

  if (!settings) return <View style={{ flex: 1, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={t.accent} /></View>;

  const nav = (
    <View accessibilityRole="tablist" style={[sidebar ? s.side : s.bottom, { backgroundColor: t.bg, borderColor: t.border }]}>
      {TABS.map((x) => <TabItem key={x.key} x={x} on={tab === x.key} sidebar={sidebar} onPress={() => setTab(x.key)} />)}
    </View>
  );

  const screen = tab === 'notes' ? <NotesScreen settings={settings} />
    : tab === 'reminders' ? <RemindersScreen settings={settings} />
    : <SettingsScreen settings={settings} onChange={setSettings} />;

  return (
    <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={{ flex: 1, backgroundColor: t.bg, flexDirection: sidebar ? 'row' : 'column' }}>
      {sidebar && nav}
      <Animated.View key={tab} entering={FadeIn.duration(180)} style={{ flex: 1 }}>
        {screen}
      </Animated.View>
      {!sidebar && nav}
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <Root />
    </SafeAreaProvider>
  );
}

const s = StyleSheet.create({
  bottom: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, paddingBottom: Platform.OS === 'web' ? space.xs : 0 },
  side: { width: 220, borderRightWidth: StyleSheet.hairlineWidth, paddingTop: space.lg, paddingHorizontal: space.sm, gap: space.xs },
  tab: { flex: 1, minHeight: 56, alignItems: 'center', justifyContent: 'center', gap: 2, ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}) },
  tabSide: { flex: 0, flexDirection: 'row', justifyContent: 'flex-start', gap: space.sm + 4, paddingHorizontal: space.md, borderRadius: 12, minHeight: 48 },
});

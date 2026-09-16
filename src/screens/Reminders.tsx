import React, { memo, useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Linking, Platform, RefreshControl, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { Easing, ZoomIn, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { api, ApiError, EmailStatus, Event, Settings } from '../api';
import { ensurePermission, scheduleAll } from '../notify';
import { radius, space, type, Theme, useTheme } from '../theme';
import { useLanguage, Dict } from '../i18n';
import { Banner, Button, Card, Empty, IconButton, Screen, fmtDate } from '../ui';

const PLATFORM_ICON: Record<Event['platform'], React.ComponentProps<typeof Ionicons>['name']> = {
  zoom: 'videocam-outline', teams: 'people-outline', gmeet: 'logo-google', other: 'calendar-outline',
};
const platformLabel = (p: Event['platform'], t: Dict) => (p === 'zoom' ? 'Zoom' : p === 'teams' ? 'Teams' : p === 'gmeet' ? 'Google Meet' : t.meetingLabel);

/** Isolated: breathing live-pulse for upcoming meetings, 3D flip-in on mount. */
const PlatformBadge = memo(function PlatformBadge({ icon, live, t }: { icon: React.ComponentProps<typeof Ionicons>['name']; live: boolean; t: Theme }) {
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (live) pulse.value = withRepeat(withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [live, pulse]);
  const dotStyle = useAnimatedStyle(() => ({ opacity: 0.5 + pulse.value * 0.5, transform: [{ scale: 1 + pulse.value * 0.4 }] }));
  return (
    <Animated.View entering={ZoomIn.springify().damping(14).stiffness(180)} style={{ width: 40, height: 40, borderRadius: radius.sm, backgroundColor: t.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={icon} size={20} color={t.accent} />
      {live && <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: -2, right: -2, width: 9, height: 9, borderRadius: 5, backgroundColor: t.primary }, dotStyle]} />}
    </Animated.View>
  );
});

export function RemindersScreen({ settings }: { settings: Settings }) {
  const t = useTheme();
  const { t: tr } = useLanguage();
  const [events, setEvents] = useState<Event[]>([]);
  const [status, setStatus] = useState<EmailStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState<{ text: string; kind: 'error' | 'success' } | null>(null);
  const [notifOk, setNotifOk] = useState<boolean | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setMsg(null);
    try {
      const [ev, st] = await Promise.all([api.events(settings), api.emailStatus(settings)]);
      setEvents(ev); setStatus(st);
      const ok = await ensurePermission();
      setNotifOk(ok);
      if (ok) await scheduleAll(ev, settings.remindMin);
    } catch (e) { setMsg({ text: (e as Error).message, kind: 'error' }); } finally { setLoading(false); }
  }, [settings]);
  useEffect(() => { load(); }, [load]);

  async function sync() {
    setSyncing(true); setMsg(null);
    try {
      const r = await api.emailSync(settings);
      await load();
      setMsg({ kind: 'success', text: r.skipped ? tr.syncRunning : tr.syncResult(r.scanned ?? 0, r.added ?? 0) });
    } catch (e) { setMsg({ text: e instanceof ApiError ? e.message : tr.syncFailed, kind: 'error' }); } finally { setSyncing(false); }
  }

  function remove(id: string) {
    const doIt = async () => {
      const prev = events;
      const next = events.filter((x) => x.id !== id);
      setEvents(next);
      try { await api.deleteEvent(settings, id); await scheduleAll(next, settings.remindMin); } catch (e) { setEvents(prev); setMsg({ text: (e as Error).message, kind: 'error' }); }
    };
    if (Platform.OS === 'web') { if (confirm(tr.deleteReminderConfirmWeb)) doIt(); return; }
    Alert.alert(tr.deleteReminderTitle, undefined, [{ text: tr.cancel, style: 'cancel' }, { text: tr.delete, style: 'destructive', onPress: doIt }]);
  }

  const now = Date.now();

  return (
    <Screen title={tr.remindersTitle} right={<Button small label={tr.syncEmail} icon="refresh" onPress={sync} loading={syncing} disabled={!status?.configured} />}>
      <FlatList
        data={events}
        keyExtractor={(e) => e.id}
        contentContainerStyle={{ padding: space.md, gap: space.sm + 4, paddingBottom: space.xl, maxWidth: 720, width: '100%', alignSelf: 'center' }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={t.muted} />}
        ListHeaderComponent={
          <View style={{ gap: space.sm }}>
            {msg && <Banner text={msg.text} kind={msg.kind} />}
            {status && !status.configured && <Banner text={tr.emailNotConfigured} />}
            {notifOk === false && <Banner text={tr.notifDenied} />}
            {status?.configured && (
              <Text style={{ color: t.muted, fontSize: type.tiny }}>
                {tr.accountLine(status.account ?? '', status.last_sync ? fmtDate(status.last_sync) : tr.never, settings.remindMin)}
              </Text>
            )}
          </View>
        }
        ListEmptyComponent={!loading ? <Empty icon="notifications-outline" title={tr.noMeetingsTitle} body={tr.noMeetingsBody} /> : null}
        renderItem={({ item, index }) => {
          const label = platformLabel(item.platform, tr);
          const icon = PLATFORM_ICON[item.platform];
          const past = new Date(item.starts_at).getTime() < now;
          return (
            <Card index={index} style={{ gap: space.sm, opacity: past ? 0.6 : 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.sm + 4 }}>
                <PlatformBadge icon={icon} live={!past} t={t} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ color: t.fg, fontSize: type.body, fontWeight: '600', lineHeight: 22 }}>{item.title}</Text>
                  <Text style={{ color: past ? t.muted : t.accent, fontSize: type.small, fontWeight: '500', fontVariant: ['tabular-nums'] }}>
                    {fmtDate(item.starts_at)}{past ? tr.ended : ''}
                  </Text>
                  <Text style={{ color: t.muted, fontSize: type.tiny }} numberOfLines={1}>{tr.fromLabel(label, item.email_from)}</Text>
                </View>
                <IconButton icon="trash-outline" label={tr.deleteReminderTitle.replace('?', '')} onPress={() => remove(item.id)} color={t.danger} />
              </View>
              {item.link && <Button small kind="ghost" icon="open-outline" label={tr.openPlatform(label)} onPress={() => Linking.openURL(item.link!)} />}
            </Card>
          );
        }}
      />
    </Screen>
  );
}

import React, { memo, useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Linking, Platform, RefreshControl, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { Easing, ZoomIn, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { api, ApiError, EmailStatus, Event, Settings } from '../api';
import { ensurePermission, scheduleAll } from '../notify';
import { radius, space, type, Theme, useTheme } from '../theme';
import { Banner, Button, Card, Empty, IconButton, Screen, fmtDate } from '../ui';

const PLATFORM: Record<Event['platform'], { label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }> = {
  zoom: { label: 'Zoom', icon: 'videocam-outline' },
  teams: { label: 'Teams', icon: 'people-outline' },
  gmeet: { label: 'Google Meet', icon: 'logo-google' },
  other: { label: 'Meeting', icon: 'calendar-outline' },
};

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
      setMsg({ kind: 'success', text: r.skipped ? 'Sinkronisasi sedang berjalan di server.' : `Dipindai ${r.scanned ?? 0} email, ${r.added ?? 0} meeting baru.` });
    } catch (e) { setMsg({ text: e instanceof ApiError ? e.message : 'Sinkronisasi gagal.', kind: 'error' }); } finally { setSyncing(false); }
  }

  function remove(id: string) {
    const doIt = async () => {
      const prev = events;
      const next = events.filter((x) => x.id !== id);
      setEvents(next);
      try { await api.deleteEvent(settings, id); await scheduleAll(next, settings.remindMin); } catch (e) { setEvents(prev); setMsg({ text: (e as Error).message, kind: 'error' }); }
    };
    if (Platform.OS === 'web') { if (confirm('Hapus pengingat ini?')) doIt(); return; }
    Alert.alert('Hapus pengingat?', undefined, [{ text: 'Batal', style: 'cancel' }, { text: 'Hapus', style: 'destructive', onPress: doIt }]);
  }

  const now = Date.now();

  return (
    <Screen title="Pengingat" right={<Button small label="Sinkron email" icon="refresh" onPress={sync} loading={syncing} disabled={!status?.configured} />}>
      <FlatList
        data={events}
        keyExtractor={(e) => e.id}
        contentContainerStyle={{ padding: space.md, gap: space.sm + 4, paddingBottom: space.xl, maxWidth: 720, width: '100%', alignSelf: 'center' }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={t.muted} />}
        ListHeaderComponent={
          <View style={{ gap: space.sm }}>
            {msg && <Banner text={msg.text} kind={msg.kind} />}
            {status && !status.configured && <Banner text="Email belum dikonfigurasi di server (IMAP_HOST/USER/PASS di server/.env)." />}
            {notifOk === false && <Banner text="Izin notifikasi ditolak — pengingat tidak akan muncul." />}
            {status?.configured && (
              <Text style={{ color: t.muted, fontSize: type.tiny }}>
                Akun {status.account} · sinkron terakhir {status.last_sync ? fmtDate(status.last_sync) : 'belum pernah'} · ingatkan {settings.remindMin} mnt sebelum
              </Text>
            )}
          </View>
        }
        ListEmptyComponent={!loading ? <Empty icon="notifications-outline" title="Belum ada meeting terdeteksi" body="Server membaca inbox secara berkala. Undangan Zoom, Teams, atau Google Meet akan muncul di sini dan menjadi alarm otomatis." /> : null}
        renderItem={({ item, index }) => {
          const p = PLATFORM[item.platform];
          const past = new Date(item.starts_at).getTime() < now;
          return (
            <Card index={index} style={{ gap: space.sm, opacity: past ? 0.6 : 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.sm + 4 }}>
                <PlatformBadge icon={p.icon} live={!past} t={t} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ color: t.fg, fontSize: type.body, fontWeight: '600', lineHeight: 22 }}>{item.title}</Text>
                  <Text style={{ color: past ? t.muted : t.accent, fontSize: type.small, fontWeight: '500', fontVariant: ['tabular-nums'] }}>
                    {fmtDate(item.starts_at)}{past ? ' · selesai' : ''}
                  </Text>
                  <Text style={{ color: t.muted, fontSize: type.tiny }} numberOfLines={1}>{p.label} · dari {item.email_from}</Text>
                </View>
                <IconButton icon="trash-outline" label="Hapus pengingat" onPress={() => remove(item.id)} color={t.danger} />
              </View>
              {item.link && <Button small kind="ghost" icon="open-outline" label={`Buka ${p.label}`} onPress={() => Linking.openURL(item.link!)} />}
            </Card>
          );
        }}
      />
    </Screen>
  );
}

import React, { useCallback, useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import * as Haptics from 'expo-haptics';
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { api, ApiError, Note, Settings } from '../api';
import { DEMO_NOTES } from '../demoNotes';
import { NoteColumns } from '../NoteColumns';
import { NoteHistoryModal } from './NoteHistoryModal';
import { RecordOrb } from '../RecordOrb';
import { radius, space, type, useTheme } from '../theme';
import { Banner, Empty, IconButton, Screen, fmtDur } from '../ui';

const MIME_BY_EXT: Record<string, string> = { webm: 'audio/webm', m4a: 'audio/mp4', mp4: 'audio/mp4', '3gp': 'audio/3gpp', wav: 'audio/wav', mp3: 'audio/mpeg', ogg: 'audio/ogg' };

const haptic = (k: 'light' | 'ok' | 'err') => {
  if (Platform.OS === 'web') return;
  if (k === 'light') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  else Haptics.notificationAsync(k === 'ok' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error);
};

export function NotesScreen({ settings }: { settings: Settings }) {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });
  const rec = useAudioRecorderState(recorder, 120);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const demoMode = !settings.token;

  const load = useCallback(async () => {
    if (demoMode) { setNotes(DEMO_NOTES); return; } // no server configured yet — show sample data, skip the network call entirely
    setLoading(true); setErr(null);
    try { setNotes(await api.notes(settings)); } catch (e) { setErr((e as Error).message); } finally { setLoading(false); }
  }, [settings, demoMode]);
  useEffect(() => { load(); }, [load]);

  async function start() {
    setErr(null);
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) { setErr('Izin mikrofon ditolak. Aktifkan di pengaturan perangkat.'); return; }
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      haptic('light');
    } catch { setErr('Mikrofon tidak tersedia. Di web, buka lewat https:// atau localhost.'); }
  }

  async function stop() {
    haptic('light');
    const durationMs = rec.durationMillis;
    await recorder.stop();
    await setAudioModeAsync({ allowsRecording: false });
    const uri = recorder.uri;
    if (!uri) { setErr('Rekaman tidak tersimpan.'); return; }
    setBusy(true);
    try {
      const blob = await (await fetch(uri)).blob();
      const ext = uri.split('?')[0].split('.').pop()?.toLowerCase() ?? '';
      const mime = (blob.type && blob.type.startsWith('audio/') ? blob.type.split(';')[0] : MIME_BY_EXT[ext]) ?? 'audio/mp4';
      const note = await api.transcribe(settings, blob, mime, durationMs);
      setNotes((n) => [note, ...n]);
      haptic('ok');
    } catch (e) {
      haptic('err');
      setErr(e instanceof ApiError ? e.message : 'Gagal memproses rekaman.');
    } finally { setBusy(false); }
  }

  const recording = rec.isRecording;
  const wide = width >= 768;
  // Normalize metering (dBFS, roughly -50 silence..0 loud) to 0-1 for the orb's voice-reactive visuals.
  const level = recording && typeof rec.metering === 'number' ? Math.min(Math.max((rec.metering + 50) / 50, 0), 1) : 0;

  return (
    <Screen
      title="Catatan Suara"
      right={
        <View style={{ flexDirection: 'row', gap: space.xs }}>
          <IconButton icon="time-outline" label="Buka riwayat catatan" onPress={() => setHistoryOpen(true)} />
          <IconButton icon="refresh" label="Muat ulang catatan" onPress={load} />
        </View>
      }
    >
      <ScrollView contentContainerStyle={{ padding: space.md, gap: space.sm, paddingBottom: 160, maxWidth: 720, width: '100%', alignSelf: 'center' }}>
        {err ? <Banner text={err} /> : demoMode ? <Banner kind="info" text="Contoh tampilan. Hubungkan server di Pengaturan untuk catatan sungguhan." /> : null}
        {notes.length > 0
          ? <NoteColumns notes={notes} t={t} />
          : !loading && <Empty icon="mic-outline" title="Belum ada catatan" body="Tekan tombol rekam, bicara, lalu lepas. Transkrip, ringkasan, dan daftar tindakan dibuat otomatis." />}
      </ScrollView>

      <NoteHistoryModal
        visible={historyOpen}
        onClose={() => setHistoryOpen(false)}
        notes={notes}
        onNotesChange={setNotes}
        settings={settings}
        demoMode={demoMode}
        t={t}
      />

      {/* Record dock */}
      <View pointerEvents="box-none" style={[s.dock, wide && { alignItems: 'flex-end', paddingRight: space.xl }]}>
        <View style={[s.dockInner, { backgroundColor: t.bg, borderColor: t.border }]}>
          <Text accessibilityLiveRegion="polite" style={{ color: recording ? t.primary : t.muted, fontSize: type.small, fontVariant: ['tabular-nums'], minWidth: 120, textAlign: 'center' }}>
            {busy ? 'Memproses…' : recording ? `Merekam ${fmtDur(rec.durationMillis)}` : 'Siap merekam'}
          </Text>
          <RecordOrb recording={recording} busy={busy} onPress={recording ? stop : start} t={t} level={level} />
        </View>
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  dock: { position: 'absolute', left: 0, right: 0, bottom: space.md, alignItems: 'center' },
  dockInner: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm, paddingLeft: space.md, paddingRight: space.sm, borderRadius: radius.full, borderWidth: 1, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
});

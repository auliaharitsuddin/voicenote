import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { api, ApiError, isValidServerUrl, saveSettings, Settings } from '../api';
import { space, type, useTheme } from '../theme';
import { Banner, Button, Card, Field, Screen } from '../ui';

export function SettingsScreen({ settings, onChange }: { settings: Settings; onChange: (s: Settings) => void }) {
  const t = useTheme();
  const [url, setUrl] = useState(settings.serverUrl);
  const [token, setToken] = useState(settings.token);
  const [remind, setRemind] = useState(String(settings.remindMin));
  const [showToken, setShowToken] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; kind: 'error' | 'success' } | null>(null);

  const urlErr = url && !isValidServerUrl(url) ? 'Harus http(s)://host:port tanpa kredensial.' : undefined;
  const remindN = Number(remind);
  const remindErr = !Number.isInteger(remindN) || remindN < 1 || remindN > 1440 ? 'Antara 1 dan 1440 menit.' : undefined;
  const httpWarn = url.startsWith('http://') && !/^http:\/\/(localhost|127\.0\.0\.1|10\.0\.2\.2|192\.168\.|10\.)/.test(url) ? 'HTTP tanpa TLS ke host publik: token bisa disadap. Pakai https://.' : undefined;

  async function save() {
    if (urlErr || remindErr || !token) { setMsg({ kind: 'error', text: 'Periksa kembali isian yang ditandai.' }); return; }
    setBusy(true); setMsg(null);
    const next: Settings = { serverUrl: url.trim().replace(/\/+$/, ''), token: token.trim(), remindMin: remindN };
    try {
      await api.health(next);
      await saveSettings(next);
      onChange(next);
      setMsg({ kind: 'success', text: 'Tersambung & tersimpan.' });
    } catch (e) {
      setMsg({ kind: 'error', text: e instanceof ApiError ? e.message : 'Gagal menyimpan.' });
    } finally { setBusy(false); }
  }

  return (
    <Screen title="Pengaturan">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: space.md, gap: space.md, maxWidth: 560, width: '100%', alignSelf: 'center' }}>
          {msg && <Banner text={msg.text} kind={msg.kind} />}
          <Card style={{ gap: space.md }}>
            <Field label="URL server" value={url} onChangeText={setUrl} autoCapitalize="none" autoCorrect={false} keyboardType="url" textContentType="URL"
              placeholder="http://192.168.1.10:5010" error={urlErr} hint={httpWarn ?? 'Alamat server voicenote (folder server/). Android emulator: 10.0.2.2.'} />
            <Field label="Token akses" value={token} onChangeText={setToken} autoCapitalize="none" autoCorrect={false} secureTextEntry={!showToken} textContentType="password"
              placeholder="APP_TOKEN dari server/.env" hint="Sama dengan APP_TOKEN di server/.env." />
            <Button small kind="ghost" label={showToken ? 'Sembunyikan token' : 'Tampilkan token'} icon={showToken ? 'eye-off-outline' : 'eye-outline'} onPress={() => setShowToken((v) => !v)} />
            <Field label="Ingatkan sebelum meeting (menit)" value={remind} onChangeText={setRemind} keyboardType="number-pad" error={remindErr} hint="Alarm muncul sekian menit sebelum jadwal." />
          </Card>
          <Button label="Uji koneksi & simpan" icon="checkmark" onPress={save} loading={busy} />
          <View style={{ gap: space.xs }}>
            <Text style={{ color: t.faint, fontSize: type.tiny, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6 }}>Privasi</Text>
            <Text style={{ color: t.muted, fontSize: type.tiny, lineHeight: 18 }}>
              Rekaman diterjemahkan oleh LLM dan dikirim ke server. Kredensial email hanya ada di server (.env), tidak pernah di aplikasi ini.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

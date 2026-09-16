import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { api, ApiError, isValidServerUrl, saveSettings, Settings } from '../api';
import { space, type, useTheme } from '../theme';
import { useLanguage } from '../i18n';
import { Banner, Button, Card, Field, Screen } from '../ui';

function LanguageToggle() {
  const t = useTheme();
  const { lang, setLang, t: tr } = useLanguage();
  return (
    <View style={{ flexDirection: 'row', gap: space.xs, alignItems: 'center' }}>
      <Text style={{ color: t.muted, fontSize: type.small, marginRight: space.xs }}>{tr.languageLabel}</Text>
      {(['id', 'en'] as const).map((l) => (
        <Pressable key={l} onPress={() => setLang(l)}
          accessibilityRole="button" accessibilityState={{ selected: lang === l }}
          style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, backgroundColor: lang === l ? t.accent : t.surface, borderWidth: 1, borderColor: t.border }}>
          <Text style={{ color: lang === l ? t.onAccent : t.muted, fontSize: type.small, fontWeight: '700' }}>{l.toUpperCase()}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function SettingsScreen({ settings, onChange }: { settings: Settings; onChange: (s: Settings) => void }) {
  const t = useTheme();
  const { t: tr } = useLanguage();
  const [url, setUrl] = useState(settings.serverUrl);
  const [token, setToken] = useState(settings.token);
  const [remind, setRemind] = useState(String(settings.remindMin));
  const [showToken, setShowToken] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; kind: 'error' | 'success' } | null>(null);

  const urlErr = url && !isValidServerUrl(url) ? tr.urlErr : undefined;
  const remindN = Number(remind);
  const remindErr = !Number.isInteger(remindN) || remindN < 1 || remindN > 1440 ? tr.remindErr : undefined;
  const httpWarn = url.startsWith('http://') && !/^http:\/\/(localhost|127\.0\.0\.1|10\.0\.2\.2|192\.168\.|10\.)/.test(url) ? tr.httpWarn : undefined;

  async function save() {
    if (urlErr || remindErr || !token) { setMsg({ kind: 'error', text: tr.checkFields }); return; }
    setBusy(true); setMsg(null);
    const next: Settings = { serverUrl: url.trim().replace(/\/+$/, ''), token: token.trim(), remindMin: remindN };
    try {
      await api.health(next);
      await saveSettings(next);
      onChange(next);
      setMsg({ kind: 'success', text: tr.connectedSaved });
    } catch (e) {
      setMsg({ kind: 'error', text: e instanceof ApiError ? e.message : tr.saveFailed });
    } finally { setBusy(false); }
  }

  return (
    <Screen title={tr.settingsTitle} right={<LanguageToggle />}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: space.md, gap: space.md, maxWidth: 560, width: '100%', alignSelf: 'center' }}>
          {msg && <Banner text={msg.text} kind={msg.kind} />}
          <Card style={{ gap: space.md }}>
            <Field label={tr.serverUrlLabel} value={url} onChangeText={setUrl} autoCapitalize="none" autoCorrect={false} keyboardType="url" textContentType="URL"
              placeholder="http://192.168.1.10:5010" error={urlErr} hint={httpWarn ?? tr.serverUrlHint} />
            <Field label={tr.tokenLabel} value={token} onChangeText={setToken} autoCapitalize="none" autoCorrect={false} secureTextEntry={!showToken} textContentType="password"
              placeholder={tr.tokenPlaceholder} hint={tr.tokenHint} />
            <Button small kind="ghost" label={showToken ? tr.hideToken : tr.showToken} icon={showToken ? 'eye-off-outline' : 'eye-outline'} onPress={() => setShowToken((v) => !v)} />
            <Field label={tr.remindLabel} value={remind} onChangeText={setRemind} keyboardType="number-pad" error={remindErr} hint={tr.remindHint} />
          </Card>
          <Button label={tr.testAndSave} icon="checkmark" onPress={save} loading={busy} />
          <View style={{ gap: space.xs }}>
            <Text style={{ color: t.faint, fontSize: type.tiny, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6 }}>{tr.privacyHeader}</Text>
            <Text style={{ color: t.muted, fontSize: type.tiny, lineHeight: 18 }}>
              {tr.privacyText}
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

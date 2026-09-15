import React, { useMemo, useState } from 'react';
import { Alert, FlatList, Modal, Platform, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api, ApiError, Note, Settings } from '../api';
import { space, type, useTheme } from '../theme';
import { Banner, Card, Empty, Field, IconButton, fmtDate, fmtDur } from '../ui';

/**
 * Full riwayat (history) browser: search + tap-to-expand transcript + delete.
 * A real (non-animated-loop) list, so — unlike NoteColumns' auto-scrolling
 * "Sorotan" strip — items here are reliably tappable (RN hit-testing follows
 * layout, not `transform`; nothing here is being continuously transformed).
 */
export function NoteHistoryModal({
  visible, onClose, notes, onNotesChange, settings, demoMode, t,
}: {
  visible: boolean;
  onClose: () => void;
  notes: Note[];
  onNotesChange: (notes: Note[]) => void;
  settings: Settings;
  demoMode: boolean;
  t: ReturnType<typeof useTheme>;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter((n) =>
      n.title.toLowerCase().includes(q) || n.summary.toLowerCase().includes(q) || n.transcript.toLowerCase().includes(q));
  }, [notes, query]);

  function remove(id: string) {
    const doIt = async () => {
      const prev = notes;
      onNotesChange(notes.filter((x) => x.id !== id));
      if (demoMode) return; // sample data — nothing to delete server-side
      try { await api.deleteNote(settings, id); } catch (e) { onNotesChange(prev); setErr((e as Error).message); }
    };
    if (Platform.OS === 'web') { if (confirm('Hapus catatan ini?')) doIt(); return; }
    Alert.alert('Hapus catatan?', 'Tindakan ini tidak bisa dibatalkan.', [{ text: 'Batal', style: 'cancel' }, { text: 'Hapus', style: 'destructive', onPress: doIt }]);
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : undefined}>
      <View style={{ flex: 1, backgroundColor: t.bg }}>
        <View style={[styles.header, { borderBottomColor: t.border }]}>
          <Text accessibilityRole="header" style={{ color: t.fg, fontSize: type.title, fontWeight: '700', letterSpacing: -0.6 }}>Riwayat Catatan</Text>
          <IconButton icon="close" label="Tutup riwayat" onPress={onClose} />
        </View>
        <View style={{ paddingHorizontal: space.md, paddingTop: space.md }}>
          <Field
            label="Cari catatan"
            value={query}
            onChangeText={setQuery}
            placeholder="Judul, ringkasan, atau isi transkrip…"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
        </View>
        <FlatList
          data={filtered}
          keyExtractor={(n) => n.id}
          contentContainerStyle={{ padding: space.md, gap: space.sm + 4, paddingBottom: space.xl, maxWidth: 720, width: '100%', alignSelf: 'center' }}
          ListHeaderComponent={err ? <Banner text={err} /> : null}
          ListEmptyComponent={
            <Empty
              icon={query ? 'search-outline' : 'mic-outline'}
              title={query ? 'Tidak ditemukan' : 'Belum ada catatan'}
              body={query ? `Tidak ada catatan yang cocok dengan "${query}".` : 'Rekam catatan pertama Anda untuk melihatnya di sini.'}
            />
          }
          renderItem={({ item, index }) => {
            const expanded = open === item.id;
            return (
              <Card index={index} style={{ gap: space.sm }} onPress={() => setOpen(expanded ? null : item.id)} accessibilityState={{ expanded } as never}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.sm }}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={{ color: t.fg, fontSize: type.body, fontWeight: '600', lineHeight: 22 }}>{item.title}</Text>
                    <Text style={{ color: t.muted, fontSize: type.tiny, fontVariant: ['tabular-nums'] }}>{fmtDate(item.created_at)} · {fmtDur(item.duration_ms)}</Text>
                  </View>
                  <IconButton icon="trash-outline" label="Hapus catatan" onPress={() => remove(item.id)} color={t.danger} />
                </View>
                <Text style={{ color: t.fg, fontSize: type.small, lineHeight: 21 }} numberOfLines={expanded ? undefined : 2}>{item.summary}</Text>
                {item.actions.length > 0 && (
                  <View style={{ gap: space.xs }}>
                    {(expanded ? item.actions : item.actions.slice(0, 2)).map((a, i) => (
                      <View key={i} style={{ flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' }}>
                        <Ionicons name="checkbox-outline" size={16} color={t.accent} style={{ marginTop: 2 }} />
                        <Text style={{ color: t.fg, fontSize: type.small, flex: 1, lineHeight: 20 }}>{a}</Text>
                      </View>
                    ))}
                    {!expanded && item.actions.length > 2 && <Text style={{ color: t.accent, fontSize: type.tiny }}>+{item.actions.length - 2} tindakan lagi</Text>}
                  </View>
                )}
                {expanded && (
                  <View style={{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.border, paddingTop: space.sm, gap: space.xs }}>
                    <Text style={{ color: t.faint, fontSize: type.tiny, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6 }}>Transkrip</Text>
                    <Text selectable style={{ color: t.muted, fontSize: type.small, lineHeight: 21 }}>{item.transcript}</Text>
                  </View>
                )}
              </Card>
            );
          }}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: space.md, paddingTop: space.md, paddingBottom: space.sm + 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth },
});

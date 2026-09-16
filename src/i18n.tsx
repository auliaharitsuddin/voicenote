import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type Lang = 'id' | 'en';
const KEY = 'voicenote.lang';

function dictFor(lang: Lang) {
  const id = {
    tabNotes: 'Catatan', tabReminders: 'Pengingat', tabSettings: 'Pengaturan',

    notesTitle: 'Catatan Suara',
    openHistory: 'Buka riwayat catatan',
    reloadNotes: 'Muat ulang catatan',
    micDenied: 'Izin mikrofon ditolak. Aktifkan di pengaturan perangkat.',
    micUnavailable: 'Mikrofon tidak tersedia. Di web, buka lewat https:// atau localhost.',
    recordingNotSaved: 'Rekaman tidak tersimpan.',
    processFailed: 'Gagal memproses rekaman.',
    demoBanner: 'Contoh tampilan. Hubungkan server di Pengaturan untuk catatan sungguhan.',
    noNotesTitle: 'Belum ada catatan',
    noNotesBody: 'Tekan tombol rekam, bicara, lalu lepas. Transkrip, ringkasan, dan daftar tindakan dibuat otomatis.',
    processing: 'Memproses…',
    recording: (dur: string) => `Merekam ${dur}`,
    readyToRecord: 'Siap merekam',

    remindersTitle: 'Pengingat',
    syncEmail: 'Sinkron email',
    deleteReminderConfirmWeb: 'Hapus pengingat ini?',
    deleteReminderTitle: 'Hapus pengingat?',
    cancel: 'Batal',
    delete: 'Hapus',
    emailNotConfigured: 'Email belum dikonfigurasi di server (IMAP_HOST/USER/PASS di server/.env).',
    notifDenied: 'Izin notifikasi ditolak — pengingat tidak akan muncul.',
    accountLine: (account: string, lastSync: string, min: number) => `Akun ${account} · sinkron terakhir ${lastSync} · ingatkan ${min} mnt sebelum`,
    never: 'belum pernah',
    noMeetingsTitle: 'Belum ada meeting terdeteksi',
    noMeetingsBody: 'Server membaca inbox secara berkala. Undangan Zoom, Teams, atau Google Meet akan muncul di sini dan menjadi alarm otomatis.',
    syncRunning: 'Sinkronisasi sedang berjalan di server.',
    syncResult: (scanned: number, added: number) => `Dipindai ${scanned} email, ${added} meeting baru.`,
    syncFailed: 'Sinkronisasi gagal.',
    ended: ' · selesai',
    fromLabel: (label: string, from: string) => `${label} · dari ${from}`,
    openPlatform: (label: string) => `Buka ${label}`,
    meetingLabel: 'Meeting',

    settingsTitle: 'Pengaturan',
    urlErr: 'Harus http(s)://host:port tanpa kredensial.',
    remindErr: 'Antara 1 dan 1440 menit.',
    httpWarn: 'HTTP tanpa TLS ke host publik: token bisa disadap. Pakai https://.',
    checkFields: 'Periksa kembali isian yang ditandai.',
    connectedSaved: 'Tersambung & tersimpan.',
    saveFailed: 'Gagal menyimpan.',
    serverUrlLabel: 'URL server',
    serverUrlHint: 'Alamat server voicenote (folder server/). Android emulator: 10.0.2.2.',
    tokenLabel: 'Token akses',
    tokenPlaceholder: 'APP_TOKEN dari server/.env',
    tokenHint: 'Sama dengan APP_TOKEN di server/.env.',
    hideToken: 'Sembunyikan token',
    showToken: 'Tampilkan token',
    remindLabel: 'Ingatkan sebelum meeting (menit)',
    remindHint: 'Alarm muncul sekian menit sebelum jadwal.',
    testAndSave: 'Uji koneksi & simpan',
    privacyHeader: 'Privasi',
    privacyText: 'Rekaman diterjemahkan oleh LLM dan dikirim ke server. Kredensial email hanya ada di server (.env), tidak pernah di aplikasi ini.',
    languageLabel: 'Bahasa',

    historyTitle: 'Riwayat Catatan',
    closeHistory: 'Tutup riwayat',
    searchNotes: 'Cari catatan',
    searchPlaceholder: 'Judul, ringkasan, atau isi transkrip…',
    notFoundTitle: 'Tidak ditemukan',
    notFoundBody: (q: string) => `Tidak ada catatan yang cocok dengan "${q}".`,
    noNotesYetBody: 'Rekam catatan pertama Anda untuk melihatnya di sini.',
    deleteNoteConfirmWeb: 'Hapus catatan ini?',
    deleteNoteTitle: 'Hapus catatan?',
    deleteNoteMsg: 'Tindakan ini tidak bisa dibatalkan.',
    deleteNoteLabel: 'Hapus catatan',
    transcriptLabel: 'Transkrip',
    moreActions: (n: number) => `+${n} tindakan lagi`,

    serverUrlInvalid: 'Server URL belum valid. Buka Pengaturan.',
    tokenMissing: 'Token belum diisi. Buka Pengaturan.',
    serverUnreachable: 'Server tidak bisa dihubungi. Cek URL & koneksi.',
    tokenWrong: 'Token salah.',

    notifChannelName: 'Pengingat meeting',
    reminderBody: (label: string, min: number) => `${label} mulai ${min} menit lagi`,
  };

  const en: typeof id = {
    tabNotes: 'Notes', tabReminders: 'Reminders', tabSettings: 'Settings',

    notesTitle: 'Voice Notes',
    openHistory: 'Open note history',
    reloadNotes: 'Reload notes',
    micDenied: 'Microphone permission denied. Enable it in device settings.',
    micUnavailable: 'Microphone unavailable. On web, open via https:// or localhost.',
    recordingNotSaved: 'Recording was not saved.',
    processFailed: 'Failed to process recording.',
    demoBanner: 'Sample view. Connect a server in Settings for real notes.',
    noNotesTitle: 'No notes yet',
    noNotesBody: 'Press the record button, speak, then release. Transcript, summary, and action items are generated automatically.',
    processing: 'Processing…',
    recording: (dur: string) => `Recording ${dur}`,
    readyToRecord: 'Ready to record',

    remindersTitle: 'Reminders',
    syncEmail: 'Sync email',
    deleteReminderConfirmWeb: 'Delete this reminder?',
    deleteReminderTitle: 'Delete reminder?',
    cancel: 'Cancel',
    delete: 'Delete',
    emailNotConfigured: 'Email is not configured on the server (IMAP_HOST/USER/PASS in server/.env).',
    notifDenied: 'Notification permission denied — reminders will not appear.',
    accountLine: (account: string, lastSync: string, min: number) => `Account ${account} · last sync ${lastSync} · remind ${min} min before`,
    never: 'never',
    noMeetingsTitle: 'No meetings detected yet',
    noMeetingsBody: 'The server reads the inbox periodically. Zoom, Teams, or Google Meet invites will show up here and become automatic alarms.',
    syncRunning: 'A sync is already running on the server.',
    syncResult: (scanned: number, added: number) => `Scanned ${scanned} emails, ${added} new meetings.`,
    syncFailed: 'Sync failed.',
    ended: ' · ended',
    fromLabel: (label: string, from: string) => `${label} · from ${from}`,
    openPlatform: (label: string) => `Open ${label}`,
    meetingLabel: 'Meeting',

    settingsTitle: 'Settings',
    urlErr: 'Must be http(s)://host:port without credentials.',
    remindErr: 'Between 1 and 1440 minutes.',
    httpWarn: 'HTTP without TLS to a public host: the token can be intercepted. Use https://.',
    checkFields: 'Please check the fields marked below.',
    connectedSaved: 'Connected & saved.',
    saveFailed: 'Failed to save.',
    serverUrlLabel: 'Server URL',
    serverUrlHint: 'Address of the voicenote server (server/ folder). Android emulator: 10.0.2.2.',
    tokenLabel: 'Access token',
    tokenPlaceholder: 'APP_TOKEN from server/.env',
    tokenHint: 'Same as APP_TOKEN in server/.env.',
    hideToken: 'Hide token',
    showToken: 'Show token',
    remindLabel: 'Remind before meeting (minutes)',
    remindHint: 'The alarm appears this many minutes before the schedule.',
    testAndSave: 'Test connection & save',
    privacyHeader: 'Privacy',
    privacyText: 'Recordings are transcribed by an LLM and sent to the server. Email credentials only ever live on the server (.env), never in this app.',
    languageLabel: 'Language',

    historyTitle: 'Note History',
    closeHistory: 'Close history',
    searchNotes: 'Search notes',
    searchPlaceholder: 'Title, summary, or transcript…',
    notFoundTitle: 'Not found',
    notFoundBody: (q: string) => `No notes match "${q}".`,
    noNotesYetBody: 'Record your first note to see it here.',
    deleteNoteConfirmWeb: 'Delete this note?',
    deleteNoteTitle: 'Delete note?',
    deleteNoteMsg: 'This action cannot be undone.',
    deleteNoteLabel: 'Delete note',
    transcriptLabel: 'Transcript',
    moreActions: (n: number) => `+${n} more actions`,

    serverUrlInvalid: 'Server URL is not valid yet. Open Settings.',
    tokenMissing: 'Token is not filled in. Open Settings.',
    serverUnreachable: 'Cannot reach the server. Check the URL & connection.',
    tokenWrong: 'Wrong token.',

    notifChannelName: 'Meeting reminders',
    reminderBody: (label: string, min: number) => `${label} starts in ${min} minutes`,
  };

  return lang === 'id' ? id : en;
}

export type Dict = ReturnType<typeof dictFor>;

const LanguageContext = createContext<{ lang: Lang; setLang: (l: Lang) => void; t: Dict } | null>(null);

// ponytail: module-level mirror of the current language, so plain (non-React) modules
// like api.ts/notify.ts can read translated strings without threading lang through every call.
let currentLang: Lang = 'id';
export const getT = () => dictFor(currentLang);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('id');
  useEffect(() => { AsyncStorage.getItem(KEY).then((v) => { if (v === 'en' || v === 'id') { setLangState(v); currentLang = v; } }); }, []);
  const setLang = (l: Lang) => { setLangState(l); currentLang = l; AsyncStorage.setItem(KEY, l).catch(() => {}); };
  return <LanguageContext.Provider value={{ lang, setLang, t: dictFor(lang) }}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}

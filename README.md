# VoiceNote

LLM-powered voice notes with automatic meeting alarms pulled from email. One Expo codebase for **web, Android, and iOS**, backed by a small Node server that handles speech-to-text (Groq Whisper), note structuring, and IMAP email reading.

```
voicenote/
  App.tsx, src/        # Expo app (React Native + web)
  server/               # Node 24, stdlib http + node:sqlite; deps: imapflow, mailparser
```

## Run it

```bash
# 1. server
cd server && cp .env.example .env   # fill in APP_TOKEN (>=24 chars), GROQ_API_KEY, IMAP_*
npm i && npm start                  # http://localhost:5010
npm test                            # self-check: auth/CORS/validation/db

# 2. app
npm i
npm run web        # http://localhost:8081
npm run android    # emulator: server URL = http://10.0.2.2:5010
npm run ios
```

In the app, go to **Settings**, enter the server URL and token (matching `APP_TOKEN`), then tap "Test connection & save".

## Features

- **Notes**: tap to record, speak, tap to stop. The server sends the audio to Groq Whisper for transcription, then an LLM turns the transcript into a title, summary, and action items. Audio itself is never stored.
- **Reminders**: the server scans the inbox every `IMAP_POLL_MIN` minutes (or on demand via "Sync email"). An LLM extracts Zoom/Teams/Google Meet meetings from email, and the app schedules a local notification `remindMin` minutes before each one starts (expo-notifications on Android/iOS, the Web Notification API while the tab stays open).
- Gmail: turn on IMAP and create an App password. Outlook and others: use their own IMAP host.
- **Indonesian/English language toggle** (`src/i18n.tsx`), persisted on-device.

## Glossary

- **APP_TOKEN**: shared secret the app sends as a Bearer token on every request to the server.
- **App password**: a per-app password Gmail (and similar providers) issue for IMAP access, separate from your real login password.

## Security notes

| Layer | Behavior |
|---|---|
| Auth | Bearer `APP_TOKEN`, constant-time comparison; only `/health` skips auth |
| CORS | `ALLOWED_ORIGINS` allowlist (defaults to the Expo web dev server); other origins get no CORS headers |
| Input | audio body capped at 25 MB, only known `audio/*` mime types accepted, IDs must be UUIDs, `since` must be a valid date, rate limit of 60 requests/minute/IP, request timeouts |
| LLM | email content is treated as untrusted data (instructions inside an email are ignored); output JSON is strictly validated: dates must fall within a −30…+400 day window, `link` must be https to zoom.us / zoom.com / teams.microsoft.com / teams.live.com / meet.google.com |
| Secrets | the Groq key and email credentials live only in `server/.env` (gitignored); the app never sees them; `/email/status` masks the account address |
| Errors | 5xx responses never leak stack traces or upstream error text; responses set `X-Content-Type-Options`, `Cache-Control: no-store`, `Referrer-Policy` |
| DB | `node:sqlite` with prepared statements; email UIDs are deduplicated |
| Client | server URL is validated (http/https, no embedded credentials); a warning appears for plain http to a public host; the token field is masked; meeting links only open after passing the server's whitelist |

Deliberate limitations: the token is stored in AsyncStorage, fine for a single-user sandboxed app but worth swapping to `expo-secure-store` for multi-user use. The rate limiter is in-memory per IP, so put a reverse proxy in front if this is ever exposed publicly. Web reminders only fire while the tab stays open.

---

## Bahasa Indonesia

Catatan suara berbasis LLM dengan alarm meeting otomatis dari email. Satu codebase Expo untuk **web, Android, dan iOS**, didukung server Node kecil yang menangani speech-to-text (Groq Whisper), penyusunan catatan, dan pembacaan email IMAP.

```
voicenote/
  App.tsx, src/        # aplikasi Expo (React Native + web)
  server/               # Node 24, stdlib http + node:sqlite; deps: imapflow, mailparser
```

## Jalankan

```bash
# 1. server
cd server && cp .env.example .env   # isi APP_TOKEN (>=24 char), GROQ_API_KEY, IMAP_*
npm i && npm start                  # http://localhost:5010
npm test                            # self-check auth/CORS/validasi/db

# 2. aplikasi
npm i
npm run web        # http://localhost:8081
npm run android    # emulator: URL server = http://10.0.2.2:5010
npm run ios
```

Di aplikasi, buka **Pengaturan**, isi URL server dan token (sama dengan `APP_TOKEN`), lalu tekan "Uji koneksi & simpan".

## Fitur

- **Catatan**: tekan rekam, bicara, tekan berhenti. Server mengirim audio ke Groq Whisper untuk transkripsi, lalu LLM mengubah transkrip menjadi judul, ringkasan, dan daftar tindakan. Audio sendiri tidak pernah disimpan.
- **Pengingat**: server memindai inbox tiap `IMAP_POLL_MIN` menit (atau lewat tombol "Sinkron email"). LLM mengekstrak meeting Zoom/Teams/Google Meet dari email, lalu aplikasi menjadwalkan notifikasi lokal `remindMin` menit sebelum jadwal mulai (expo-notifications di Android/iOS, Web Notification API selama tab masih terbuka).
- Gmail: aktifkan IMAP dan buat App password. Outlook dan lainnya: pakai host IMAP masing-masing.
- **Toggle bahasa Indonesia/Inggris** (`src/i18n.tsx`), tersimpan di perangkat.

## Istilah

- **APP_TOKEN**: rahasia bersama yang dikirim aplikasi sebagai Bearer token di tiap permintaan ke server.
- **App password**: kata sandi khusus per aplikasi yang diterbitkan Gmail (dan sejenisnya) untuk akses IMAP, terpisah dari kata sandi login asli.

## Catatan keamanan

| Lapisan | Perilaku |
|---|---|
| Auth | Bearer `APP_TOKEN`, perbandingan constant-time; hanya `/health` yang tanpa auth |
| CORS | allowlist `ALLOWED_ORIGINS` (default server dev Expo web); origin lain tidak mendapat header CORS |
| Input | body audio dibatasi 25 MB, hanya mime type `audio/*` yang dikenal, ID harus UUID, `since` harus tanggal valid, rate limit 60 permintaan/menit/IP, timeout permintaan |
| LLM | isi email diperlakukan sebagai data tak terpercaya (instruksi di dalam email diabaikan); output JSON divalidasi ketat: tanggal harus dalam jendela −30…+400 hari, `link` harus https ke zoom.us / zoom.com / teams.microsoft.com / teams.live.com / meet.google.com |
| Rahasia | kunci Groq dan kredensial email hanya ada di `server/.env` (di-gitignore); aplikasi tidak pernah melihatnya; `/email/status` menyamarkan alamat akun |
| Error | respons 5xx tidak pernah membocorkan stack trace atau pesan upstream; respons menyertakan `X-Content-Type-Options`, `Cache-Control: no-store`, `Referrer-Policy` |
| DB | `node:sqlite` dengan prepared statements; UID email di-dedup |
| Klien | URL server divalidasi (http/https, tanpa kredensial tertanam); muncul peringatan untuk http biasa ke host publik; kolom token disembunyikan; link meeting hanya terbuka setelah lolos whitelist server |

Batasan yang disengaja: token disimpan di AsyncStorage, cukup untuk aplikasi sandboxed satu pengguna tapi sebaiknya diganti ke `expo-secure-store` untuk penggunaan multi-user. Rate limiter berjalan in-memory per IP, jadi pasang reverse proxy bila server ini dipublikasikan. Pengingat di web hanya aktif selama tab masih terbuka.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export type Settings = { serverUrl: string; token: string; remindMin: number };
const KEY = 'voicenote.settings';
const defaults: Settings = { serverUrl: Platform.OS === 'android' ? 'http://10.0.2.2:5010' : 'http://localhost:5010', token: '', remindMin: 10 };

export async function loadSettings(): Promise<Settings> {
  try { return { ...defaults, ...JSON.parse((await AsyncStorage.getItem(KEY)) ?? '{}') }; } catch { return defaults; }
}
export async function saveSettings(s: Settings) {
  // ponytail: token in AsyncStorage (device-local, app-sandboxed). Use expo-secure-store if the token ever guards more than one user's data.
  await AsyncStorage.setItem(KEY, JSON.stringify(s));
}

export type Note = { id: string; created_at: string; duration_ms: number; transcript: string; title: string; summary: string; actions: string[] };
export type Event = { id: string; created_at: string; title: string; starts_at: string; ends_at: string | null; platform: 'zoom' | 'teams' | 'gmeet' | 'other'; link: string | null; email_subject: string; email_from: string };
export type EmailStatus = { configured: boolean; account: string | null; last_sync: string | null };

export class ApiError extends Error { constructor(public status: number, msg: string) { super(msg); } }

export function isValidServerUrl(u: string) {
  try { const x = new URL(u); return (x.protocol === 'https:' || x.protocol === 'http:') && !x.username && !x.password; } catch { return false; }
}

async function call<T>(s: Settings, path: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<T> {
  if (!isValidServerUrl(s.serverUrl)) throw new ApiError(0, 'Server URL belum valid. Buka Pengaturan.');
  if (!s.token) throw new ApiError(0, 'Token belum diisi. Buka Pengaturan.');
  const res = await fetch(s.serverUrl.replace(/\/+$/, '') + path, {
    ...init,
    headers: { ...(init.headers ?? {}), Authorization: `Bearer ${s.token}` },
    signal: AbortSignal.timeout(init.timeoutMs ?? 20_000),
  }).catch(() => { throw new ApiError(0, 'Server tidak bisa dihubungi. Cek URL & koneksi.'); });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, res.status === 401 ? 'Token salah.' : body.error ?? `HTTP ${res.status}`);
  return body as T;
}

export const api = {
  notes: (s: Settings) => call<Note[]>(s, '/notes'),
  deleteNote: (s: Settings, id: string) => call(s, `/notes/${id}`, { method: 'DELETE' }),
  transcribe: (s: Settings, blob: Blob, mime: string, durationMs: number) =>
    call<Note>(s, `/notes/transcribe?duration_ms=${Math.round(durationMs)}`, { method: 'POST', headers: { 'Content-Type': mime }, body: blob, timeoutMs: 120_000 }),
  events: (s: Settings) => call<Event[]>(s, '/events'),
  deleteEvent: (s: Settings, id: string) => call(s, `/events/${id}`, { method: 'DELETE' }),
  emailStatus: (s: Settings) => call<EmailStatus>(s, '/email/status'),
  emailSync: (s: Settings) => call<{ scanned?: number; added?: number; skipped?: boolean }>(s, '/email/sync', { method: 'POST', timeoutMs: 120_000 }),
  health: (s: Settings) => call<{ ok: boolean }>(s, '/notes').then(() => true),
};

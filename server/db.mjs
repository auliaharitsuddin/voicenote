import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

export const db = new DatabaseSync(process.env.DB_PATH ?? fileURLToPath(new URL('./voicenote.db', import.meta.url)));

db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    duration_ms INTEGER NOT NULL DEFAULT 0,
    transcript TEXT NOT NULL,
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    actions TEXT NOT NULL DEFAULT '[]'
  );
  CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    title TEXT NOT NULL,
    starts_at TEXT NOT NULL,
    ends_at TEXT,
    platform TEXT NOT NULL,
    link TEXT,
    email_uid TEXT NOT NULL UNIQUE,
    email_subject TEXT NOT NULL,
    email_from TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS seen_mail (uid TEXT PRIMARY KEY, seen_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
`);

const q = {
  insertNote: db.prepare('INSERT INTO notes (id, created_at, duration_ms, transcript, title, summary, actions) VALUES (?, ?, ?, ?, ?, ?, ?)'),
  listNotes: db.prepare('SELECT * FROM notes ORDER BY created_at DESC LIMIT 200'),
  deleteNote: db.prepare('DELETE FROM notes WHERE id = ?'),
  insertEvent: db.prepare('INSERT OR IGNORE INTO events (id, created_at, title, starts_at, ends_at, platform, link, email_uid, email_subject, email_from) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'),
  listEvents: db.prepare('SELECT * FROM events WHERE starts_at >= ? ORDER BY starts_at ASC LIMIT 200'),
  deleteEvent: db.prepare('DELETE FROM events WHERE id = ?'),
  isSeen: db.prepare('SELECT 1 FROM seen_mail WHERE uid = ?'),
  markSeen: db.prepare('INSERT OR IGNORE INTO seen_mail (uid, seen_at) VALUES (?, ?)'),
  getMeta: db.prepare('SELECT value FROM meta WHERE key = ?'),
  setMeta: db.prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'),
};

const now = () => new Date().toISOString();

export const notes = {
  insert: (n) => q.insertNote.run(n.id, now(), n.duration_ms, n.transcript, n.title, n.summary, JSON.stringify(n.actions)),
  list: () => q.listNotes.all().map((r) => ({ ...r, actions: JSON.parse(r.actions) })),
  delete: (id) => q.deleteNote.run(id).changes > 0,
};

export const events = {
  insert: (e) => q.insertEvent.run(e.id, now(), e.title, e.starts_at, e.ends_at, e.platform, e.link, e.email_uid, e.email_subject, e.email_from).changes > 0,
  // default: events from 1 day ago onward (so a just-finished meeting still shows)
  list: (since = new Date(Date.now() - 864e5).toISOString()) => q.listEvents.all(since),
  delete: (id) => q.deleteEvent.run(id).changes > 0,
};

export const mail = {
  isSeen: (uid) => !!q.isSeen.get(uid),
  markSeen: (uid) => q.markSeen.run(uid, now()),
};

export const meta = {
  get: (k) => q.getMeta.get(k)?.value ?? null,
  set: (k, v) => q.setMeta.run(k, String(v)),
};

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

process.env.DB_PATH = ':memory:';
const { safeLink } = await import('./llm.mjs');
const { notes, events } = await import('./db.mjs');

test('safeLink only allows https meeting hosts', () => {
  assert.equal(safeLink('https://us02web.zoom.us/j/123'), 'https://us02web.zoom.us/j/123');
  assert.equal(safeLink('https://meet.google.com/abc-defg-hij'), 'https://meet.google.com/abc-defg-hij');
  assert.equal(safeLink('https://teams.microsoft.com/l/meetup-join/x'), 'https://teams.microsoft.com/l/meetup-join/x');
  assert.equal(safeLink('http://zoom.us/j/1'), null);
  assert.equal(safeLink('https://evil.com/zoom.us'), null);
  assert.equal(safeLink('https://zoom.us.evil.com/j/1'), null);
  assert.equal(safeLink('javascript:alert(1)'), null);
  assert.equal(safeLink(42), null);
});

test('db: notes + events round trip, duplicate mail uid ignored', () => {
  notes.insert({ id: 'n1', duration_ms: 10, transcript: 't', title: 'T', summary: 'S', actions: ['a'] });
  assert.deepEqual(notes.list()[0].actions, ['a']);
  assert.equal(notes.delete('n1'), true);
  assert.equal(notes.delete('n1'), false);
  const ev = { id: 'e1', title: 'M', starts_at: new Date(Date.now() + 3600e3).toISOString(), ends_at: null, platform: 'zoom', link: null, email_uid: 'u:1', email_subject: 's', email_from: 'f' };
  assert.equal(events.insert(ev), true);
  assert.equal(events.insert({ ...ev, id: 'e2' }), false);
  assert.equal(events.list().length, 1);
});

test('http: auth, cors, validation', async () => {
  const token = 'x'.repeat(32);
  const child = spawn(process.execPath, ['index.mjs'], {
    cwd: new URL('.', import.meta.url),
    env: { ...process.env, APP_TOKEN: token, PORT: '5099', DB_PATH: ':memory:', ALLOWED_ORIGINS: 'http://ok.test', IMAP_HOST: '', GROQ_API_KEY: '' },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  await once(child.stdout, 'data');
  const base = 'http://localhost:5099';
  try {
    assert.equal((await fetch(`${base}/health`)).status, 200);
    assert.equal((await fetch(`${base}/notes`)).status, 401);
    assert.equal((await fetch(`${base}/notes`, { headers: { Authorization: 'Bearer nope' } })).status, 401);
    const ok = await fetch(`${base}/notes`, { headers: { Authorization: `Bearer ${token}`, Origin: 'http://ok.test' } });
    assert.equal(ok.status, 200);
    assert.equal(ok.headers.get('access-control-allow-origin'), 'http://ok.test');
    const bad = await fetch(`${base}/notes`, { headers: { Authorization: `Bearer ${token}`, Origin: 'http://evil.test' } });
    assert.equal(bad.headers.get('access-control-allow-origin'), null);
    const r415 = await fetch(`${base}/notes/transcribe`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'text/plain' }, body: 'x' });
    assert.equal(r415.status, 415);
    const r503 = await fetch(`${base}/notes/transcribe`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'audio/webm' }, body: Buffer.alloc(2000) });
    assert.equal(r503.status, 503); // no GROQ key configured
    assert.equal((await fetch(`${base}/notes/not-a-uuid`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })).status, 404);
    assert.equal((await fetch(`${base}/email/sync`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } })).status, 503);
  } finally { child.kill(); }
});

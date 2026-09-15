import http from 'node:http';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { notes, events, meta } from './db.mjs';
import { transcribe, structureNote } from './llm.mjs';
import { syncMail, startPolling, configured as mailConfigured } from './mail.mjs';

const PORT = Number(process.env.PORT ?? 5010);
const TOKEN = process.env.APP_TOKEN;
if (!TOKEN || TOKEN.length < 24) {
  console.error('APP_TOKEN missing or shorter than 24 chars. Generate one: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64url\'))"');
  process.exit(1);
}
const ORIGINS = new Set((process.env.ALLOWED_ORIGINS ?? 'http://localhost:8081').split(',').map((s) => s.trim()).filter(Boolean));
const MAX_AUDIO = 25 * 1024 * 1024; // Groq's own upload cap
const AUDIO_TYPES = /^audio\/(webm|mp4|x-m4a|mpeg|wav|ogg|3gpp|aac)(;|$)/i;

// ponytail: in-memory per-IP limiter, fine for a single-user server; swap for a proxy limiter if exposed publicly
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length > 60;
}
setInterval(() => { const c = Date.now() - 60_000; for (const [k, v] of hits) if (!v.some((t) => t > c)) hits.delete(k); }, 300_000).unref();

function authed(req) {
  const h = req.headers.authorization ?? '';
  const given = Buffer.from(h.startsWith('Bearer ') ? h.slice(7) : '');
  const want = Buffer.from(TOKEN);
  return given.length === want.length && timingSafeEqual(given, want);
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(Object.assign(new Error('Payload too large'), { status: 413 })); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

const ID = /^[0-9a-f-]{36}$/;

async function route(req, url) {
  const p = url.pathname, m = req.method;
  if (m === 'GET' && p === '/health') return { ok: true };

  if (!authed(req)) throw Object.assign(new Error('Unauthorized'), { status: 401 });

  if (m === 'GET' && p === '/notes') return notes.list();
  if (m === 'POST' && p === '/notes/transcribe') {
    const mime = (req.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase();
    if (!AUDIO_TYPES.test(mime)) throw Object.assign(new Error('Unsupported audio type'), { status: 415 });
    const bytes = await readBody(req, MAX_AUDIO);
    if (bytes.length < 1000) throw Object.assign(new Error('Audio too short'), { status: 400 });
    const transcript = await transcribe(bytes, mime);
    if (!transcript) throw Object.assign(new Error('No speech detected'), { status: 422 });
    const structured = await structureNote(transcript);
    const duration_ms = Math.min(Math.max(0, Number(url.searchParams.get('duration_ms')) || 0), 3_600_000);
    const note = { id: randomUUID(), created_at: new Date().toISOString(), duration_ms, transcript, ...structured };
    notes.insert(note);
    return note;
  }
  let mm;
  if (m === 'DELETE' && (mm = p.match(/^\/notes\/([^/]+)$/)) && ID.test(mm[1])) {
    if (!notes.delete(mm[1])) throw Object.assign(new Error('Not found'), { status: 404 });
    return { ok: true };
  }

  if (m === 'GET' && p === '/events') {
    const since = url.searchParams.get('since');
    const d = since ? new Date(since) : null;
    return events.list(d && !Number.isNaN(d.getTime()) ? d.toISOString() : undefined);
  }
  if (m === 'DELETE' && (mm = p.match(/^\/events\/([^/]+)$/)) && ID.test(mm[1])) {
    if (!events.delete(mm[1])) throw Object.assign(new Error('Not found'), { status: 404 });
    return { ok: true };
  }

  if (m === 'GET' && p === '/email/status') return { configured: mailConfigured(), account: mailConfigured() ? process.env.IMAP_USER.replace(/^(..).*(@.*)$/, '$1***$2') : null, last_sync: meta.get('last_sync') };
  if (m === 'POST' && p === '/email/sync') return syncMail();

  throw Object.assign(new Error('Not found'), { status: 404 });
}

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin;
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-store',
    'Referrer-Policy': 'no-referrer',
  };
  if (origin && ORIGINS.has(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Vary'] = 'Origin';
    headers['Access-Control-Allow-Headers'] = 'Authorization, Content-Type';
    headers['Access-Control-Allow-Methods'] = 'GET, POST, DELETE, OPTIONS';
    headers['Access-Control-Max-Age'] = '600';
  }
  if (req.method === 'OPTIONS') { res.writeHead(204, headers); res.end(); return; }

  const ip = req.socket.remoteAddress ?? '?';
  if (rateLimited(ip)) { res.writeHead(429, headers); res.end('{"error":"Too many requests"}'); return; }

  try {
    const url = new URL(req.url, 'http://x');
    const body = await route(req, url);
    res.writeHead(200, headers);
    res.end(JSON.stringify(body));
  } catch (e) {
    const status = e.status ?? 500;
    if (status >= 500 && status !== 503) console.error(e);
    res.writeHead(status, headers);
    // never leak stack traces / upstream details for 5xx
    res.end(JSON.stringify({ error: status === 503 || status < 500 ? e.message : status === 502 ? 'AI provider error' : 'Internal error' }));
  }
});
server.requestTimeout = 120_000;
server.headersTimeout = 30_000;
server.listen(PORT, () => {
  console.log(`voicenote server on http://localhost:${PORT} | groq: ${!!process.env.GROQ_API_KEY} | imap: ${mailConfigured()} | origins: ${[...ORIGINS].join(', ')}`);
  startPolling();
});

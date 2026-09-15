import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { randomUUID } from 'node:crypto';
import { events, mail, meta } from './db.mjs';
import { extractEvent } from './llm.mjs';

// Cheap pre-filter so we only pay an LLM call for emails that could plausibly be a meeting invite.
const HINT = /zoom\.us|zoom\.com|teams\.microsoft|teams\.live|meet\.google|\binvit|\bundangan|\bmeeting|\brapat|\bwebinar|\bcalendar|text\/calendar/i;

export const configured = () => !!(process.env.IMAP_HOST && process.env.IMAP_USER && process.env.IMAP_PASS);

let running = false;

export async function syncMail() {
  if (!configured()) throw Object.assign(new Error('IMAP not configured'), { status: 503 });
  if (running) return { skipped: true };
  running = true;
  const client = new ImapFlow({
    host: process.env.IMAP_HOST,
    port: Number(process.env.IMAP_PORT ?? 993),
    secure: true, // TLS only; app passwords never travel in the clear
    auth: { user: process.env.IMAP_USER, pass: process.env.IMAP_PASS },
    logger: false,
  });
  let scanned = 0, added = 0;
  try {
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');
    try {
      const since = new Date(Date.now() - Number(process.env.IMAP_LOOKBACK_DAYS ?? 3) * 864e5);
      const uids = await client.search({ since }, { uid: true });
      for (const uid of (uids || []).slice(-100)) {
        const key = `${process.env.IMAP_USER}:${uid}`;
        if (mail.isSeen(key)) continue;
        scanned++;
        const msg = await client.fetchOne(uid, { source: true }, { uid: true });
        mail.markSeen(key);
        if (!msg?.source) continue;
        const parsed = await simpleParser(msg.source);
        const ics = parsed.attachments?.find((a) => /calendar/i.test(a.contentType))?.content?.toString('utf8') ?? '';
        const body = [parsed.text ?? '', ics].join('\n');
        const head = `From: ${parsed.from?.text ?? ''}\nSubject: ${parsed.subject ?? ''}\nDate: ${parsed.date?.toISOString?.() ?? ''}\n\n`;
        if (!HINT.test(parsed.subject + body)) continue;
        const ev = await extractEvent(head + body).catch(() => null);
        if (!ev) continue;
        if (events.insert({
          id: randomUUID(), ...ev, email_uid: key,
          email_subject: (parsed.subject ?? '').slice(0, 300),
          email_from: (parsed.from?.text ?? '').slice(0, 300),
        })) added++;
      }
    } finally { lock.release(); }
    await client.logout();
  } finally {
    running = false;
    meta.set('last_sync', new Date().toISOString());
  }
  return { scanned, added };
}

export function startPolling() {
  if (!configured()) return;
  const every = Math.max(1, Number(process.env.IMAP_POLL_MIN ?? 5)) * 60_000;
  const tick = () => syncMail().catch((e) => console.error('mail sync failed:', e.message));
  tick();
  setInterval(tick, every).unref();
}

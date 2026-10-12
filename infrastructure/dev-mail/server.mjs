// TwiPay development mail inbox. LOCAL DEVELOPMENT ONLY - it accepts any API key and never delivers mail.
//
// It implements the one endpoint the TwiPay Resend adapter uses (POST /emails) so verification codes and
// other notifications can be read in a browser instead of sent. Point the API and worker at it with
//   RESEND_BASE_URL=http://devmail:8025   RESEND_API_KEY=<any non-empty value>   RESEND_FROM=<any address>
//
//   GET  /                     inbox page
//   GET  /widget.js            floating inbox button + panel; load it from any page (see widget.js)
//   GET  /api/messages         JSON list (newest first)
//   DELETE /api/messages       clear the inbox
//   GET  /messages/:id/html    HTML body, served with a sandboxing CSP for use in an <iframe sandbox>
//   POST /emails               Resend-compatible send endpoint (Bearer token required but not checked)
//
// Mail contains verification codes: never expose this service to the public internet.
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const log = (line) => process.stdout.write(`${line}\n`);
const logError = (line) => process.stderr.write(`${line}\n`);
const WIDGET_JS = readFileSync(fileURLToPath(new URL('./widget.js', import.meta.url)), 'utf8');
const PORT = Number(process.env.PORT ?? 8025);
const DATA_FILE = process.env.DEVMAIL_DATA_FILE ?? '/data/messages.json';
const MAX_MESSAGES = 200;
const MAX_BODY_BYTES = 512 * 1024;

/** @type {Array<{id:string,idempotencyKey:string|null,receivedAt:string,from:string,to:string[],subject:string,text:string,html:string|null}>} */
let messages = [];
try { messages = JSON.parse(readFileSync(DATA_FILE, 'utf8')); } catch { /* first start */ }
if (!Array.isArray(messages)) messages = [];

function persist() {
  try {
    mkdirSync(dirname(DATA_FILE), { recursive: true });
    writeFileSync(`${DATA_FILE}.tmp`, JSON.stringify(messages));
    renameSync(`${DATA_FILE}.tmp`, DATA_FILE);
  } catch (error) { logError(`persist failed: ${error.message}`); }
}

const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>TwiPay dev inbox</title><style>
body{font:15px/1.5 system-ui,sans-serif;margin:0;background:#f6f7f9;color:#14181f}
header{display:flex;gap:12px;align-items:center;padding:14px 20px;background:#14181f;color:#fff}
header h1{font-size:16px;margin:0;flex:1}header small{opacity:.7}
button{font:inherit;padding:6px 12px;border-radius:6px;border:0;background:#fff;cursor:pointer}
main{max-width:860px;margin:0 auto;padding:20px}
.empty{color:#667085;text-align:center;padding:60px 0}
article{background:#fff;border:1px solid #e4e7ec;border-radius:10px;padding:14px 16px;margin-bottom:12px}
.meta{color:#667085;font-size:13px}.subject{font-weight:600;margin:2px 0 8px}
.code{display:inline-block;font:700 22px ui-monospace,monospace;letter-spacing:.15em;background:#eef4ff;border-radius:6px;padding:2px 10px;margin-bottom:8px}
pre{white-space:pre-wrap;word-break:break-word;margin:0;font:inherit}
iframe{width:100%;height:240px;border:1px solid #e4e7ec;border-radius:6px;margin-top:8px}
</style></head><body><header><h1>TwiPay dev inbox <small>local only, nothing is delivered</small></h1><button id="clear">Clear</button></header>
<main id="list"></main><script src="/app.js"></script></body></html>`;

const APP_JS = `
const list = document.getElementById('list');
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
let last = '';
async function refresh() {
  let data;
  try { data = await (await fetch('/api/messages', { cache: 'no-store' })).json(); } catch { return; }
  const key = data.map((m) => m.id).join(',');
  if (key === last) return; last = key;
  list.replaceChildren();
  if (!data.length) { list.append(el('div', 'empty', 'No messages yet.')); return; }
  for (const m of data) {
    const card = el('article');
    card.append(el('div', 'meta', new Date(m.receivedAt).toLocaleString() + '  ·  to ' + m.to.join(', ') + '  ·  from ' + m.from));
    card.append(el('div', 'subject', m.subject));
    const code = (m.text.match(/\\b\\d{6}\\b/) || [])[0];
    if (code) card.append(el('div', 'code', code));
    card.append(el('pre', '', m.text));
    if (m.html) { const f = el('iframe'); f.setAttribute('sandbox', ''); f.src = '/messages/' + encodeURIComponent(m.id) + '/html'; card.append(f); }
    list.append(card);
  }
}
document.getElementById('clear').onclick = async () => { await fetch('/api/messages', { method: 'DELETE' }); last = ''; refresh(); };
refresh(); setInterval(refresh, 2000);
`;

const baseHeaders = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Cache-Control': 'no-store' };
function send(res, status, body, type, extra = {}) {
  res.writeHead(status, { ...baseHeaders, 'Content-Type': type, ...extra });
  res.end(body);
}
const json = (res, status, value) => send(res, status, JSON.stringify(value), 'application/json');

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    req.on('data', (chunk) => { size += chunk.length; if (size > MAX_BODY_BYTES) { reject(Object.assign(new Error('too large'), { status: 413 })); req.destroy(); } else chunks.push(chunk); });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const str = (value) => (typeof value === 'string' ? value : null);

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  try {
    if (req.method === 'GET' && url.pathname === '/healthz') return send(res, 200, 'ok', 'text/plain');
    if (req.method === 'GET' && url.pathname === '/') {
      return send(res, 200, PAGE, 'text/html; charset=utf-8', { 'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'self'; frame-src 'self'" });
    }
    if (req.method === 'GET' && url.pathname === '/widget.js') return send(res, 200, WIDGET_JS, 'text/javascript; charset=utf-8');
    if (req.method === 'GET' && url.pathname === '/app.js') return send(res, 200, APP_JS, 'text/javascript; charset=utf-8');
    if (req.method === 'GET' && url.pathname === '/api/messages') return json(res, 200, messages);
    if (req.method === 'DELETE' && url.pathname === '/api/messages') { messages = []; persist(); return send(res, 204, '', 'text/plain'); }

    const htmlMatch = req.method === 'GET' && /^\/messages\/([^/]+)\/html$/.exec(url.pathname);
    if (htmlMatch) {
      const message = messages.find((m) => m.id === decodeURIComponent(htmlMatch[1]));
      if (!message?.html) return send(res, 404, 'not found', 'text/plain');
      return send(res, 200, message.html, 'text/html; charset=utf-8', { 'Content-Security-Policy': "sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:" });
    }

    if (req.method === 'POST' && url.pathname === '/emails') {
      if (!/^Bearer\s+\S+/.test(req.headers.authorization ?? '')) return json(res, 401, { name: 'missing_api_key', message: 'Missing API key.' });
      let body;
      try { body = JSON.parse(await readBody(req)); } catch (error) { return json(res, error.status ?? 400, { name: 'validation_error', message: 'Invalid JSON body.' }); }
      const subject = str(body?.subject); const from = str(body?.from);
      const to = (Array.isArray(body?.to) ? body.to : [body?.to]).filter((value) => typeof value === 'string' && value.length > 0);
      if (!subject || !from || to.length === 0) return json(res, 422, { name: 'validation_error', message: 'from, to and subject are required.' });

      const idempotencyKey = str(req.headers['idempotency-key']);
      const existing = idempotencyKey ? messages.find((m) => m.idempotencyKey === idempotencyKey) : undefined;
      if (existing) return json(res, 200, { id: existing.id });

      const message = { id: randomUUID(), idempotencyKey, receivedAt: new Date().toISOString(), from, to, subject, text: str(body.text) ?? '', html: str(body.html) };
      messages = [message, ...messages].slice(0, MAX_MESSAGES);
      persist();
      log(`mail ${message.id} to=${to.join(',')} subject=${JSON.stringify(subject)}`);
      return json(res, 200, { id: message.id });
    }
    return send(res, 404, 'not found', 'text/plain');
  } catch (error) {
    logError(`request failed: ${error?.stack ?? error}`);
    return send(res, 500, 'error', 'text/plain');
  }
});

server.listen(PORT, '0.0.0.0', () => log(`TwiPay dev inbox listening on :${PORT} (${messages.length} stored)`));

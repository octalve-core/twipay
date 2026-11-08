// TwiPay dev inbox widget: a floating button that opens a panel with every captured email.
// LOCAL DEVELOPMENT ONLY. Load it from the app's own origin (the apps proxy /__devmail/ to the dev inbox):
//   <script src="/__devmail/widget.js"></script>
// It talks to the same path prefix it was loaded from, renders all text with textContent, and only turns
// http(s) URLs into links. Styles use a constructed stylesheet so strict style-src CSPs do not block them.
(() => {
  if (window.__twipayDevMail) return;
  window.__twipayDevMail = true;

  const script = document.currentScript;
  const base = script && script.src ? new URL(script.src).pathname.replace(/widget\.js$/, '') : '/__devmail/';
  const SEEN_KEY = 'twipay.devmail.lastSeen';
  const storage = {
    get() { try { return localStorage.getItem(SEEN_KEY) || ''; } catch { return ''; } },
    set(value) { try { localStorage.setItem(SEEN_KEY, value); } catch { /* storage unavailable */ } },
  };

  const css = `
    :host{all:initial}
    *{box-sizing:border-box;font-family:system-ui,-apple-system,"Segoe UI",sans-serif}
    .fab{position:fixed;right:20px;bottom:20px;width:54px;height:54px;border-radius:50%;border:0;cursor:pointer;
      background:#14181f;color:#fff;font-size:24px;line-height:54px;text-align:center;padding:0;
      box-shadow:0 6px 20px rgba(0,0,0,.3);z-index:2147483000}
    .fab:hover{background:#1f2630}
    .fab.pulse{animation:pulse 1s ease-in-out 3}
    @keyframes pulse{50%{transform:scale(1.12)}}
    .badge{position:absolute;top:-4px;right:-4px;min-width:20px;height:20px;border-radius:10px;background:#c62828;color:#fff;
      font-size:12px;font-weight:700;line-height:20px;padding:0 5px;display:none}
    .badge.on{display:block}
    .panel{position:fixed;right:20px;bottom:86px;width:min(400px,calc(100vw - 40px));max-height:min(620px,calc(100vh - 110px));
      display:none;flex-direction:column;background:#fff;color:#14181f;border:1px solid #d0d5dd;border-radius:12px;
      box-shadow:0 12px 40px rgba(0,0,0,.25);overflow:hidden;z-index:2147483000}
    .panel.open{display:flex}
    .head{display:flex;align-items:center;gap:8px;padding:12px 14px;background:#14181f;color:#fff}
    .head strong{flex:1;font-size:14px}.head small{opacity:.65;font-weight:400}
    .head button{border:0;border-radius:6px;padding:4px 10px;font-size:12px;cursor:pointer;background:#2b323d;color:#fff}
    .head button:hover{background:#3a4350}
    .list{overflow:auto;padding:10px;background:#f6f7f9}
    .empty{color:#667085;text-align:center;padding:36px 8px;font-size:14px}
    .msg{background:#fff;border:1px solid #e4e7ec;border-radius:10px;padding:10px 12px;margin-bottom:10px}
    .msg.new{border-color:#4f8cff;box-shadow:0 0 0 2px #dbe8ff}
    .meta{color:#667085;font-size:12px;word-break:break-word}
    .subject{font-weight:600;font-size:14px;margin:2px 0 6px}
    .code{display:inline-flex;gap:8px;align-items:center;margin:0 0 6px;padding:2px 4px 2px 10px;border-radius:8px;background:#eef4ff;
      font:700 22px ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.14em}
    .code button{border:0;border-radius:6px;padding:4px 8px;font:600 11px system-ui,sans-serif;letter-spacing:0;cursor:pointer;background:#fff;color:#14181f}
    .body{white-space:pre-wrap;word-break:break-word;font-size:13px;line-height:1.45;margin:0}
    .body a{color:#175cd3}
    .foot{padding:6px 14px;background:#fff;border-top:1px solid #e4e7ec;color:#667085;font-size:11px}
  `;

  const make = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  const host = document.createElement('div');
  host.setAttribute('data-twipay-devmail', '');
  const root = host.attachShadow({ mode: 'open' });
  try {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(css);
    root.adoptedStyleSheets = [sheet];
  } catch { /* very old browser: unstyled but still functional */ }

  const fab = make('button', 'fab', '✉');
  fab.type = 'button';
  fab.setAttribute('aria-label', 'Open development inbox');
  const badge = make('span', 'badge');
  fab.append(badge);

  const panel = make('div', 'panel');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Development inbox');
  const head = make('div', 'head');
  const title = make('strong', '', 'Dev inbox ');
  title.append(make('small', '', '· nothing is delivered'));
  const clearButton = make('button', '', 'Clear');
  const closeButton = make('button', '', 'Close');
  head.append(title, clearButton, closeButton);
  const list = make('div', 'list');
  const foot = make('div', 'foot', 'Local development only. Anyone who can open this app can read these messages.');
  panel.append(head, list, foot);
  root.append(fab, panel);

  let messages = [];
  let open = false;
  let lastSeen = storage.get();
  let renderedKey = '';

  const newest = () => (messages.length ? messages[0].receivedAt : '');
  const unseen = () => messages.filter((m) => m.receivedAt > lastSeen).length;

  function linkify(container, text) {
    const pattern = /https?:\/\/[^\s<>"')]+/g;
    let index = 0;
    for (const match of text.matchAll(pattern)) {
      if (match.index > index) container.append(document.createTextNode(text.slice(index, match.index)));
      const anchor = make('a', '', match[0]);
      anchor.href = match[0];
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      container.append(anchor);
      index = match.index + match[0].length;
    }
    if (index < text.length) container.append(document.createTextNode(text.slice(index)));
  }

  function render() {
    const count = unseen();
    badge.textContent = count > 99 ? '99+' : String(count);
    badge.classList.toggle('on', count > 0 && !open);
    const key = `${open}|${lastSeen}|${messages.map((m) => m.id).join(',')}`;
    if (key === renderedKey) return;
    renderedKey = key;
    list.replaceChildren();
    if (messages.length === 0) { list.append(make('div', 'empty', 'No emails yet. Anything the app sends will appear here.')); return; }
    for (const m of messages) {
      const card = make('div', m.receivedAt > lastSeen ? 'msg new' : 'msg');
      card.append(make('div', 'meta', `${new Date(m.receivedAt).toLocaleString()} · to ${m.to.join(', ')}`));
      card.append(make('div', 'subject', m.subject));
      const code = (m.text.match(/\b\d{6,8}\b/) || [])[0];
      if (code) {
        const chip = make('div', 'code', code);
        const copy = make('button', '', 'Copy');
        copy.type = 'button';
        copy.addEventListener('click', async () => {
          try { await navigator.clipboard.writeText(code); copy.textContent = 'Copied'; } catch { copy.textContent = 'Select & copy'; }
          setTimeout(() => { copy.textContent = 'Copy'; }, 1500);
        });
        chip.append(copy);
        card.append(chip);
      }
      const body = make('p', 'body');
      linkify(body, m.text);
      card.append(body);
      list.append(card);
    }
  }

  async function refresh() {
    try {
      const response = await fetch(`${base}api/messages`, { cache: 'no-store' });
      if (!response.ok) return;
      const data = await response.json();
      if (!Array.isArray(data)) return;
      const hadNew = data.length > 0 && data[0].receivedAt > newest() && messages.length > 0;
      messages = data;
      if (open) { lastSeen = newest(); storage.set(lastSeen); }
      else if (hadNew) { fab.classList.remove('pulse'); void fab.offsetWidth; fab.classList.add('pulse'); }
      render();
    } catch { /* inbox unreachable: keep the last state */ }
  }

  function setOpen(value) {
    open = value;
    panel.classList.toggle('open', open);
    if (open) { lastSeen = newest() || lastSeen; storage.set(lastSeen); }
    renderedKey = '';
    render();
  }

  fab.addEventListener('click', () => setOpen(!open));
  closeButton.addEventListener('click', () => setOpen(false));
  clearButton.addEventListener('click', async () => {
    try { await fetch(`${base}api/messages`, { method: 'DELETE' }); } catch { /* ignore */ }
    messages = []; renderedKey = ''; render(); refresh();
  });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && open) setOpen(false); });

  const mount = () => { document.body.append(host); refresh(); setInterval(refresh, 2500); };
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount, { once: true });
})();

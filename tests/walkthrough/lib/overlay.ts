import type { BrowserContext, Page } from '@playwright/test';

// Observer only: a visible cursor, a click ripple and a caption bar drawn inside the page, so they are part of the
// recording by construction. It reads pointer events and never dispatches any.
const script = `(() => {
  if (window.__wtOverlay) return; window.__wtOverlay = true;
  const root = document.createElement('div');
  root.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483647';
  const cursor = document.createElement('div');
  cursor.style.cssText = 'position:absolute;width:18px;height:18px;border-radius:50%;background:rgba(220,38,38,.85);border:2px solid #fff;transform:translate(-50%,-50%);left:-50px;top:-50px;box-shadow:0 0 0 1px rgba(0,0,0,.4)';
  const bar = document.createElement('div');
  bar.style.cssText = 'position:absolute;left:0;right:0;bottom:0;padding:10px 16px;background:rgba(17,24,39,.92);color:#fff;font:600 15px system-ui,sans-serif;display:none';
  root.append(cursor, bar);
  const mount = () => document.documentElement.append(root);
  document.documentElement ? mount() : addEventListener('DOMContentLoaded', mount);
  addEventListener('mousemove', (e) => { cursor.style.left = e.clientX + 'px'; cursor.style.top = e.clientY + 'px'; }, true);
  addEventListener('mousedown', (e) => {
    const r = document.createElement('div');
    r.style.cssText = 'position:absolute;border-radius:50%;border:3px solid #dc2626;width:12px;height:12px;transform:translate(-50%,-50%);left:' + e.clientX + 'px;top:' + e.clientY + 'px;transition:all .45s ease-out;opacity:1';
    root.append(r);
    requestAnimationFrame(() => { r.style.width = '56px'; r.style.height = '56px'; r.style.opacity = '0'; });
    setTimeout(() => r.remove(), 600);
  }, true);
  window.__wtCaption = (text) => { bar.textContent = text; bar.style.display = text ? 'block' : 'none'; };
})();`;

export async function installOverlay(context: BrowserContext): Promise<void> {
  await context.addInitScript({ content: script });
}

export async function caption(page: Page, text: string): Promise<void> {
  await page.evaluate((value) => (window as unknown as { __wtCaption?: (t: string) => void }).__wtCaption?.(value), text);
}

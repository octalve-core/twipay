#!/usr/bin/env node
// Turns one finished walkthrough run into its deliverables. Usage:
//   node tests/walkthrough/build-artifacts.mjs --out <run dir> --sha <commit> [--findings <md>] [--no-video]
// It reads <run dir>/timeline.json, tabs.json, observations.json, bootstrap.sql and the recordings in _pw/, and writes
// coverage-matrix.md, chapters.json, chapters.vtt, findings.md, walkthrough.pdf, walkthrough.mp4 / .webm (fast cut) and walkthrough-realtime.mp4 next to them.
// It refuses to produce deliverables from a run that failed, was soft, or left a coverage row unticked.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { chromium } from '@playwright/test';
import { build } from './matrix/build-matrix.mjs';

const args = process.argv.slice(2);
const opt = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const out = resolve(opt('--out', 'out/walkthrough/run'));
const sha = opt('--sha', 'unknown');
const findingsPath = opt('--findings', 'docs/issues/WALKTHROUGH_FINDINGS_2026-11-04.md');
const ffmpeg = process.env.FFMPEG ?? '/home/rojitech/.local/bin/ffmpeg';
const json = (name) => JSON.parse(readFileSync(join(out, name), 'utf8'));
// --dry-run lets the layout be checked on a soft recon run; its PDF is stamped DRAFT and it is never a deliverable.
const dry = args.includes('--dry-run');
const fail = (message) => { process.stderr.write(`build-artifacts: ${dry ? 'DRY RUN, ignoring: ' : ''}${message}\n`); if (!dry) process.exit(1); };

const timeline = json('timeline.json');
const observed = json('observations.json');
const tabs = existsSync(join(out, 'tabs.json')) ? json('tabs.json') : { timelineStartedAt: 0, opened: {} };
// The recording is shown at --speed times real time (default 4), so the journey reads as a very fast person using the app. The
// real-time cut is kept as walkthrough-realtime.mp4. Captions are drawn inside the page, so they stay in the picture.
const speed = Number(opt('--speed', '4'));
const today = new Date().toISOString().slice(0, 10);

// 1. Only a green, strict, fully ticked run is a deliverable.
if (observed.failures.length) fail(`the run recorded ${observed.failures.length} failed steps (soft mode); it is evidence, not a deliverable`);
const failed = timeline.filter((s) => !s.ok);
if (failed.length) fail(`${failed.length} steps failed: ${failed.map((s) => s.id).join(', ')}`);
const { rows, md, planned } = build({ outDir: out });
if (planned.length) fail(`coverage rows not ticked: ${planned.map((r) => r.id).join(', ')}`);
writeFileSync(join(out, 'coverage-matrix.md'), `${md}\n`);

// 2. Chapters, for the video and for the contents page.
const chapters = [];
for (const [i, step] of timeline.entries()) {
  const last = chapters.at(-1);
  if (last && last.title === step.chapter) { last.endMs = step.endMs; last.steps.push(step.id); }
  else chapters.push({ title: step.chapter, startMs: i === 0 ? 0 : timeline[i - 1].endMs, endMs: step.endMs, steps: [step.id] });
}
const stamp = (ms) => { const t = Math.max(0, Math.round(ms)); const p = (n, w = 2) => String(n).padStart(w, '0'); return `${p(Math.floor(t / 3600000))}:${p(Math.floor(t / 60000) % 60)}:${p(Math.floor(t / 1000) % 60)}.${p(t % 1000, 3)}`; };
writeFileSync(join(out, 'chapters.json'), `${JSON.stringify(chapters, null, 2)}\n`);
const vtt = (factor) => `WEBVTT\n\n${chapters.map((c, i) => `${i + 1}\n${stamp(c.startMs / factor)} --> ${stamp(c.endMs / factor)}\n${c.title}\n`).join('\n')}`;
writeFileSync(join(out, 'chapters.vtt'), vtt(speed)); // matches walkthrough.mp4 / .webm
writeFileSync(join(out, 'chapters-realtime.vtt'), vtt(1)); // matches walkthrough-realtime.mp4

// 3. findings.md: the flow audit, headed by what the run measured.
const axeTotals = new Map();
for (const step of timeline) for (const a of step.axe ?? []) {
  const t = axeTotals.get(a.id) ?? { impact: a.impact, help: a.help, nodes: 0, pages: new Set() };
  t.nodes += a.nodes; t.pages.add(new URL(a.url).pathname); axeTotals.set(a.id, t);
}
const brokenSteps = timeline.filter((s) => s.checks?.brokenImages).length;
const rawCodes = [...new Set(timeline.flatMap((s) => s.checks?.rawCodes ?? []))];
const header = [
  '# Walkthrough findings (flow audit)', '',
  `Run of ${today} at commit \`${sha}\`: ${timeline.length} steps, ${rows.length} coverage rows, strict mode, from an empty database.`,
  `Observed on screen: ${brokenSteps} steps with a broken image, ${rawCodes.length} raw machine codes (${rawCodes.join(', ') || 'none'}), ${observed.observations.length} console / network observations.`, '',
  '## Accessibility measured in this run (axe-core)', '',
  '| Impact | Rule | Nodes | Pages |', '| :-- | :-- | --: | --: |',
  ...[...axeTotals.entries()].sort((a, b) => b[1].nodes - a[1].nodes).map(([id, t]) => `| ${t.impact} | ${id} | ${t.nodes} | ${t.pages.size} |`), '',
].join('\n');
const findingsBody = existsSync(findingsPath) ? readFileSync(findingsPath, 'utf8') : '';
writeFileSync(join(out, 'findings.md'), `${header}\n${findingsBody.replace(/^# .*\n/, '')}`);

// 4. The PDF: title page, contents, timeline, one page per step, coverage matrix, the two lists, findings.
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const inline = (s) => esc(s).replace(/&lt;br&gt;/g, '<br>').replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
function markdown(text) {
  const lines = text.split('\n'); const html = []; let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^\|/.test(line) && /^\|[\s:|-]+\|$/.test(lines[i + 1] ?? '')) {
      const cells = (l) => l.replace(/^\||\|$/g, '').split('|').map((c) => inline(c.trim()));
      html.push(`<table><tr>${cells(line).map((c) => `<th>${c}</th>`).join('')}</tr>`);
      i += 2; while (i < lines.length && /^\|/.test(lines[i])) { html.push(`<tr>${cells(lines[i]).map((c) => `<td>${c}</td>`).join('')}</tr>`); i += 1; }
      html.push('</table>'); continue;
    }
    const heading = line.match(/^(#{1,3}) (.*)/);
    if (heading) html.push(`<h${heading[1].length + 1}>${inline(heading[2])}</h${heading[1].length + 1}>`);
    else if (/^- /.test(line)) html.push(`<p class="li">&bull; ${inline(line.slice(2))}</p>`);
    else if (line.trim()) html.push(`<p>${inline(line)}</p>`);
    i += 1;
  }
  return html.join('\n');
}
const bootstrap = existsSync(join(out, 'bootstrap.sql')) ? readFileSync(join(out, 'bootstrap.sql'), 'utf8') : '';
const notDemonstrable = rows.filter((r) => r.demonstrable === 'no');
const clock = (ms) => `${String(Math.floor(ms / 60000)).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;
const html = `<!doctype html><html><head><meta charset="utf-8"><title>TwiPay product walkthrough</title><style>
@page { size: A4 landscape; margin: 12mm; } body { font: 11px/1.45 system-ui, sans-serif; color: #101828; }
h1 { font-size: 30px; margin: 0 0 8px; } h2 { font-size: 18px; margin: 18px 0 8px; } h3 { font-size: 14px; } code { background: #f2f4f7; padding: 0 3px; border-radius: 3px; }
.title { height: 170mm; display: flex; flex-direction: column; justify-content: center; } .title p { font-size: 15px; margin: 4px 0; }
.page { break-before: page; } table { border-collapse: collapse; width: 100%; margin: 6px 0; } th, td { border: 1px solid #d0d5dd; padding: 3px 6px; text-align: left; vertical-align: top; }
th { background: #f2f4f7; } .step img { width: 100%; max-height: 150mm; object-fit: contain; border: 1px solid #d0d5dd; } .cap { font-size: 14px; font-weight: 600; margin: 4px 0; }
.meta { color: #475467; } .li { margin: 2px 0; } pre { white-space: pre-wrap; background: #f2f4f7; padding: 6px; font-size: 9px; }
</style></head><body>
<section class="title"><h1>TwiPay product walkthrough${dry ? ' (DRAFT, not a deliverable)' : ''}</h1>
<p>Date: ${today}</p><p>Commit under test: <code>${esc(sha)}</code></p>
<p>${timeline.length} steps &middot; ${rows.length} coverage rows ticked &middot; one strict run from an empty database</p>
<p class="meta">Customer app at localhost:3102, admin console at localhost:3101, isolated stack, fictional .example accounts only.</p></section>
<section class="page"><h2>Contents</h2><table><tr><th>Chapter</th><th>Steps</th><th>Starts</th></tr>
${chapters.map((c) => `<tr><td>${esc(c.title)}</td><td>${c.steps[0]} to ${c.steps.at(-1)}</td><td>${clock(c.startMs)}</td></tr>`).join('')}</table>
<p>Then: coverage matrix, not demonstrable here, operator bootstrap, findings.</p>
<h2>Timeline</h2><table><tr><th>Step</th><th>Time</th><th>Who</th><th>What</th><th>Covers</th></tr>
${timeline.map((s) => `<tr><td>${s.id}</td><td>${clock(s.startMs)}</td><td>${esc(s.role)}</td><td>${esc(s.name)}</td><td>${esc(s.covers.join(', '))}</td></tr>`).join('')}</table></section>
${timeline.map((s) => `<section class="page step"><div class="meta">${esc(s.chapter)} &middot; ${esc(s.role)} &middot; ${s.id} &middot; ${clock(s.startMs)}</div>
<div class="cap">${esc(s.name)}</div><img src="${s.screenshot}"><div class="meta">Proves: ${esc(s.covers.join(', ') || 'context step')}</div></section>`).join('\n')}
<section class="page"><h2>Coverage matrix</h2>${markdown(md.split('\n## ')[0].replace(/^# .*\n/, ''))}</section>
<section class="page"><h2>Not demonstrable here</h2><p>A browser cannot show these without a live provider or a switch the product keeps off on purpose. Nothing was skipped silently.</p>
${notDemonstrable.map((r) => `<p class="li">&bull; <b>${esc(r.id)} ${esc(r.feature)}</b>: ${esc(r.note)}</p>`).join('')}
<h2>Operator bootstrap (not a user action)</h2><p>The first owners are database rows because no screen creates them, and the finance and operations roles have no delegation screen. These statements are the only database writes in the run; each is restricted to a fictional .example address and the walkthrough database.</p><pre>${esc(bootstrap)}</pre></section>
<section class="page"><h2>Findings</h2>${markdown(readFileSync(join(out, 'findings.md'), 'utf8').replace(/^# .*\n/, ''))}</section>
</body></html>`;
writeFileSync(join(out, 'report.html'), html);
const browser = await chromium.launch();
const pdfPage = await browser.newPage();
await pdfPage.goto(`file://${join(out, 'report.html')}`);
await pdfPage.pdf({ path: join(out, 'walkthrough.pdf'), format: 'A4', landscape: true, printBackground: true, displayHeaderFooter: true, headerTemplate: '<span></span>', footerTemplate: `<div style="font-size:8px;width:100%;text-align:center;color:#667085">TwiPay walkthrough &middot; ${sha} &middot; <span class="pageNumber"></span>/<span class="totalPages"></span></div>`, margin: { top: '12mm', bottom: '14mm', left: '12mm', right: '12mm' } });
await browser.close();

// 5. The recording: cut the customer tab and the admin tab together by the timeline, in real-time order.
if (!args.includes('--no-video') && !dry) {
  const parts = join(out, '_parts'); mkdirSync(parts, { recursive: true });
  const realtime = join(out, 'walkthrough-realtime.mp4');
  const meta = (factor) => [';FFMETADATA1', ...chapters.flatMap((c) => ['[CHAPTER]', 'TIMEBASE=1/1000', `START=${Math.round(c.startMs / factor)}`, `END=${Math.round(c.endMs / factor)}`, `title=${c.title}`])].join('\n');
  if (!args.includes('--fast-only')) {
    const videos = [];
    const walk = (dir) => { for (const name of readdirSync(dir)) { const p = join(dir, name); if (statSync(p).isDirectory()) walk(p); else if (name.endsWith('.webm')) videos.push(p); } };
    walk(join(out, '_pw'));
    const tabNames = Object.keys(tabs.opened).sort((a, b) => tabs.opened[a] - tabs.opened[b]);
    // Playwright also leaves a tiny stub recording for each screenshot; the real recordings are the largest, one per tab.
    videos.sort((a, b) => statSync(b).size - statSync(a).size);
    videos.splice(tabNames.length);
    videos.sort((a, b) => statSync(a).birthtimeMs - statSync(b).birthtimeMs);
    if (videos.length !== tabNames.length) fail(`expected ${tabNames.length} recordings (${tabNames.join(', ')}), found ${videos.length}`);
    const videoOf = Object.fromEntries(tabNames.map((name, i) => [name, videos[i]]));
    const runs = [];
    for (const [i, step] of timeline.entries()) {
      const from = i === 0 ? 0 : timeline[i - 1].endMs;
      const last = runs.at(-1);
      if (last && last.tab === step.tab) last.to = step.endMs; else runs.push({ tab: step.tab, from, to: step.endMs });
    }
    const listing = [];
    for (const [i, run] of runs.entries()) {
      const seek = Math.max(0, tabs.timelineStartedAt + run.from - tabs.opened[run.tab]) / 1000;
      const part = join(parts, `part${String(i).padStart(3, '0')}.mp4`);
      execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-ss', seek.toFixed(3), '-i', videoOf[run.tab], '-t', ((run.to - run.from) / 1000).toFixed(3), '-vf', 'scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,fps=25,format=yuv420p', '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '24', part]);
      listing.push(`file '${part}'`);
    }
    writeFileSync(join(parts, 'list.txt'), `${listing.join('\n')}\n`);
    writeFileSync(join(parts, 'chapters-realtime.ffmeta'), `${meta(1)}\n`);
    execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', join(parts, 'list.txt'), '-i', join(parts, 'chapters-realtime.ffmeta'), '-map_metadata', '1', '-c', 'copy', '-movflags', '+faststart', realtime]);
  }
  // The deliverable cut: the same footage at `speed` times real time. Frames are dropped explicitly (select) because older ffmpeg
  // builds re-duplicate them when the fps filter is used after setpts.
  writeFileSync(join(parts, 'chapters-fast.ffmeta'), `${meta(speed)}\n`);
  execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-i', realtime, '-i', join(parts, 'chapters-fast.ffmeta'), '-map', '0:v', '-map_metadata', '1', '-map_chapters', '1', '-vf', `select='floor((n+1)/${speed})-floor(n/${speed})',setpts=N/(25*TB),format=yuv420p`, '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '24', '-movflags', '+faststart', join(out, 'walkthrough.mp4')]);
  execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-i', join(out, 'walkthrough.mp4'), '-map', '0:v', '-map_metadata', '0', '-map_chapters', '0', '-c:v', 'libvpx', '-crf', '18', '-b:v', '500k', '-deadline', 'good', '-cpu-used', '4', '-threads', '8', '-an', join(out, 'walkthrough.webm')]);
}
process.stdout.write(`built ${basename(out)}: ${timeline.length} steps, ${chapters.length} chapters, ${rows.length} rows\n`);

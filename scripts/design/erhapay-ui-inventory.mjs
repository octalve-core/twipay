#!/usr/bin/env node
/** Deterministic, dependency-free source inventory. Does not render or modify UI. */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const app = join(repo, 'apps/customer-ui');
const src = join(app, 'src');
const output = join(repo, 'docs/design/ERHAPAY_COMPONENT_INVENTORY.json');
const assetBaseline = join(repo, 'docs/design/ERHAPAY_ORIGINAL_VISUAL_ASSETS.json');
const mode = process.argv[2] ?? '--check';
const sha256 = data => createHash('sha256').update(data).digest('hex');
const read = path => readFileSync(path, 'utf8');
const sorted = values => [...values].sort((a,b) => a.localeCompare(b,'en'));
function allFiles(dir) {
  return readdirSync(dir, { withFileTypes:true }).sort((a,b)=>a.name.localeCompare(b.name,'en')).flatMap(entry => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? allFiles(path) : entry.isFile() ? [path] : [];
  });
}
const rel = path => relative(app,path).split('\\').join('/');
const sourceFiles = allFiles(src).filter(p => /\.(tsx?|css)$/.test(p));
const reactFiles = sourceFiles.filter(p => /\.(tsx|jsx)$/.test(p));
const styleFiles = sourceFiles.filter(p => /\.(tsx|css)$/.test(p));
const colorCount = new Map();
const breakpoints = new Map();
const usages = new Map();
for (const path of styleFiles) {
  const content = read(path);
  for (const match of content.matchAll(/#[\da-fA-F]{6}(?:[\da-fA-F]{2})?\b/g)) {
    const hex = match[0].toUpperCase();
    colorCount.set(hex, (colorCount.get(hex) ?? 0)+1);
  }
  for (const match of content.matchAll(/\b(?:sm|md|lg|xl|2xl|max-sm|max-md|max-lg):/g)) {
    const breakpoint = match[0].slice(0,-1);
    breakpoints.set(breakpoint,(breakpoints.get(breakpoint) ?? 0)+1);
  }
  for (const key of ['CustomButton','BackButton','EmptyState','DashboardHeader','Sidebar','Dialog','Table','Select','Button']) {
    const pattern = new RegExp('(?:<'+key+'\\b|import\\s+[^;\\n]*\\b'+key+'\\b)', 'g');
    if (pattern.test(content)) {
      const current = usages.get(key) ?? [];
      current.push(rel(path));usages.set(key,current);
    }
  }
}
const counts = map => Object.fromEntries([...map.entries()].sort((a,b)=>b[1]-a[1] || a[0].localeCompare(b[0],'en')));
const layoutFiles = sorted(reactFiles.filter(p=>rel(p).startsWith('src/routes/layout/')).map(rel));
const authFiles = sorted(reactFiles.filter(p=>rel(p).startsWith('src/routes/auth-pages/')).map(rel));
const externalFiles = sorted(reactFiles.filter(p=>rel(p).startsWith('src/routes/external-pages/')).map(rel));
const dashboardRouteFiles = sorted(reactFiles.filter(p=>rel(p).startsWith('src/routes/dashboard/')).map(rel));
const primitives = sorted(reactFiles.filter(p=>rel(p).startsWith('src/components/ui/')).map(rel));
const dashboardComponents = sorted(reactFiles.filter(p=>rel(p).startsWith('src/components/dashboard/')).map(rel));
const originalAssetManifest = JSON.parse(read(assetBaseline));
const normalizeSvg = bytes => Buffer.from(bytes.toString('utf8').replace(/\r\n/g, '\n'), 'utf8');
let exactBytes=0, normalizedOnly=0;
const tampered=[];
for (const {path, normalizedSha256, originalSha256,kind} of originalAssetManifest.assets) {
  const current = readFileSync(join(app,path));
  const digest = sha256(current);
  if (digest === originalSha256) exactBytes++;
  else if (kind === 'svg' && sha256(normalizeSvg(current)) === normalizedSha256) normalizedOnly++;
  else tampered.push(path);
}
if (tampered.length) {
  throw new Error(`Original ErhaPay visual assets changed or missing: ${tampered.join(', ')}`);
}
const files = allFiles(src);
const appRouter = read(join(src,'App.tsx'));
const routes = [...appRouter.matchAll(/\bpath:\s*["']([^"']+)["']/g)].map(match=>match[1]);
const manifest = {
  schemaVersion:1,
  authority:'Original ErhaPay React/Vite customer source; preserved in apps/customer-ui',
  source:'Source inventory only. Browser visual equivalence has not been tested.',
  framework:'React 18, React Router, Vite 6, Tailwind CSS 4',
  typography:{primary:'Aeonik',stylesheet:'src/index.css'},
  colors:counts(colorCount),
  breakpoints:counts(breakpoints),
  layouts:layoutFiles,
  routes:{paths:routes,authPages:authFiles,externalPages:externalFiles,dashboardPages:dashboardRouteFiles},
  components:{ui:primitives,dashboardCount:dashboardComponents.length,domainGroups:sorted(readdirSync(join(src,'components/dashboard'),{withFileTypes:true}).filter(x=>x.isDirectory()).map(x=>x.name)),primaryReuse:Object.fromEntries([...usages.entries()].sort(([a],[b])=>a.localeCompare(b,'en')).map(([key,val])=>[key,sorted(val)]))},
  visualAssets:{originalPaths:originalAssetManifest.assets.length,exactByteMatches:exactBytes,lineEndingOnlyMatches:normalizedOnly,materialDifferences:0,baseline:'docs/design/ERHAPAY_ORIGINAL_VISUAL_ASSETS.json'},
  counts:{reactFiles:reactFiles.length,sourceFiles:sourceFiles.length,totalSrcFiles:files.length},
  keyFiles:{dashboardLayout:'src/routes/layout/DashboardLayout.tsx',dashboardHeader:'src/components/dashboard/DashboardHeader.tsx',sidebar:'src/components/dashboard/sidebar/Sidebar.tsx',pageHeading:'src/routes/dashboard/SettingsPage.tsx',settingsPanel:'src/components/dashboard/settings/Settings.tsx',customButton:'src/components/CustomButton.tsx',emptyState:'src/components/dashboard/EmptyState.tsx',scaffold:'src/components/design-system/ErhaPagePrimitives.tsx'},
};
const json = `${JSON.stringify(manifest,null,2)}\n`;
if (mode === '--write') {
  writeFileSync(output,json);
  console.log(`WROTE: ${relative(repo,output)} (${manifest.counts.sourceFiles} source files, ${originalAssetManifest.assets.length} source image assets)`);
} else if (mode === '--check') {
  if (read(output)!==json) throw new Error('ErhaPay UI inventory drift: run node scripts/design/erhapay-ui-inventory.mjs --write and review the new UI/design changes');
  console.log(`PASS: design inventory matches ${manifest.counts.sourceFiles} source files`);
} else throw new Error('Usage: node scripts/design/erhapay-ui-inventory.mjs [--check|--write]');
console.log(`PASS: ${originalAssetManifest.assets.length} original visual assets present; ${exactBytes} byte-identical, ${normalizedOnly} CRLF-only normalized, 0 material changes`);
console.log(`PASS: ${manifest.routes.paths.length} declared route paths; ${manifest.components.ui.length} UI primitives catalogued`);

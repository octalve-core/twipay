import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// What the journey may not contain. Files in ALLOW are observers or the labelled stage step, which are not actors.
export const RULES = [
  { name: 'api call', pattern: /\bpage\.request\b|\brequest\.(get|post|put|patch|delete|fetch)\b|\bfetch\s*\(|\baxios\b|\bcurl\b|\bAPIRequestContext\b/ },
  { name: 'database access', pattern: /\bprisma\b|\bPrismaClient\b|\bpg\b|\bpostgres(ql)?\b|\bSELECT\b|\bINSERT\b|\bUPDATE\b|\bDELETE FROM\b/ },
  { name: 'skip or fixme', pattern: /\.skip\b|\.fixme\b|\btest\.fail\b|\bretries\s*:\s*[1-9]/ },
  { name: 'visibility guess', pattern: /\bisVisible\s*\(|\bisHidden\s*\(|\bisEnabled\s*\(|\bisChecked\s*\(/ },
  { name: 'try/catch', pattern: /\btry\s*\{|\.catch\s*\(/ },
  { name: 'browser storage or cookies', pattern: /\blocalStorage\b|\bsessionStorage\b|\bcookies?\b|\baddCookies\b|\bstorageState\b/ },
  { name: 'goto outside the wrapper', pattern: /\.goto\s*\(/ },
  { name: 'script injection', pattern: /\.evaluate(Handle)?\s*\(|\.addInitScript\s*\(|\.route\s*\(/ },
  { name: 'fill instead of key presses', pattern: /\.fill\s*\(/ },
];

// Per-rule allowance for the files that legitimately need it.
export const ALLOW = {
  'goto outside the wrapper': ['lib/nav.ts'],
  'script injection': ['lib/overlay.ts', 'lib/observers.ts'],
  'api call': ['lib/observers.ts', 'lib/stage.ts'],
  'database access': ['lib/stage.ts'],
  'try/catch': ['lib/stage.ts', 'lib/soft.ts'],
  'browser storage or cookies': [],
};

export function listSources(root) {
  const out = [];
  for (const name of readdirSync(root)) {
    const path = join(root, name);
    if (statSync(path).isDirectory()) out.push(...listSources(path));
    else if (/\.ts$/.test(name)) out.push(path);
  }
  return out;
}

export function scan(root) {
  const findings = [];
  for (const file of listSources(root)) {
    const rel = relative(root, file).replaceAll('\\', '/');
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, index) => {
      const code = line.replace(/\/\/.*$/, ''); // comments may explain the rules
      for (const rule of RULES) {
        if ((ALLOW[rule.name] ?? []).includes(rel)) continue;
        if (rule.pattern.test(code)) findings.push(`${rel}:${index + 1} ${rule.name}: ${line.trim().slice(0, 80)}`);
      }
    });
  }
  return findings;
}

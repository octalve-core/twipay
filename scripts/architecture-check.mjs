import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
const root = new URL('..', import.meta.url).pathname;
const required = ['apps/web','apps/admin','apps/api','apps/worker','packages/contracts','packages/security','packages/database','docs/adr','docs/batches','.env.example','SECURITY.md'];
const missing = required.filter((p) => !existsSync(join(root,p)));
if (missing.length) { console.error('Architecture check FAILED, missing: '+missing.join(', ')); process.exit(1); }
const forbiddenProviders = ['paystack','monnify','vtpass','flutterwave','stripe','termii','mono'];
const coreDirs = ['apps/api/src/modules','packages/contracts/src','packages/security/src'];
const findings=[];
function walk(d){for(const n of readdirSync(d)){const p=join(d,n); const s=statSync(p); if(s.isDirectory()) walk(p); else if(/\.(ts|tsx)$/.test(p)){const txt=readFileSync(p,'utf8').toLowerCase(); for(const provider of forbiddenProviders){ if(txt.includes(`from '${provider}`)||txt.includes(`from \"${provider}`)) findings.push(`${p}: direct provider SDK import ${provider}`); }}}}
for(const d of coreDirs) if(existsSync(join(root,d))) walk(join(root,d));
if(findings.length){console.error('Architecture check FAILED:\n'+findings.join('\n'));process.exit(1)}
console.log('Architecture check PASS');

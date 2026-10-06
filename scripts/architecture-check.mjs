import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
const root = new URL('..', import.meta.url).pathname;
const required = [
  'apps/web','apps/admin','apps/api','apps/worker',
  'packages/contracts','packages/security','packages/database','packages/ledger','packages/services','packages/events','packages/providers',
  'docs/adr','docs/batches','.env.example','SECURITY.md'
];
const missing = required.filter((p) => !existsSync(join(root,p)));
if (missing.length) { console.error('Architecture check FAILED, missing: '+missing.join(', ')); process.exit(1); }
const forbiddenSdkImports = ['paystack','monnify','vtpass','flutterwave','stripe','termii','mono'];
const findings=[];
function walk(d){
  for(const n of readdirSync(d)){
    const p=join(d,n); const s=statSync(p);
    if(s.isDirectory()) walk(p);
    else if(/\.(ts|tsx)$/.test(p)){
      const txt=readFileSync(p,'utf8');
      const lower=txt.toLowerCase();
      const rel=relative(root,p).replaceAll('\\','/');
      for(const provider of forbiddenSdkImports){
        if(lower.includes(`from '${provider}`)||lower.includes(`from "${provider}`)) findings.push(`${rel}: direct provider SDK import ${provider}`);
      }
      if (txt.includes('@twipay/provider-') && !rel.startsWith('packages/providers/') && !rel.startsWith('apps/api/src/modules/providers/')) {
        findings.push(`${rel}: provider adapter imported outside the API provider registry boundary`);
      }
    }
  }
}
for(const d of ['apps','packages']) if(existsSync(join(root,d))) walk(join(root,d));

const runtimeWorkspacePackages = [
  'packages/contracts',
  'packages/security',
  'packages/ledger',
  'packages/providers/payments/paystack',
  'packages/providers/payments/monnify',
  'packages/providers/identity/mono',
  'packages/services',
  'packages/events',
  'packages/providers/bills/vtpass',
  'packages/providers/bills/monnify',
  'packages/providers/messaging/termii',
  'packages/providers/email/resend',
];
for (const packageDir of runtimeWorkspacePackages) {
  const manifestPath = join(root, packageDir, 'package.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const rootExport = manifest.exports?.['.'];
  if (rootExport?.types !== './src/index.ts' || rootExport?.import !== './dist/index.js') {
    findings.push(`${packageDir}: runtime workspace package must type-resolve source and import compiled dist`);
  }
}
const turbo = JSON.parse(readFileSync(join(root, 'turbo.json'), 'utf8'));
if (!turbo.tasks?.dev?.dependsOn?.includes('^build')) {
  findings.push('turbo dev must build runtime workspace dependencies before starting applications');
}
if(findings.length){console.error('Architecture check FAILED:\n'+findings.join('\n'));process.exit(1)}
console.log('Architecture check PASS');

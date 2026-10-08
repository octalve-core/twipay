import { execFileSync } from 'node:child_process';

const tracked = execFileSync('git',['ls-files'],{encoding:'utf8'}).split('\n').filter(Boolean);
const forbiddenEnv=tracked.filter((path)=>/(^|\/)\.env(?:\.|$)/.test(path) && !path.endsWith('.env.example') && path !== '.env.example');
const history=execFileSync('git',['log','--all','-p','--no-ext-diff','--unified=0','--pretty=format:commit:%H'],{encoding:'utf8',maxBuffer:64*1024*1024});
const patterns=[
  ['private key',/-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/],
  ['Paystack live secret',/\bsk_live_[A-Za-z0-9]{16,}\b/],
  ['Stripe-style live secret',/\b(?:rk|sk)_live_[A-Za-z0-9]{20,}\b/],
  ['AWS access key',/\bAKIA[0-9A-Z]{16}\b/],
  ['GitHub token',/\bgh[pousr]_[A-Za-z0-9]{30,}\b/],
  ['generic bearer JWT',/Bearer\s+eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/],
];
const failures=[];
for(const [name,re] of patterns){if(re.test(history))failures.push(name)}
if(forbiddenEnv.length) failures.push(`tracked environment files: ${forbiddenEnv.join(', ')}`);
if(failures.length){console.error('Git history secret check FAILED:');for(const f of failures)console.error(` - ${f}`);process.exit(1)}
console.log(`Git history secret check PASS (${tracked.length} tracked paths, full reachable patch history scanned)`);

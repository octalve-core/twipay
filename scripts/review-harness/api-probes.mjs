// Direct API probes for auth behaviour. Usage: node scripts/review-harness/api-probes.mjs B|C|D
//   B registration/login variants   C origin, reset and logout guards   D brute force (RESTART THE API FIRST:
//   the rate limiter is in memory, so earlier traffic from this IP changes the result).
import { API } from './harness.mjs';

const block = process.argv[2];
const origin =
  process.env.REVIEW_ORIGIN || new URL(process.env.REVIEW_UI || 'http://localhost:3002').origin;
const base = `${API}/v1/auth`;
const PW = 'Correct-Horse-Battery-9';
const run = Date.now();
const mk = (n) => `qa.api.${n}.${run}@example.test`;

async function post(path, body, headers = {}) {
  const r = await fetch(base + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin, ...headers },
    body: JSON.stringify(body),
  });
  let b = '';
  try {
    b = JSON.stringify(await r.clone().json());
  } catch {
    b = '';
  }
  b = b
    .replace(/"user":\{[^}]*\},?/, '"user":{…},')
    .replace(/("csrfToken":")[^"]+/, '$1<x>')
    .slice(0, 110);
  return { status: r.status, body: b, headers: r.headers };
}
const show = (label, x) => console.log(`${label.padEnd(50)} ${x.status}  ${x.body}`);

if (block === 'B') {
  const dup = mk('dup');
  const person = { givenName: 'A', familyName: 'B' };
  show('register new', await post('/register', { email: dup, password: PW, ...person }));
  show(
    'register same email again',
    await post('/register', { email: dup, password: PW, ...person }),
  );
  show(
    'register same email UPPERCASE',
    await post('/register', { email: dup.toUpperCase(), password: PW, ...person }),
  );
  show(
    'register + extra field role=SUPER_ADMIN',
    await post('/register', { email: mk('x'), password: PW, ...person, role: 'SUPER_ADMIN' }),
  );
  show('login correct', await post('/login', { email: dup, password: PW }));
  show('login UPPERCASE email', await post('/login', { email: dup.toUpperCase(), password: PW }));
  show(
    'login email with surrounding spaces',
    await post('/login', { email: ` ${dup} `, password: PW }),
  );
  show('login wrong password', await post('/login', { email: dup, password: 'nope-nope-nope-1' }));
  show(
    'login unknown email',
    await post('/login', { email: mk('ghost'), password: 'nope-nope-nope-1' }),
  );
} else if (block === 'C') {
  show(
    'login without Origin header',
    await post('/login', { email: mk('a'), password: PW }, { origin: '' }),
  );
  show(
    'login with foreign Origin',
    await post('/login', { email: mk('a'), password: PW }, { origin: 'https://evil.example' }),
  );
  show(
    'reset request: unknown account',
    await post('/password/reset/request', { email: mk('ghost2') }),
  );
  show(
    'reset complete: bad code',
    await post('/password/reset/complete', {
      email: mk('ghost2'),
      code: '00000000',
      newPassword: 'Another-Good-Pass-77',
    }),
  );
  show('logout without session/CSRF', await post('/logout', {}));
} else if (block === 'D') {
  const victim = mk('victim');
  await post('/register', { email: victim, password: PW, givenName: 'V', familyName: 'T' });
  const rows = [];
  let first;
  for (let n = 1; n <= 14; n++) {
    const r = await post('/login', { email: victim, password: `wrong-${n}-wrong-pass` });
    rows.push(r.status);
    if (r.status !== 401 && !first) first = { n, ...r, ra: r.headers.get('retry-after') };
  }
  console.log('statuses for 14 wrong logins:', rows.join(' '));
  if (first)
    console.log(
      `first non-401 at attempt ${first.n}: ${first.status} ${first.body} retry-after=${first.ra}`,
    );
  show(
    'then the CORRECT password immediately',
    await post('/login', { email: victim, password: PW }),
  );
} else {
  console.log('usage: node scripts/review-harness/api-probes.mjs B|C|D');
  process.exitCode = 2;
}

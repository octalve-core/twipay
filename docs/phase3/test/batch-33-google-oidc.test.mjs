/** Executes the actual Phase 3.3 Google OIDC service with an isolated database/provider seam.
 * Does NOT certify signed Google tokens, PostgreSQL, network OIDC, browser cookies or production. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const source = readFileSync(resolve(import.meta.dirname, '../../../apps/api/src/modules/auth/infrastructure/google-oidc.service.ts'),'utf8');
const code = ts.transpileModule(source,{fileName:'google-oidc.service.ts',compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,experimentalDecorators:true}}).outputText;
const env = { GOOGLE_OIDC_ENABLED:'true', GOOGLE_CLIENT_ID:'google-id', GOOGLE_CLIENT_SECRET:'fake-test-client-secret',
  GOOGLE_REDIRECT_URI:'http://localhost:4000/v1/auth/google/callback', APP_URL:'http://localhost:4102',
  SESSION_HASH_PEPPER:'test-pepper-longer-than-thirty-two-characters', GOOGLE_OIDC_TRANSACTION_KEY:Buffer.alloc(32,1).toString('base64') };
const prior = Object.fromEntries(Object.keys(env).map(k=>[k,process.env[k]]));
Object.assign(process.env,env);
process.on('exit',()=>{for(const [key,value] of Object.entries(prior)){if(value===undefined)delete process.env[key];else process.env[key]=value;}});
class HttpError extends Error {constructor(data,status){super(data?.code ?? 'ERROR');this.status=status;}}
const errors = Object.fromEntries([['ConflictException',409],['ForbiddenException',403],['UnauthorizedException',401]].map(([name,status])=>[name,class extends HttpError {constructor(data){super(data,status);}}]));
const oidc = {
  randomState:()=>require('node:crypto').randomBytes(24).toString('base64url'),
  randomNonce:()=>require('node:crypto').randomBytes(24).toString('base64url'),
  randomPKCECodeVerifier:()=>require('node:crypto').randomBytes(32).toString('base64url'),
  calculatePKCECodeChallenge:async verifier=>require('node:crypto').createHash('sha256').update(verifier).digest('base64url'),
  discovery:async()=>({}),
  buildAuthorizationUrl:(_config,parameters)=>{const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');for(const [k,v] of Object.entries(parameters))url.searchParams.set(k,v);return url;},
  authorizationCodeGrant:async(_config,url,checks)=>{
    assert.equal(checks.expectedState,url.searchParams.get('state'));
    assert.match(checks.pkceCodeVerifier,/^[A-Za-z0-9_-]{40,}$/);
    assert.equal(checks.idTokenExpected,true);
    const claims=providerClaims(url.searchParams.get('code'));
    if(claims.nonce !== checks.expectedNonce)throw new Error('nonce not verified');
    return { claims:()=>claims };
  },
};
const providerClaims=(code)=>{const row=fixtures.get(code);if(!row)throw Error('invalid code');return row;};
const fixtures=new Map();
const moduleObj={exports:{}};
new Function('require','module','exports',code)((name)=>{
  if(name==='@nestjs/common')return { Injectable:()=>klass=>klass, ServiceUnavailableException:class extends HttpError {constructor(data){super(data,503);}},...errors};
  if(name==='@twipay/security')return { SESSION_IDLE_TTL_SECONDS:86400, isRecentMfaAssurance:()=>true };
  if(name==='../application/contact-permissions.js')return {contactVerified:user=>Boolean(user.emailVerifiedAt || (user.phoneE164 && user.phoneVerifiedAt))};
  if(name==='openid-client')return oidc;
  if(name.startsWith('node:'))return require(name);
  throw Error(`Unexpected dependency ${name}`);
},moduleObj,moduleObj.exports);
const GoogleOidcService=moduleObj.exports.GoogleOidcService;
function harness(){
  const transactions=[], identities=[], users=[{id:'existing',email:'existing@example.com',emailVerifiedAt:new Date(),status:'ACTIVE',passwordCredential:{passwordHash:'hash:correct-password'}}],events=[],sessions=[{id:'sess1',userId:'existing',status:'ACTIVE',expiresAt:new Date(Date.now()+3600_000),lastSeenAt:new Date(),mfaSatisfiedAt:null,user:{status:'ACTIVE',emailVerifiedAt:new Date(),mfaCredentials:[]}}];
  let count=0;
  const tx={
    $queryRaw:async()=>[{id:'locked'}],
    session:{findFirst:async({where})=>sessions.find(x=>x.id===where.id && x.userId===where.userId && x.status==='ACTIVE') ?? null},
    oAuthIdentity:{findUnique:async({where})=>identities.find(x=>x.providerSubject===where.provider_providerSubject.providerSubject)??null,
      create:async({data})=>{if(identities.some(x=>x.providerSubject===data.providerSubject))throw Error('unique');const result={...data};identities.push(result);return result;}},
    user:{findUnique:async({where})=>users.find(x=>x.id===where.id || x.email===where.email)??null,
      create:async({data})=>{if(users.some(x=>x.email===data.email))throw Error('unique');const id=`new-${++count}`;users.push({id,...data});if(data.oauthIdentities?.create)identities.push({userId:id,...data.oauthIdentities.create});return{id};}},
    securityEvent:{create:async({data})=>events.push(data)},
  };
  const prisma={googleOidcTransaction:{create:async({data})=>{transactions.push({id:`flow-${transactions.length+1}`,consumedAt:null,...data});},
    findUnique:async({where})=>transactions.find(x=>x.stateHash===where.stateHash)??null,
    updateMany:async({where,data})=>{const t=transactions.find(x=>x.id===where.id && !x.consumedAt && x.expiresAt > where.expiresAt.gt);if(!t)return{count:0};t.consumedAt=data.consumedAt;return {count:1};}},
    user:{findUnique:async({where})=>users.find(x=>x.id===where.id)??null,update:async()=>{}},
    oAuthIdentity:{count:async({where})=>identities.filter(x=>x.userId===where.userId && x.provider===where.provider).length},
    securityEvent:{create:async({data})=>events.push(data)},
    $transaction:async fn=>fn(tx),
  };
  const sessionService={create:async(userId)=>({sessionId:'issued',token:'opaque-cookie',csrfToken:'csrf',userId,expiresAt:new Date(Date.now()+360000)})};
  const service=new GoogleOidcService(prisma,sessionService,{verify:async(hash,password)=>hash===`hash:${password}`});
  function identity(flow,code='code',overrides={}){
    const authUrl=new URL(flow.authorizationUrl);
    const nonce=authUrl.searchParams.get('nonce');
    fixtures.set(code,{iss:'https://accounts.google.com',sub:'google-sub',email:'new@example.com',email_verified:true,nonce,...overrides});
    return {state:authUrl.searchParams.get('state'),binding:flow.browserBinding,code};
  }
  return {service,users,identities,transactions,events,sessions,identity};
}

test('disabled by default when flag is absent',async()=>{const h=harness();process.env.GOOGLE_OIDC_ENABLED='false';try{assert.equal(h.service.enabled(),false);}finally{process.env.GOOGLE_OIDC_ENABLED='true';}});
test('state, nonce and S256 PKCE are generated and distinct, with encrypted server-side verifier',async()=>{const h=harness();const a=await h.service.start({purpose:'SIGN_IN'}),b=await h.service.start({purpose:'SIGN_IN'});const aUrl=new URL(a.authorizationUrl);assert.notEqual(aUrl.searchParams.get('state'),new URL(b.authorizationUrl).searchParams.get('state'));assert.equal(aUrl.searchParams.get('code_challenge_method'),'S256');assert.ok(aUrl.searchParams.get('nonce'));assert.ok(a.browserBinding);assert.match(h.transactions[0].verifierCiphertext,/^g1:/);assert.ok(!JSON.stringify(h.transactions).includes(a.browserBinding));});
test('valid Google identity provisions verified Google-only account with opaque session',async()=>{const h=harness();const flow=await h.service.start({purpose:'SIGN_IN'});const result=await h.service.complete(h.identity(flow));assert.equal(result.purpose,'SIGN_IN');assert.equal(result.session.token,'opaque-cookie');assert.equal(h.users.length,2);assert.equal(h.users[1].status,'ACTIVE');assert.ok(h.users[1].emailVerifiedAt);assert.equal(h.users[1].passwordCredential,undefined);});
test('a used callback is rejected on replay',async()=>{const h=harness();const flow=await h.service.start({purpose:'SIGN_IN'}),args=h.identity(flow);await h.service.complete(args);await assert.rejects(h.service.complete(args),{message:'GOOGLE_SIGN_IN_UNAVAILABLE'});});
test('wrong browser binding cannot redeem code or consume challenge',async()=>{const h=harness();const flow=await h.service.start({purpose:'SIGN_IN'}),args=h.identity(flow);await assert.rejects(h.service.complete({...args,binding:'attacker-cookie'}),{message:'GOOGLE_SIGN_IN_UNAVAILABLE'});assert.equal(h.transactions[0].consumedAt,null);await h.service.complete(args);});
test('expired challenge cannot be redeemed',async()=>{const h=harness();const flow=await h.service.start({purpose:'SIGN_IN'}),args=h.identity(flow);h.transactions[0].expiresAt=new Date(Date.now()-100);await assert.rejects(h.service.complete(args),{message:'GOOGLE_SIGN_IN_UNAVAILABLE'});});
test('nonce mismatch fails closed after single-use consumption',async()=>{const h=harness();const flow=await h.service.start({purpose:'SIGN_IN'}),args=h.identity(flow,'code',{nonce:'wrong-nonce'});await assert.rejects(h.service.complete(args),{message:'GOOGLE_SIGN_IN_UNAVAILABLE'});assert.ok(h.transactions[0].consumedAt);});
test('Google email collision cannot automatically link to an existing TwiPay account',async()=>{const h=harness();const flow=await h.service.start({purpose:'SIGN_IN'}),args=h.identity(flow,'code',{email:'existing@example.com'});await assert.rejects(h.service.complete(args),{message:'GOOGLE_ACCOUNT_LINK_REQUIRED'});assert.equal(h.identities.length,0);assert.equal(h.users.length,1);});
test('existing verified Google subject can sign in without creating another account',async()=>{const h=harness();h.identities.push({userId:'existing',provider:'GOOGLE',providerSubject:'google-sub'});const flow=await h.service.start({purpose:'SIGN_IN'}),args=h.identity(flow);const result=await h.service.complete(args);assert.equal(result.session.userId,'existing');assert.equal(h.users.length,1);});
test('account linking requires explicit password reauthentication',async()=>{const h=harness();await assert.rejects(h.service.start({purpose:'LINK',userId:'existing',sessionId:'sess1',currentPassword:'wrong-password'}),{message:'REAUTHENTICATION_REQUIRED'});assert.equal(h.transactions.length,0);});
test('authenticated account linking binds confirmed subject, never updates email',async()=>{const h=harness();const flow=await h.service.start({purpose:'LINK',userId:'existing',sessionId:'sess1',currentPassword:'correct-password'}),args=h.identity(flow,'code',{email:'unrelated@example.com'});const result=await h.service.complete(args);assert.equal(result.purpose,'LINK');assert.equal(result.session,undefined);assert.equal(h.identities[0].userId,'existing');assert.equal(h.users[0].email,'existing@example.com');assert.equal(await h.service.isLinked('existing'),true);});
test('revoked original session blocks a pending link callback',async()=>{const h=harness();const flow=await h.service.start({purpose:'LINK',userId:'existing',sessionId:'sess1',currentPassword:'correct-password'}),args=h.identity(flow);h.sessions[0].status='REVOKED';await assert.rejects(h.service.complete(args),{message:'ACCOUNT_LINK_NOT_ALLOWED'});assert.equal(h.identities.length,0);});
test('Google identity already linked to someone else is not transferable',async()=>{const h=harness();h.identities.push({userId:'another',provider:'GOOGLE',providerSubject:'google-sub'});const flow=await h.service.start({purpose:'LINK',userId:'existing',sessionId:'sess1',currentPassword:'correct-password'}),args=h.identity(flow);await assert.rejects(h.service.complete(args),{message:'GOOGLE_ACCOUNT_ALREADY_LINKED'});assert.equal(h.identities[0].userId,'another');});
test('unverified provider email cannot register a new account',async()=>{const h=harness();const flow=await h.service.start({purpose:'SIGN_IN'}),args=h.identity(flow,'code',{email_verified:false});await assert.rejects(h.service.complete(args),{message:'GOOGLE_SIGN_IN_UNAVAILABLE'});assert.equal(h.users.length,1);});
test('concurrent callback requests permit exactly one consumption',async()=>{const h=harness();const flow=await h.service.start({purpose:'SIGN_IN'}),args=h.identity(flow);const outcomes=await Promise.allSettled([h.service.complete(args),h.service.complete(args)]);assert.equal(outcomes.filter(x=>x.status==='fulfilled').length,1);assert.equal(outcomes.filter(x=>x.status==='rejected').length,1);});

#!/usr/bin/env node
/** Phase 1.3 evidence-only preflight. Never connects to a database or provider. */
import { existsSync, readdirSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';

export const root = resolve(import.meta.dirname, '../..');
const sha = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');
export const workspacePackages = (base = root) => {
  const paths = [];
  for (const dir of ['apps','packages']) {
    for (const name of readdirSync(join(base, dir), { withFileTypes: true })) {
      if (!name.isDirectory()) continue;
      const relative = `${dir}/${name.name}`;
      if (existsSync(join(base, relative, 'package.json'))) paths.push(relative);
      if (relative === 'packages/providers') {
        for (const family of readdirSync(join(base, relative), { withFileTypes: true }).filter(x => x.isDirectory())) {
          for (const provider of readdirSync(join(base, relative, family.name), { withFileTypes: true }).filter(x => x.isDirectory())) {
            const nested = `${relative}/${family.name}/${provider.name}`;
            if (existsSync(join(base, nested, 'package.json'))) paths.push(nested);
          }
        }
      }
    }
  }
  return paths.sort();
};
export function inspectWorkspace(base = root) {
  const paths = workspacePackages(base);
  const manifests = [{path:'.',manifest:JSON.parse(readFileSync(join(base,'package.json'),'utf8'))}, ...paths.map(path => ({path,manifest:JSON.parse(readFileSync(join(base,path,'package.json'),'utf8'))}))];
  const names = new Set();
  const errors = [];
  for (const {path,manifest} of manifests) {
    if (!manifest.name) errors.push(`${path}: package has no name`);
    else if (names.has(manifest.name)) errors.push(`${path}: duplicate workspace name ${manifest.name}`);
    names.add(manifest.name);
  }
  for (const {path,manifest} of manifests) {
    for (const section of ['dependencies','devDependencies','optionalDependencies']) {
      for (const [name,version] of Object.entries(manifest[section] ?? {})) {
        if (typeof version === 'string' && version.startsWith('workspace:') && !names.has(name)) {
          errors.push(`${path}: missing workspace dependency ${name}`);
        }
      }
    }
  }
  return { paths, names: [...names].sort(), errors };
}
export function inspectLockfile(contents, packages) {
  if (!contents) return {valid:false,missing:['.', ...packages],message:'Root pnpm-lock.yaml does not exist'};
  const lines = contents.split(/\r?\n/);
  const rootKey = lines.findIndex(line => /^importers:\s*$/.test(line));
  const versionFound = lines.some(line => /^lockfileVersion:\s*\S/.test(line));
  if (rootKey < 0 || !versionFound) return {valid:false,missing:['.', ...packages],message:'Missing lockfileVersion or importers section'};
  const found = new Set();
  for (let i = rootKey + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '' || line.trim().startsWith('#')) continue;
    if (/^[^\s]/.test(line)) break;
    const hit = line.match(/^  (['"]?)([^'":]+)\1:\s*$/);
    if (hit) found.add(hit[2]);
  }
  const missing = ['.',...packages].filter(path => !found.has(path));
  return {valid:missing.length===0,missing,importerCount:found.size,message:missing.length?`Missing ${missing.length} workspace importers`:'All workspace importers represented (dependency resolution not independently verified)'};
}
const command = (bin,args) => {
  const res = spawnSync(bin,args,{encoding:'utf8',timeout:3500,stdio:['ignore','pipe','pipe']});
  if (res.error || res.status !== 0) return null;
  return res.stdout.trim().split('\r?\n')[0];
};
const gate = (name,status,evidence) => ({name,status,evidence});
export function getSourceGates(base = root) {
  const w = inspectWorkspace(base);
  const project = JSON.parse(readFileSync(join(base,'package.json'),'utf8'));
  const pm = /^pnpm@(\d+\.\d+\.\d+)$/.exec(project.packageManager ?? '');
  const lock = existsSync(join(base,'pnpm-lock.yaml')) ? readFileSync(join(base,'pnpm-lock.yaml'),'utf8') : null;
  const lockCheck = inspectLockfile(lock,w.paths);
  const prismaPackage = JSON.parse(readFileSync(join(base,'packages/database/package.json'),'utf8'));
  const prismaSchema = readFileSync(join(base,'packages/database/prisma/schema.prisma'),'utf8');
  const prismaConfig = readFileSync(join(base,'packages/database/prisma.config.ts'),'utf8');
  const prismaClient = readFileSync(join(base,'apps/api/src/platform/database/prisma.service.ts'),'utf8');
  const migrationPath = join(base,'packages/database/prisma/migrations');
  const migrations = readdirSync(migrationPath,{withFileTypes:true}).filter(x=>x.isDirectory()).map(x=>({name:x.name,path:join(migrationPath,x.name,'migration.sql')})).sort((a,b)=>a.name.localeCompare(b.name));
  const migrationChecksums = migrations.map(m=>({name:m.name,sha256:existsSync(m.path)?sha(m.path):null}));
  const baseline = JSON.parse(readFileSync(join(base,'docs/integration/PHASE13_BASELINE_MIGRATIONS.json'),'utf8'));
  const baselineIntegrity = baseline.migrations.every(expected => migrationChecksums.some(m => m.name === expected.name && m.sha256 === expected.sha256));
  const prismaOK = /^\s*datasource db\s*\{\s*provider\s*=\s*"postgresql"\s*\}/m.test(prismaSchema) &&
    prismaConfig.includes('process.env.DATABASE_URL') && prismaConfig.includes("prisma/migrations") &&
    prismaClient.includes('new PrismaPg({ connectionString })') && prismaClient.includes("if (!connectionString) throw") &&
    prismaPackage.dependencies['@prisma/client'] === prismaPackage.dependencies['@prisma/adapter-pg'] &&
    prismaPackage.dependencies['@prisma/client'] === prismaPackage.devDependencies.prisma;
  return {packages:w,migrations:migrationChecksums,pmVersion:pm?.[1]??null,lockCheck,gates:[
    gate('Workspace dependency references',w.errors.length===0?'PASS':'FAIL',`${w.paths.length} workspaces, ${w.errors.length} missing/duplicate references${w.errors.length?': '+w.errors.join('; '):''}`),
    gate('Pinned pnpm packageManager',!!pm?'PASS':'FAIL',project.packageManager ?? '(none)'),
    gate('Prisma 7 source configuration',prismaOK?'PASS':'FAIL','Prisma client adapter and CLI source verified; no Prisma generation or database command executed'),
    gate('Migration source completeness',migrations.length>=5 && migrationChecksums.every(x=>x.sha256)?'PASS':'FAIL',`Migration folders: ${migrations.map(x=>x.name).join(', ')}`),
    gate('Original five migration hashes unchanged',baselineIntegrity?'PASS':'FAIL',baselineIntegrity?'Original ledger/security migrations match pinned Phase 1.3 baseline':'A previously committed migration changed or disappeared; manual review required'),
    gate('Root lockfile importer coverage',lockCheck.valid?'PASS':'BLOCKED',lockCheck.message + '; frozen install still required'),
  ]};
}
export function collect(base = root) {
  const staticResult = getSourceGates(base);
  const project = JSON.parse(readFileSync(join(base,'package.json'),'utf8'));
  const actualNode = process.version;
  const pinnedPnpm = staticResult.pmVersion;
  const pnpm = command('pnpm',['--version']);
  const docker = command('docker',['--version']);
  const dockerCompose = docker && command('docker',['compose','version']);
  const nodeOK = /^v24\./.test(actualNode);
  const pnpmOK = !!pinnedPnpm && pnpm === pinnedPnpm;
  const gates = [...staticResult.gates,
    gate('Node.js 24 runtime',nodeOK?'PASS':'BLOCKED',`Found ${actualNode}; required ${project.engines?.node??'24'}`),
    gate('Exact pnpm runtime',pnpmOK?'PASS':'BLOCKED',`Installed ${pnpm??'unavailable'}; required ${pinnedPnpm??'unconfigured'}`),
    gate('Docker Compose available',dockerCompose?'PASS':'BLOCKED',dockerCompose??'Docker Compose not available'),
    gate('Frozen dependency installation','BLOCKED','Must execute pnpm install --frozen-lockfile against the registry with exact pinned pnpm'),
    gate('Prisma generate/validate/migration deploy','BLOCKED','Must execute in isolated Node 24 / pnpm / PostgreSQL 18 runtime'),
    gate('PostgreSQL 18 financial tests','BLOCKED','Must execute against disposable PostgreSQL 18; migration hashes alone do not prove DB integrity'),
    gate('Redis 8 / BullMQ integration','BLOCKED','Must execute with disposable Redis 8'),
    gate('Combined workspace build','BLOCKED','Requires installed pnpm dependency graph and Prisma generation')
  ];
  return {timestamp:new Date().toISOString(),gitHead:command('git',['-C',base,'rev-parse','HEAD']),branch:command('git',['-C',base,'branch','--show-current']),node:actualNode,requiredNode:project.engines?.node,requiredPnpm:pinnedPnpm,installedPnpm:pnpm,workspaceCount:staticResult.packages.paths.length,workspacePackages:staticResult.packages.paths,lockfile:staticResult.lockCheck,migrations:staticResult.migrations,gates,summary:{pass:gates.filter(x=>x.status==='PASS').length,fail:gates.filter(x=>x.status==='FAIL').length,blocked:gates.filter(x=>x.status==='BLOCKED').length}};
}
if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  const result = collect();
  mkdirSync(join(root,'out'),{recursive:true});
  writeFileSync(join(root,'out/phase1-3-gates.json'),JSON.stringify(result,null,2)+'\n');
  for (const gate of result.gates) console.log(`${gate.status.padEnd(7)} ${gate.name} — ${gate.evidence}`);
  console.log(`Summary PASS ${result.summary.pass}, FAIL ${result.summary.fail}, BLOCKED ${result.summary.blocked}`);
  console.log('Full results: out/phase1-3-gates.json (contains no database credentials)');
  if (process.argv.includes('--check-lock')) {
    const required=result.gates.find(g=>g.name==='Root lockfile importer coverage');
    if(required.status!=='PASS' || result.summary.fail) process.exitCode=1;
  } else if (result.summary.fail || (process.argv.includes('--strict') && result.summary.blocked)) process.exitCode=1;
}

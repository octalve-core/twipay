import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ts = require('typescript');

const root = new URL('..', import.meta.url).pathname;
const files = [];
function walk(path) {
  for (const name of readdirSync(path)) {
    if (['node_modules', 'dist', '.test-dist', '.next'].includes(name)) continue;
    const full = join(path, name);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full);
    else if (/\.(?:ts|tsx)$/.test(name) && !name.endsWith('.d.ts')) files.push(full);
  }
}
for (const dir of ['apps', 'packages']) walk(join(root, dir));

const findings = [];
for (const file of files) {
  const source = readFileSync(file, 'utf8');
  const result = ts.transpileModule(source, {
    fileName: file,
    reportDiagnostics: true,
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      jsx: ts.JsxEmit.ReactJSX,
      useDefineForClassFields: true,
    },
  });
  for (const diagnostic of result.diagnostics ?? []) {
    if (diagnostic.category !== ts.DiagnosticCategory.Error) continue;
    const position = diagnostic.file && diagnostic.start !== undefined
      ? diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start)
      : undefined;
    findings.push(`${relative(root, file)}${position ? `:${position.line + 1}:${position.character + 1}` : ''} TS${diagnostic.code}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')}`);
  }
}

if (findings.length) {
  console.error(`TypeScript syntax check FAILED (${files.length} source files):\n${findings.map((x) => ` - ${x}`).join('\n')}`);
  process.exit(1);
}
console.log(`TypeScript syntax check PASS (${files.length} source files)`);

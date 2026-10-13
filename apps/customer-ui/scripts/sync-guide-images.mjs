// Fills apps/customer-ui/public/guide with the screenshots listed in src/routes/external-pages/guideData.ts,
// copied from docs/screenshots (the single committed copy). public/guide is git-ignored and generated.
// Only runs when VITE_TWIPAY_DEV_GUIDE=true; otherwise it removes public/guide so no screenshot can ship in a
// production image.
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(here, "..");
const target = join(appRoot, "public", "guide");
const shotsRoot = resolve(appRoot, "..", "..", "docs", "screenshots");

rmSync(target, { recursive: true, force: true });
if (process.env.VITE_TWIPAY_DEV_GUIDE !== "true") process.exit(0);

const data = readFileSync(join(appRoot, "src/routes/external-pages/guideData.ts"), "utf8");
const files = [...new Set([...data.matchAll(/\bfile:\s*"([^"]+\.png)"/g)].map((m) => m[1]))];

// file name -> path across the dated run folders. A "route-" prefix in the page data maps to the capture
// script's plain file name.
const index = new Map();
if (existsSync(shotsRoot)) {
  for (const dir of readdirSync(shotsRoot, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    for (const name of readdirSync(join(shotsRoot, dir.name))) {
      index.set(name, join(shotsRoot, dir.name, name));
    }
  }
}

mkdirSync(target, { recursive: true });
const missing = [];
for (const file of files) {
  const source = index.get(file) ?? index.get(file.replace(/^route-/, ""));
  if (source) cpSync(source, join(target, file));
  else missing.push(file);
}
if (missing.length) {
  process.stderr.write(`guide images missing from docs/screenshots: ${missing.join(", ")}\n`);
  process.exit(1);
}
process.stdout.write(`guide: copied ${files.length} screenshots into public/guide\n`);

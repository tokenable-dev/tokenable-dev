/**
 * Fail the build if `next/font/google` returns — Google intermittently serves
 * extensionless `/l/font?kit=` URLs that break Next 16 Turbopack (vercel/next.js#99114).
 * Use `next/font/local` + files under `app/fonts/` instead.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const hits = [];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next") continue;
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      walk(full);
      continue;
    }
    if (!/\.(tsx?|jsx?|mjs|cjs)$/.test(name)) continue;
    const text = readFileSync(full, "utf8");
    if (/from\s+['"]next\/font\/google['"]/.test(text)) {
      hits.push(path.relative(root, full));
    }
  }
}

walk(path.join(root, "app"));
walk(path.join(root, "components"));
walk(path.join(root, "lib"));

if (hits.length) {
  console.error(
    "ERROR: next/font/google is banned (Docker Turbopack build flake). Use app/fonts.ts + next/font/local.\n" +
      hits.map((h) => `  - ${h}`).join("\n"),
  );
  process.exit(1);
}

console.log("check:no-google-fonts OK");

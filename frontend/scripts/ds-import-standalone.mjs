/**
 * Designer standalone HTML → app integration.
 *
 *   node scripts/ds-import-standalone.mjs [path/to/standalone.html]
 *   node scripts/ds-import-standalone.mjs --extract-css [path]
 *
 * Default source: `Tokenable Design System/Tokenable Design System (Standalone).html`
 * Copies showcase bundle to `public/design-system-standalone.html` (/dev/design-system iframe).
 * `--extract-css` pulls typography + components from the embedded bundle (escaped in the loader)
 * into `design-system/_import-*.css` for manual diff — does not overwrite production CSS.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(frontendRoot, "..");

const args = process.argv.slice(2);
const extractCss = args.includes("--extract-css");
const srcArg = args.filter((a) => !a.startsWith("--"))[0];
const defaultSrc = path.join(
  repoRoot,
  "Tokenable Design System",
  "Tokenable Design System (Standalone).html",
);
const src = path.resolve(srcArg ?? defaultSrc);

if (!fs.existsSync(src)) {
  console.error(`Source not found: ${src}`);
  process.exit(1);
}

const raw = fs.readFileSync(src, "utf8");
const destPublic = path.join(frontendRoot, "public/design-system-standalone.html");
fs.copyFileSync(src, destPublic);
console.log(`Copied showcase → ${path.relative(repoRoot, destPublic)}`);

function unescapeEmbeddedCss(snippet) {
  return snippet
    .replace(/\\n/g, "\n")
    .replace(/\\"/g, '"')
    .replace(/\\\//g, "/");
}

function sliceBetween(haystack, startMarker, endMarker) {
  const start = haystack.indexOf(startMarker);
  if (start < 0) return null;
  const end = haystack.indexOf(endMarker, start + startMarker.length);
  if (end < 0) return null;
  return haystack.slice(start, end);
}

if (extractCss) {
  const typoBlock = sliceBetween(
    raw,
    "/* Named type styles — mirror the Figma text styles. Apply directly. */",
    "/* Tokenable — component styles",
  );
  const compStart = raw.indexOf("/* Tokenable — component styles");
  let compBlock = null;
  if (compStart >= 0) {
    const motion = raw.indexOf("@media (prefers-reduced-motion: reduce)", compStart);
    const endTag = raw.indexOf("</style>", motion > 0 ? motion : compStart);
    const end = endTag > compStart ? endTag : raw.indexOf("<\\u002Fstyle>", compStart);
    if (end > compStart) {
      compBlock = raw.slice(compStart, end);
    }
  }

  const dsDir = path.join(frontendRoot, "design-system");
  if (typoBlock) {
    const out = path.join(dsDir, "_import-typography.css");
    const body = unescapeEmbeddedCss(typoBlock).trim();
    fs.writeFileSync(
      out,
      `/* Typography — extracted from designer standalone. Diff → tokens/fig-typography.css */\n${body}\n`,
    );
    console.log(`Wrote ${path.relative(repoRoot, out)} (${body.length} chars)`);
  } else {
    console.warn("Typography block not found — bundle format may have changed.");
  }

  if (compBlock) {
    const out = path.join(dsDir, "_import-components.css");
    const body = unescapeEmbeddedCss(compBlock).trim();
    fs.writeFileSync(
      out,
      `/* Components — extracted from designer standalone. Diff → components/components.css */\n${body}\n`,
    );
    console.log(`Wrote ${path.relative(repoRoot, out)} (${body.length} chars)`);
  } else {
    console.warn("Components block not found — bundle format may have changed.");
  }

  console.log(
    "Merge _import-*.css into design-system/, preserve app-only tk-btn--primary-inv, then verify /dev/design-system",
  );
} else {
  console.log(
    "Optional: node scripts/ds-import-standalone.mjs --extract-css  →  _import-*.css for diff",
  );
  console.log("Merge tokens/components manually, then verify http://localhost:3000/dev/design-system");
}

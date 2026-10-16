#!/usr/bin/env node
/**
 * Fail fast when CSS is invalid before Tailwind/Next dev surfaces a vague CssSyntaxError.
 * 1) Balanced { } in styles/ and design-system/
 * 2) Full Tailwind parse of app/globals.css (same pipeline as `next dev`)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postcss from "postcss";
import tailwindcss from "@tailwindcss/postcss";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const stylesDir = path.join(root, "styles");
const designSystemDir = path.join(root, "design-system");
const globalsCss = path.join(root, "app", "globals.css");

function collectCssFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectCssFiles(full));
    else if (entry.name.endsWith(".css")) out.push(full);
  }
  return out;
}

function braceDepth(css) {
  let depth = 0;
  let inComment = false;
  let inString = false;

  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    const n = css[i + 1];

    if (inComment) {
      if (c === "*" && n === "/") {
        inComment = false;
        i++;
      }
      continue;
    }

    if (inString) {
      if (c === "\\") {
        i++;
        continue;
      }
      if (c === inString) inString = false;
      continue;
    }

    if (c === "/" && n === "*") {
      inComment = true;
      i++;
      continue;
    }

    if (c === '"' || c === "'") {
      inString = c;
      continue;
    }

    if (c === "{") depth++;
    if (c === "}") {
      depth--;
      if (depth < 0) return -1;
    }
  }

  return depth;
}

const files = [
  ...collectCssFiles(stylesDir),
  ...collectCssFiles(designSystemDir),
];

let failed = false;

for (const file of files) {
  const depth = braceDepth(fs.readFileSync(file, "utf8"));
  if (depth !== 0) {
    console.error(`${path.relative(root, file)}: unbalanced braces (depth ${depth})`);
    failed = true;
  }
}

if (!fs.existsSync(globalsCss)) {
  console.error("app/globals.css: missing");
  failed = true;
} else {
  try {
    await postcss([tailwindcss()]).process(fs.readFileSync(globalsCss, "utf8"), {
      from: globalsCss,
    });
  } catch (err) {
    const msg = err?.message ?? String(err);
    console.error(`Tailwind CSS (globals.css): ${msg}`);
    failed = true;
  }
}

if (failed) process.exit(1);

console.log(`check-css-braces: OK (${files.length} style files + globals.css)`);

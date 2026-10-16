#!/usr/bin/env node
/**
 * Regenerates static partner bulk-upload workbooks in public/downloads/.
 * One column only — cert numbers (PSA lookup fills card metadata).
 * Run: pnpm run generate:partner-cert-xlsx
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import XLSX from "xlsx";

const root = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(root, "..", "public", "downloads");
const SHEET = "Cert upload";
const HEADER = "cert_number";

function writeWorkbook(filename, rows) {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const lastRow = rows.length;
  ws["!ref"] = `A1:A${lastRow}`;
  ws["!cols"] = [{ wch: 14 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, SHEET);
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return writeFile(path.join(outDir, filename), buf);
}

await mkdir(outDir, { recursive: true });

const templateRows = [[HEADER]];
for (let i = 0; i < 100; i++) templateRows.push([""]);

await writeWorkbook("tokenable-partner-cert-upload-template.xlsx", templateRows);
await writeWorkbook("tokenable-partner-cert-upload-sample.xlsx", [
  [HEADER],
  ["12345678"],
  ["88231044"],
]);

console.log("Wrote public/downloads/*.xlsx (single column: cert_number)");

/**
 * Admin paste → cleaned trades CSV for pricecharting_trade_history upload.
 * One trade per line: date + price. Optional source / sale_type.
 */

import { normalizeSampleTradesProductId } from "./pricechartingSampleTradesCsv";

export type PastedTradeRow = {
  line: number;
  tradedOn: string;
  priceUsd: number;
  source: string;
  saleType: string;
};

export type ParsePastedTradesResult = {
  rows: PastedTradeRow[];
  skipped: Array<{ line: number; reason: string }>;
};

/** YYYY-MM-DD, YYYY/MM/DD, M/D/YYYY, MM-DD-YYYY → YYYY-MM-DD */
export function normalizeTradeDate(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;

  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (m) {
    const y = m[1]!;
    const mo = m[2]!.padStart(2, "0");
    const d = m[3]!.padStart(2, "0");
    return isValidYmd(y, mo, d) ? `${y}-${mo}-${d}` : null;
  }

  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (m) {
    const mo = m[1]!.padStart(2, "0");
    const d = m[2]!.padStart(2, "0");
    const y = m[3]!;
    return isValidYmd(y, mo, d) ? `${y}-${mo}-${d}` : null;
  }

  return null;
}

function isValidYmd(y: string, mo: string, d: string): boolean {
  const year = Number(y);
  const month = Number(mo);
  const day = Number(d);
  if (!Number.isFinite(year) || month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }
  const dt = new Date(Date.UTC(year, month - 1, day));
  return (
    dt.getUTCFullYear() === year &&
    dt.getUTCMonth() === month - 1 &&
    dt.getUTCDate() === day
  );
}

/** `$1,250.50` / `1250.5` / `261` → dollars */
export function normalizeTradePriceUsd(raw: string): number | null {
  const s = raw.trim().replace(/^[Uu][Ss][Dd]\s*/, "");
  if (!s || s === "-" || s === "—") return null;
  const n = Number(s.replace(/[$,\s]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100) / 100;
}

/**
 * Split one paste line into [date, price, source?, saleType?].
 * Prefer | or tab when adding source / sale_type.
 */
function splitPasteLine(line: string): string[] {
  const trimmed = line.trim();
  if (!trimmed) return [];

  if (trimmed.includes("|")) {
    return trimmed.split("|").map((c) => c.trim()).filter(Boolean);
  }
  if (trimmed.includes("\t")) {
    const parts = trimmed.split("\t").map((c) => c.trim()).filter(Boolean);
    if (parts.length >= 4) {
      return [parts[0]!, parts[1]!, parts[2]!, parts.slice(3).join(" ")];
    }
    return parts;
  }

  // "2025-11-02, 168.50" / "2025-11-02, $1,250.50" / with optional fields
  if (trimmed.includes(",")) {
    const m = trimmed.match(
      /^(\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{4})\s*,\s*(.+)$/,
    );
    if (m) {
      const date = m[1]!;
      const rest = m[2]!.trim();
      // Optional: price, source, sale_type (sale_type may contain spaces)
      const fieldParts = rest.split(",").map((c) => c.trim()).filter(Boolean);
      if (fieldParts.length === 1) {
        return [date, fieldParts[0]!];
      }
      if (fieldParts.length === 2) {
        // Ambiguous: "$1,250.50" vs "168.50, eBay"
        const maybePrice = normalizeTradePriceUsd(
          `${fieldParts[0]},${fieldParts[1]}`,
        );
        if (maybePrice != null && !/^[A-Za-z]/.test(fieldParts[1]!)) {
          return [date, `${fieldParts[0]},${fieldParts[1]}`];
        }
        return [date, fieldParts[0]!, fieldParts[1]!];
      }
      return [
        date,
        fieldParts[0]!,
        fieldParts[1]!,
        fieldParts.slice(2).join(", "),
      ];
    }
  }

  // Space: "2025-11-02 168.50" or "2025-11-02 $168.50 eBay Buy It Now"
  const spaceParts = trimmed.split(/\s+/).filter(Boolean);
  if (spaceParts.length < 2) return spaceParts;
  if (spaceParts.length === 2) return spaceParts;
  if (spaceParts.length === 3) {
    return [spaceParts[0]!, spaceParts[1]!, spaceParts[2]!];
  }
  return [
    spaceParts[0]!,
    spaceParts[1]!,
    spaceParts[2]!,
    spaceParts.slice(3).join(" "),
  ];
}

/**
 * Parse paste text. Header row optional (skipped if first cell looks like "date"/"traded_on").
 * Defaults: source=eBay, sale_type=Buy It Now.
 */
export function parsePastedTradesText(text: string): ParsePastedTradesResult {
  const lines = text
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n");

  const rows: PastedTradeRow[] = [];
  const skipped: Array<{ line: number; reason: string }> = [];

  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    const raw = lines[i] ?? "";
    if (!raw.trim()) continue;

    const cells = splitPasteLine(raw);
    if (cells.length === 0) continue;

    const head = cells[0]!.toLowerCase();
    if (
      lineNo === 1 &&
      (head === "date" ||
        head === "traded_on" ||
        head === "traded-on" ||
        head === "observed_on" ||
        head.startsWith("date"))
    ) {
      continue;
    }

    if (cells.length < 2) {
      skipped.push({ line: lineNo, reason: "need date and price" });
      continue;
    }

    const tradedOn = normalizeTradeDate(cells[0]!);
    if (!tradedOn) {
      skipped.push({ line: lineNo, reason: `bad date “${cells[0]}”` });
      continue;
    }

    const priceUsd = normalizeTradePriceUsd(cells[1]!);
    if (priceUsd == null) {
      skipped.push({ line: lineNo, reason: `bad price “${cells[1]}”` });
      continue;
    }

    const source = (cells[2]?.trim() || "eBay").slice(0, 64);
    const saleType = (cells[3]?.trim() || "Buy It Now").slice(0, 64);

    rows.push({ line: lineNo, tradedOn, priceUsd, source, saleType });
  }

  return { rows, skipped };
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function buildTradesCsvFromPaste(
  productId: string,
  pasteText: string,
): { csv: string; rowCount: number; skipped: ParsePastedTradesResult["skipped"] } {
  const id = normalizeSampleTradesProductId(productId);
  if (!id) {
    throw new Error("product_id must be a numeric PriceCharting id");
  }
  const { rows, skipped } = parsePastedTradesText(pasteText);
  if (rows.length === 0) {
    throw new Error(
      skipped.length
        ? `No valid trades (skipped ${skipped.length}). Check date/price format.`
        : "Paste at least one trade line (date + price).",
    );
  }

  const lines = ["product_id,traded_on,price,source,sale_type"];
  for (const row of rows) {
    lines.push(
      [
        id,
        row.tradedOn,
        row.priceUsd.toFixed(2),
        csvEscape(row.source),
        csvEscape(row.saleType),
      ].join(","),
    );
  }
  return { csv: `${lines.join("\n")}\n`, rowCount: rows.length, skipped };
}

export function downloadTradesCsvFromPaste(
  productId: string,
  pasteText: string,
): { rowCount: number; skipped: ParsePastedTradesResult["skipped"] } {
  const id = normalizeSampleTradesProductId(productId);
  if (!id) {
    throw new Error("product_id must be a numeric PriceCharting id");
  }
  const { csv, rowCount, skipped } = buildTradesCsvFromPaste(id, pasteText);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `pricecharting-trades-${id}.csv`;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return { rowCount, skipped };
}

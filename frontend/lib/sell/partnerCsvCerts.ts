/** Parse partner bulk CSV — one cert per row (optional header). */
export function parsePartnerCsvCerts(text: string): string[] {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return [];

  const certHeader = /^(cert|certnumber|cert_number|psa\s*cert|cert\s*#)$/i;
  let start = 0;
  const first = splitCsvLine(lines[0]!);
  if (first.some((c) => certHeader.test(c.trim()))) start = 1;

  const out: string[] = [];
  const seen = new Set<string>();
  for (let i = start; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]!);
    const raw = cells[0] ?? lines[i]!;
    const digits = String(raw).replace(/\D/g, "").trim();
    if (digits.length < 7 || digits.length > 10) continue;
    if (seen.has(digits)) continue;
    seen.add(digits);
    out.push(digits);
  }
  return out;
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if ((ch === "," || ch === "\t" || ch === ";") && !inQuotes) {
      cells.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  cells.push(cur.trim());
  return cells;
}


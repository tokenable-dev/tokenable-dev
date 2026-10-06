import { parsePartnerCsvCerts } from "./partnerCsvCerts";

const CERT_HEADER_RE =
  /^(cert|certnumber|cert_number|psa\s*cert|psa\s*cert\s*number|cert\s*#)$/i;

export const PARTNER_EXCEL_TEMPLATE_PATH =
  "/downloads/tokenable-partner-cert-upload-template.xlsx";
export const PARTNER_EXCEL_SAMPLE_PATH =
  "/downloads/tokenable-partner-cert-upload-sample.xlsx";

/** Empty data rows in the template (header + blanks for partners to fill). */
const TEMPLATE_DATA_ROWS = 100;

let xlsxModule: typeof import("xlsx") | null = null;

async function loadXlsx(): Promise<typeof import("xlsx")> {
  if (!xlsxModule) {
    xlsxModule = await import("xlsx");
  }
  return xlsxModule;
}

function normalizeCertDigits(raw: unknown): string | null {
  const digits = String(raw ?? "")
    .replace(/\D/g, "")
    .trim();
  if (digits.length < 7 || digits.length > 10) return null;
  return digits;
}

function uniqueCerts(certs: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const c of certs) {
    if (seen.has(c)) continue;
    seen.add(c);
    out.push(c);
  }
  return out;
}

export async function parsePartnerExcelBuffer(buf: ArrayBuffer): Promise<string[]> {
  const XLSX = await loadXlsx();
  const wb = XLSX.read(new Uint8Array(buf), { type: "array" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return [];
  const sheet = wb.Sheets[sheetName];
  if (!sheet) return [];

  const asObjects = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });

  const out: string[] = [];

  if (asObjects.length) {
    const keys = Object.keys(asObjects[0]!);
    const certKey =
      keys.find((k) => CERT_HEADER_RE.test(k.trim())) ?? keys[0] ?? null;
    if (!certKey) return [];
    for (const row of asObjects) {
      const cert = normalizeCertDigits(row[certKey]);
      if (cert) out.push(cert);
    }
    return uniqueCerts(out);
  }

  const aoa = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, {
    header: 1,
    raw: false,
    defval: "",
  });
  let start = 0;
  const first = aoa[0];
  if (
    Array.isArray(first) &&
    first[0] &&
    CERT_HEADER_RE.test(String(first[0]).trim())
  ) {
    start = 1;
  }
  for (let i = start; i < aoa.length; i++) {
    const row = aoa[i];
    if (!Array.isArray(row)) continue;
    const cert = normalizeCertDigits(row[0]);
    if (cert) out.push(cert);
  }
  return uniqueCerts(out);
}

export async function parsePartnerBulkCertFile(file: File): Promise<string[]> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".numbers")) {
    throw new Error(
      "Apple Numbers (.numbers) cannot be uploaded. In Numbers: File → Export To → Excel…, save as .xlsx, then upload that file.",
    );
  }
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    return parsePartnerExcelBuffer(await file.arrayBuffer());
  }
  return parsePartnerCsvCerts(await file.text());
}

function triggerBrowserDownload(url: string, downloadName: string): void {
  const a = document.createElement("a");
  a.href = url;
  a.download = downloadName;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Static workbook in `public/downloads/` (no client xlsx bundle for download). */
export function downloadPartnerExcelTemplate(): void {
  triggerBrowserDownload(
    PARTNER_EXCEL_TEMPLATE_PATH,
    "tokenable-partner-cert-upload-template.xlsx",
  );
}

export function downloadPartnerExcelSample(): void {
  triggerBrowserDownload(
    PARTNER_EXCEL_SAMPLE_PATH,
    "tokenable-partner-cert-upload-sample.xlsx",
  );
}

/** CSV tab — export certs that failed lookup (Partner-Add-Cards-standalone). */
export function downloadPartnerUnresolvedCerts(certs: string[]): void {
  if (certs.length === 0) return;
  const body = `cert_number\n${certs.join("\n")}`;
  const blob = new Blob([body], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "unresolved-certs.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 500);
}

/** Regenerate `public/downloads/*.xlsx` after changing layout — `node scripts/generate-partner-cert-xlsx.mjs`. */
export const PARTNER_BULK_UPLOAD_TEMPLATE_ROW_COUNT = TEMPLATE_DATA_ROWS;

/** Intentionally broad — macOS Numbers saves as `.numbers` until exported to Excel. */
export const PARTNER_BULK_UPLOAD_ACCEPT =
  ".xlsx,.xls,.csv,.numbers,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

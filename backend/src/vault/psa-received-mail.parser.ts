/**
 * Pure parser for PSA Vault “Items Received” emails.
 * Shipping-instruction mails (print & include…) must return matched: false.
 */

export const PSA_RECEIVED_SUBJECT = 'Items Received at PSA Vault';

const CERT_LINE =
  /(?:^|\n)\s*(\d{7,10})\s*[-–—]\s*.+/gim;

export type PsaReceivedMailParseInput = {
  subject?: string | null;
  from?: string | null;
  bodyText?: string | null;
};

export type PsaReceivedMailParseResult = {
  matched: boolean;
  certs: string[];
  reason?: string;
};

function normalizeCert(raw: string): string {
  return raw.trim().toUpperCase();
}

function isCollectorsFrom(from: string | null | undefined): boolean {
  if (!from?.trim()) return false;
  const lower = from.toLowerCase();
  return (
    lower.includes('noreply@collectors.com') ||
    /@collectors\.com\b/i.test(from)
  );
}

function extractCerts(body: string): string[] {
  const found = new Set<string>();
  for (const m of body.matchAll(CERT_LINE)) {
    const cert = normalizeCert(m[1] ?? '');
    if (/^\d{7,10}$/.test(cert)) found.add(cert);
  }
  return [...found];
}

/**
 * Returns matched:true only for Items Received mails with at least one cert.
 */
export function parsePsaReceivedMail(
  input: PsaReceivedMailParseInput,
): PsaReceivedMailParseResult {
  const subject = (input.subject ?? '').trim();
  const from = input.from ?? '';
  const body = input.bodyText ?? '';

  if (!isCollectorsFrom(from)) {
    return { matched: false, certs: [], reason: 'from_not_collectors' };
  }

  const subjectOk = subject
    .toLowerCase()
    .includes(PSA_RECEIVED_SUBJECT.toLowerCase());
  if (!subjectOk) {
    return { matched: false, certs: [], reason: 'subject_not_items_received' };
  }

  // Shipping-instruction body (even if subject were wrong) — belt & suspenders.
  if (/print this email and include with your submission/i.test(body)) {
    return { matched: false, certs: [], reason: 'shipping_instruction_body' };
  }

  const certs = extractCerts(body);
  if (certs.length === 0) {
    return { matched: false, certs: [], reason: 'no_certs' };
  }

  return { matched: true, certs };
}

/**
 * After Gmail query hit: enqueue for ops, or label-skip as known noise.
 * `no_certs` / unexpected from → enqueue (never silent-drop).
 */
export function decidePsaMailIngest(
  parsed: PsaReceivedMailParseResult,
): 'enqueue' | 'skip_label' {
  if (parsed.matched) return 'enqueue';
  if (
    parsed.reason === 'shipping_instruction_body' ||
    parsed.reason === 'subject_not_items_received'
  ) {
    return 'skip_label';
  }
  return 'enqueue';
}

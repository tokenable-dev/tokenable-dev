/**
 * PSA cert display — public `#****{last4}` vs owner full serial (card_naming_display_spec §7).
 * Public payloads are redacted server-side; this formats UI labels only.
 */

/**
 * Display string for cert chips — preserves API-masked `#****1234` or prefixes full owner serial.
 */
export function formatCertNumberDisplay(
  cert: string | null | undefined,
): string | null {
  const t = cert?.trim();
  if (!t || t === "—") return null;
  if (t.startsWith("#")) return t;
  const digits = t.replace(/\D/g, "");
  if (digits.length >= 4) return `#${digits}`;
  return t;
}

/** `Cert. #****3749` / `Cert. #12563749` */
export function formatCertLabel(cert: string | null | undefined): string | null {
  const formatted = formatCertNumberDisplay(cert);
  return formatted ? `Cert. ${formatted}` : null;
}

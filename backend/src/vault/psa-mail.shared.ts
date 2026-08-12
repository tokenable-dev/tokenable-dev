/**
 * Shared PSA Gmail mail markers — arrival (Ship→PSA) vs vaulted (PSA→Live)
 * share the same subject and are distinguished by body phrase.
 */

export const PSA_ITEMS_RECEIVED_SUBJECT = 'Items Received at PSA Vault';

/** Intake / arrival body — Ship → PSA reviewing. */
export const PSA_ARRIVAL_BODY_MARKER =
  'have been received and securely stored';

/** Vault-confirmation body — PSA reviewing → Live (mint). */
export const PSA_VAULTED_SECURED_MARKER =
  'now secured in your PSA Vault';

export const PSA_CERT_LINE =
  /(?:^|\n)\s*(\d{7,10})\s*[-–—]\s*.+/gim;

export function normalizePsaMailCert(raw: string): string {
  return raw.trim().toUpperCase();
}

export function isPsaCollectorsFrom(from: string | null | undefined): boolean {
  if (!from?.trim()) return false;
  const lower = from.toLowerCase();
  return (
    lower.includes('noreply@collectors.com') ||
    /@collectors\.com\b/i.test(from)
  );
}

export function extractPsaMailCerts(body: string): string[] {
  const found = new Set<string>();
  for (const m of body.matchAll(PSA_CERT_LINE)) {
    const cert = normalizePsaMailCert(m[1] ?? '');
    if (/^\d{7,10}$/.test(cert)) found.add(cert);
  }
  return [...found];
}

export function bodyHasPsaArrivalMarker(body: string): boolean {
  return new RegExp(PSA_ARRIVAL_BODY_MARKER, 'i').test(body);
}

export function bodyHasPsaVaultedSecuredMarker(body: string): boolean {
  return new RegExp(PSA_VAULTED_SECURED_MARKER, 'i').test(body);
}

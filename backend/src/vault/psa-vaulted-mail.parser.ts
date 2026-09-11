/**
 * Pure parser for PSA Vault “Items Vaulted / secured” emails (PSA → Live).
 * Same subject as arrival mail — distinguished by body phrase.
 */

import {
  PSA_ARRIVAL_BODY_MARKER,
  PSA_ITEMS_RECEIVED_SUBJECT,
  PSA_VAULTED_SECURED_MARKER,
  bodyHasPsaArrivalMarker,
  bodyHasPsaVaultedSecuredMarker,
  extractPsaMailCerts,
  isPsaCollectorsFrom,
} from './psa-mail.shared';

export const PSA_VAULTED_BODY_MARKER = PSA_VAULTED_SECURED_MARKER;
export { PSA_ARRIVAL_BODY_MARKER };

export type PsaVaultedMailParseInput = {
  subject?: string | null;
  from?: string | null;
  bodyText?: string | null;
};

export type PsaVaultedMailParseResult = {
  matched: boolean;
  certs: string[];
  reason?: string;
};

/**
 * Returns matched:true only for vault-confirmation mails with at least one cert.
 */
export function parsePsaVaultedMail(
  input: PsaVaultedMailParseInput,
): PsaVaultedMailParseResult {
  const subject = (input.subject ?? '').trim();
  const from = input.from ?? '';
  const body = input.bodyText ?? '';

  if (!isPsaCollectorsFrom(from)) {
    return { matched: false, certs: [], reason: 'from_not_collectors' };
  }

  const subjectOk = subject
    .toLowerCase()
    .includes(PSA_ITEMS_RECEIVED_SUBJECT.toLowerCase());
  if (!subjectOk) {
    return { matched: false, certs: [], reason: 'subject_not_items_received' };
  }

  if (/print this email and include with your submission/i.test(body)) {
    return { matched: false, certs: [], reason: 'shipping_instruction_body' };
  }

  // Both markers — not a clean vaulted confirm; leave for ops.
  if (bodyHasPsaArrivalMarker(body) && bodyHasPsaVaultedSecuredMarker(body)) {
    return { matched: false, certs: [], reason: 'ambiguous_arrival_and_vaulted' };
  }

  // Intake/arrival mail — handled by psa-received-mail, not mint.
  if (bodyHasPsaArrivalMarker(body)) {
    return { matched: false, certs: [], reason: 'arrival_intake_body' };
  }

  if (!bodyHasPsaVaultedSecuredMarker(body)) {
    return { matched: false, certs: [], reason: 'not_vaulted_secured_body' };
  }

  const certs = extractPsaMailCerts(body);
  if (certs.length === 0) {
    return { matched: false, certs: [], reason: 'no_certs' };
  }

  return { matched: true, certs };
}

export function decidePsaVaultedMailIngest(
  parsed: PsaVaultedMailParseResult,
): 'enqueue' | 'skip_label' {
  if (parsed.matched) return 'enqueue';
  if (
    parsed.reason === 'shipping_instruction_body' ||
    parsed.reason === 'subject_not_items_received' ||
    parsed.reason === 'arrival_intake_body' ||
    parsed.reason === 'not_vaulted_secured_body'
  ) {
    return 'skip_label';
  }
  // ambiguous / no_certs / unexpected from — enqueue for ops visibility
  return 'enqueue';
}

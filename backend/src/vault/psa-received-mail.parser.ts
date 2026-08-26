/**
 * Pure parser for PSA Vault “Items Received” (intake/arrival) emails.
 * Shipping-instruction mails (print and include…) must return matched: false.
 * Vault-confirmation (“now secured…”) mails are handled by psa-vaulted-mail.
 */

import {
  PSA_ARRIVAL_BODY_MARKER,
  PSA_ITEMS_RECEIVED_SUBJECT,
  PSA_VAULTED_SECURED_MARKER,
  bodyHasPsaVaultedSecuredMarker,
  extractPsaMailCerts,
  isPsaCollectorsFrom,
} from './psa-mail.shared';

/** @deprecated use PSA_ITEMS_RECEIVED_SUBJECT */
export const PSA_RECEIVED_SUBJECT = PSA_ITEMS_RECEIVED_SUBJECT;
export { PSA_ARRIVAL_BODY_MARKER, PSA_VAULTED_SECURED_MARKER };

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

/**
 * Returns matched:true only for Items Received (intake) mails with at least one cert.
 */
export function parsePsaReceivedMail(
  input: PsaReceivedMailParseInput,
): PsaReceivedMailParseResult {
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

  // Both markers in one body — do not treat as arrival (ops must inspect).
  if (
    bodyHasPsaVaultedSecuredMarker(body) &&
    new RegExp(PSA_ARRIVAL_BODY_MARKER, 'i').test(body)
  ) {
    return { matched: false, certs: [], reason: 'ambiguous_arrival_and_vaulted' };
  }

  // Vault-confirmation mail (same subject) — mint path, not arrival.
  if (bodyHasPsaVaultedSecuredMarker(body)) {
    return { matched: false, certs: [], reason: 'vaulted_secured_body' };
  }

  const certs = extractPsaMailCerts(body);
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
    parsed.reason === 'subject_not_items_received' ||
    parsed.reason === 'vaulted_secured_body'
  ) {
    return 'skip_label';
  }
  // Ambiguous: enqueue so ops can see it (never silent-drop).
  return 'enqueue';
}

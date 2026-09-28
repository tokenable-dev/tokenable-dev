const MAX_VAULT_SUBMISSION_IMAGE_URL_LEN = 2048;

/** Draft sync stores HTTPS preview URLs only — not base64 data URLs. */
export function normalizeVaultSubmissionImageUrl(
  raw?: string | null,
): string | null {
  const t = raw?.trim();
  if (!t) return null;
  if (t.toLowerCase().startsWith('data:')) return null;
  if (!/^https?:\/\//i.test(t)) return null;
  if (t.length > MAX_VAULT_SUBMISSION_IMAGE_URL_LEN) return null;
  return t;
}

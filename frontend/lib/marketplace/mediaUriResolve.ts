/**
 * Whether the URI must be resolved via the backend (no client-side IPFS gateway logic).
 * Plain https URLs without an `/ipfs/` path are loaded as-is (e.g. CDN).
 */
export function uriNeedsBackendResolve(uri: string): boolean {
  const t = uri.trim();
  if (!t) return false;
  if (/^ipfs:\/\//i.test(t)) return true;
  if (/^(Qm[1-9A-HJ-NP-Za-km-z]{40,}|bafy[a-z2-7]{50,})$/i.test(t)) return true;
  if (/^https?:\/\//i.test(t)) {
    try {
      return new URL(t).pathname.includes("/ipfs/");
    } catch {
      return true;
    }
  }
  return true;
}

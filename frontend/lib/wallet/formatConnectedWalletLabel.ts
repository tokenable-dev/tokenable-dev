/**
 * Connected-wallet chip: first **5** chars + omission + **last 3** chars (e.g. `0x351...691`).
 * Render head / tail separately so CSS `truncate` cannot clip the omission.
 */

/** For layouts that render head / gap / tail separately (avoids `truncate` eating `...`). */
export function getConnectedWalletLabelParts(address: string): {
  head: string;
  tail: string;
  full: string;
} | null {
  const raw = address.trim();
  if (!raw.startsWith("0x") || raw.length < 8) return null;
  const a = raw.toLowerCase();
  return { head: a.slice(0, 5), tail: a.slice(-3), full: raw };
}

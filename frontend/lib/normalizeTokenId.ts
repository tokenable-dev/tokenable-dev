/**
 * Decimal tokenId base-10 정규화 (#008 → #8). replace-listing DB 비교·Merkle leaf와 일치시키기 위함.
 */
export function normalizeDecimalTokenId(raw: string | number): string {
  const s = String(raw ?? "").trim();
  if (!/^\d+$/.test(s)) {
    throw new Error("Invalid token ID (expected a non-negative integer).");
  }
  let i = 0;
  while (i < s.length - 1 && s[i] === "0") i++;
  return s.slice(i);
}

export type CrossingAskCandidate = {
  offerer: string;
  considerationAmount: string;
  status?: string;
  side?: string;
  tokenId?: string;
  orderHash?: string;
  startTime?: Date | string;
  endTime?: Date | string;
};

export const BID_CROSSES_ASK_MESSAGE =
  'BID_CROSSES_ASK: This bid meets or exceeds a live ask. Buy the listing instead of placing a bid.';

function parseMicros(raw: string | undefined): bigint {
  try {
    const s = String(raw ?? '').trim();
    if (!s) return 0n;
    return BigInt(s);
  } catch {
    return 0n;
  }
}

function windowOpen(
  row: CrossingAskCandidate,
  nowMs: number,
): boolean {
  const end =
    row.endTime instanceof Date
      ? row.endTime.getTime()
      : Date.parse(String(row.endTime ?? ''));
  if (Number.isFinite(end) && end > 0 && end < nowMs) return false;
  const start =
    row.startTime instanceof Date
      ? row.startTime.getTime()
      : Date.parse(String(row.startTime ?? ''));
  if (Number.isFinite(start) && start > nowMs) return false;
  return true;
}

/** Lowest live ask that `bidMicros` would take (bid ≥ ask), including the bidder’s own listing. */
export function pickCrossingAskForBid(
  asks: CrossingAskCandidate[],
  _bidder: string,
  bidMicros: bigint,
  nowMs = Date.now(),
): CrossingAskCandidate | null {
  if (bidMicros <= 0n) return null;
  const live: Array<{ row: CrossingAskCandidate; price: bigint }> = [];
  const seen = new Set<string>();
  for (const row of asks) {
    const hash = String(row.orderHash ?? '').trim().toLowerCase();
    if (hash && seen.has(hash)) continue;
    if (hash) seen.add(hash);
    if (String(row.status ?? 'active').toLowerCase() !== 'active') continue;
    if (String(row.side ?? 'ask').toLowerCase() === 'bid') continue;
    if (!windowOpen(row, nowMs)) continue;
    const price = parseMicros(row.considerationAmount);
    if (price <= 0n || bidMicros < price) continue;
    live.push({ row, price });
  }
  if (live.length === 0) return null;
  live.sort((a, b) => {
    if (a.price !== b.price) return a.price < b.price ? -1 : 1;
    return String(a.row.tokenId ?? '').localeCompare(
      String(b.row.tokenId ?? ''),
      undefined,
      { numeric: true },
    );
  });
  return live[0]!.row;
}

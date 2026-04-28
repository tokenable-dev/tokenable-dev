import { getMerkleEligibleTokenIds, type Order } from "@/lib/core";
import { SeaportMerkleTree } from "@/lib/seaport/merkle";
import { normalizeDecimalTokenId } from "@/lib/marketplace";
import type { Hex } from "viem";

/**
 * Normalize bytes32 / uint256 Merkle roots from API JSON (0x-hex, bare 64-hex, decimal string, bigint).
 * Mismatches here caused false "root doesn't match" and left bid+ask both on the book.
 */
export function canonicalBytes32Hex(raw: unknown): `0x${string}` | null {
  if (raw == null || raw === "") return null;
  try {
    if (typeof raw === "bigint") {
      return `0x${raw.toString(16).padStart(64, "0")}` as `0x${string}`;
    }
    if (typeof raw === "number") {
      if (!Number.isInteger(raw) || raw < 0) return null;
      return `0x${BigInt(raw).toString(16).padStart(64, "0")}` as `0x${string}`;
    }
    const s0 = String(raw).trim();
    if (!s0) return null;
    const s = s0.toLowerCase();
    if (s.startsWith("0x")) {
      const h = s.slice(2);
      if (!/^[0-9a-f]+$/.test(h)) return null;
      const bn = BigInt(s);
      return `0x${bn.toString(16).padStart(64, "0")}` as `0x${string}`;
    }
    if (/^[0-9a-f]{64}$/.test(s)) {
      return `0x${s}` as `0x${string}`;
    }
    if (/^\d+$/.test(s)) {
      const bn = BigInt(s);
      return `0x${bn.toString(16).padStart(64, "0")}` as `0x${string}`;
    }
  } catch {
    return null;
  }
  return null;
}

/** Token IDs + root for `matchAdvancedOrders` — single source for proof + root equality checks. */
export type MerkleMatchSnapshot = { tokenIds: string[]; rootHex: Hex };

/**
 * Loads the collection Merkle leaf set with aggressive retries (indexing / IPFS lag after a new list).
 */
export async function fetchMerkleSnapshotForMatch(
  collectionKey: string,
  opts?: {
    expectTokenId?: number | string;
    maxAttempts?: number;
    delayMs?: number;
    bypassMerkleCache?: boolean;
  },
): Promise<MerkleMatchSnapshot | null> {
  const max = Math.max(1, opts?.maxAttempts ?? 12);
  const delayMs = opts?.delayMs ?? 220;
  const expectTid =
    opts?.expectTokenId != null ? BigInt(normalizeDecimalTokenId(opts.expectTokenId)) : null;
  const bypass = opts?.bypassMerkleCache ?? false;
  /** Avoid hanging step 4 if the merkle-set endpoint stalls (gateway / server load). */
  const fetchSignal = () =>
    typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function"
      ? AbortSignal.timeout(25_000)
      : undefined;

  for (let i = 0; i < max; i++) {
    let tokenIds: string[];
    try {
      const res = await getMerkleEligibleTokenIds(collectionKey, {
        bypassCache: bypass || i > 0,
        signal: fetchSignal(),
      });
      tokenIds = res.tokenIds;
    } catch (e: unknown) {
      const name = e instanceof Error ? e.name : "";
      const isAbort =
        name === "AbortError" ||
        name === "TimeoutError" ||
        (typeof DOMException !== "undefined" && e instanceof DOMException && e.name === "AbortError");
      if (!isAbort) throw e;
      tokenIds = [];
    }
    const ids = tokenIds.map((x) => BigInt(normalizeDecimalTokenId(x)));
    if (!ids.length) {
      if (i < max - 1) await new Promise((r) => setTimeout(r, delayMs + i * 45));
      continue;
    }
    if (expectTid != null && !ids.some((id) => id === expectTid)) {
      if (i < max - 1) await new Promise((r) => setTimeout(r, delayMs + i * 45));
      continue;
    }
    const rootHex = new SeaportMerkleTree(ids).getHexRoot();
    return { tokenIds, rootHex };
  }
  return null;
}

export async function getCollectionCriteriaMerkleRootHex(
  collectionKey: string,
  opts?: {
    /** When set, retry until this token id appears in the merkle set (post-list indexing). */
    expectTokenId?: number | string;
    maxAttempts?: number;
    delayMs?: number;
    /** Skip server merkle-set cache (fresh IPFS scan) — use after listing / before match. */
    bypassMerkleCache?: boolean;
  },
): Promise<`0x${string}` | null> {
  const snap = await fetchMerkleSnapshotForMatch(collectionKey, {
    expectTokenId: opts?.expectTokenId,
    maxAttempts: opts?.maxAttempts ?? 1,
    delayMs: opts?.delayMs ?? 400,
    bypassMerkleCache: opts?.bypassMerkleCache ?? false,
  });
  return snap?.rootHex ?? null;
}

export function bidMerkleRootMatchesCollection(bid: Order, currentRootHex: string): boolean {
  const raw = bid.parameters?.consideration?.[0]?.identifierOrCriteria;
  const b = canonicalBytes32Hex(raw);
  const c = canonicalBytes32Hex(currentRootHex);
  if (!b || !c) return false;
  return b === c;
}

/**
 * Seaport criteria bids embed one Merkle root at sign time; when new RWAs join the pool the canonical
 * root changes, so older bids cannot `matchAdvancedOrders` until the buyer cancels and re-signs.
 * Returns false when `currentRootHex` is unknown so we don’t flash false warnings during load.
 */
export function isCollectionBidMerkleStale(
  bid: Order,
  currentRootHex: string | null | undefined,
): boolean {
  if (currentRootHex == null || currentRootHex === "") return false;
  return !bidMerkleRootMatchesCollection(bid, currentRootHex);
}

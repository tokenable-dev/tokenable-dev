import { getMerkleEligibleTokenIds, type Order } from "@/lib/api";
import { SeaportMerkleTree } from "@/lib/seaport/merkle";
import { normalizeDecimalTokenId } from "@/lib/normalizeTokenId";

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
  const max = Math.max(1, opts?.maxAttempts ?? 1);
  const delayMs = opts?.delayMs ?? 400;
  const expectTid =
    opts?.expectTokenId != null ? BigInt(normalizeDecimalTokenId(opts.expectTokenId)) : null;
  const bypass = opts?.bypassMerkleCache ?? false;

  for (let i = 0; i < max; i++) {
    const { tokenIds } = await getMerkleEligibleTokenIds(collectionKey, {
      bypassCache: bypass || i > 0,
    });
    const ids = tokenIds.map((x) => BigInt(normalizeDecimalTokenId(x)));
    if (!ids.length) {
      if (i < max - 1) await new Promise((r) => setTimeout(r, delayMs));
      continue;
    }
    if (expectTid != null && !ids.some((id) => id === expectTid)) {
      if (i < max - 1) await new Promise((r) => setTimeout(r, delayMs));
      continue;
    }
    return new SeaportMerkleTree(ids).getHexRoot();
  }
  return null;
}

export function bidMerkleRootMatchesCollection(bid: Order, currentRootHex: string): boolean {
  const raw = bid.parameters?.consideration?.[0]?.identifierOrCriteria;
  const b = canonicalBytes32Hex(raw);
  const c = canonicalBytes32Hex(currentRootHex);
  if (!b || !c) return false;
  return b === c;
}

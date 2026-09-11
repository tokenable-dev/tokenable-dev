import type { Order } from "@/lib/core";
import { normalizeDecimalTokenId } from "@/lib/marketplace";

/** Card-level offer — USDC offer + ERC721 consideration for a specific tokenId. */
export function isTokenBidOrder(order: Pick<Order, "side" | "parameters">): boolean {
  if (order.side !== "bid") return false;
  const offer = order.parameters?.offer?.[0];
  const cons = order.parameters?.consideration?.[0];
  return Number(offer?.itemType) === 1 && Number(cons?.itemType) === 2;
}

/** NFT id this token bid buys — prefer Seaport consideration identifier over the row. */
export function tokenBidTargetTokenId(
  order: Pick<Order, "tokenId" | "parameters">,
): string {
  const ident = order.parameters?.consideration?.[0]?.identifierOrCriteria;
  if (ident != null) {
    const s = String(ident).trim();
    if (s) {
      try {
        return normalizeDecimalTokenId(s);
      } catch {
        /* fall through */
      }
    }
  }
  return normalizeDecimalTokenId(order.tokenId);
}

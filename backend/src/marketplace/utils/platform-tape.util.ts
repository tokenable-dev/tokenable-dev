import { Order, OrderSide } from '../entities/order.entity';

/**
 * Stored on criteria collection bids (`side=bid`, consideration itemType 4).
 * Not the same as ERC-721 tokenId `0` on ask listings.
 */
export const CRITERIA_TOKEN_SENTINEL = '0';

type SeaportItem = {
  itemType?: number;
  identifierOrCriteria?: string;
  startAmount?: string;
};

export function isValidDecimalTokenId(
  raw: string | null | undefined,
): boolean {
  const s = String(raw ?? '').trim();
  return /^\d+$/.test(s);
}

/** Collection criteria bid — USDC offer + ERC721_WITH_CRITERIA consideration. */
export function isBidShapedSeaportParameters(
  parameters: Record<string, unknown>,
): boolean {
  const offer = (parameters as { offer?: SeaportItem[] })?.offer?.[0];
  const cons = (parameters as { consideration?: SeaportItem[] })
    ?.consideration?.[0];
  return Number(offer?.itemType) === 1 && Number(cons?.itemType) === 4;
}

export function isCriteriaCollectionBidOrder(
  order: Pick<Order, 'side' | 'parameters'>,
): boolean {
  if (order.side !== OrderSide.BID) return false;
  return isBidShapedSeaportParameters(order.parameters ?? {});
}

/** Token-level offer — USDC offer + ERC721 consideration for a specific tokenId. */
export function isTokenBidOrder(
  order: Pick<Order, 'side' | 'parameters'>,
): boolean {
  if (order.side !== OrderSide.BID) return false;
  const offer = (order.parameters as { offer?: SeaportItem[] })?.offer?.[0];
  const cons = (order.parameters as { consideration?: SeaportItem[] })
    ?.consideration?.[0];
  return Number(offer?.itemType) === 1 && Number(cons?.itemType) === 2;
}

/** ERC-721 tokenId for fulfilled asks (including mint id `0`). */
export function resolveFulfilledAskTokenId(
  order: Pick<Order, 'tokenId' | 'parameters' | 'side'>,
): string | null {
  if (order.side !== OrderSide.ASK) return null;

  const raw = order.tokenId?.trim();
  if (isValidDecimalTokenId(raw)) return raw!;

  const offer = (order.parameters as { offer?: SeaportItem[] })?.offer;
  const item = offer?.[0];
  if (!item || Number(item.itemType) !== 2) return null;
  const fromOffer = String(item.identifierOrCriteria ?? '').trim();
  if (isValidDecimalTokenId(fromOffer)) return fromOffer;
  return null;
}

/** Fix legacy asks that persisted `token_id` as criteria sentinel instead of real id. */
export function backfillAskTokenIdFromParameters(order: Order): boolean {
  if (order.side !== OrderSide.ASK) return false;
  if (isValidDecimalTokenId(order.tokenId?.trim())) return false;
  const tid = resolveFulfilledAskTokenId(order);
  if (!tid) return false;
  order.tokenId = tid;
  return true;
}

/**
 * Whether a token bid should be treated as dead for book invalidation
 * (underfunded buyer or past Seaport endTime).
 */
export function isDeadTokenBidFunding(params: {
  balance: bigint;
  allowance: bigint;
  needed: bigint;
  nowSec: number;
  endTimeSec: number;
}): { dead: boolean; reason: 'underfunded' | 'expired' | null } {
  if (params.endTimeSec > 0 && params.nowSec >= params.endTimeSec) {
    return { dead: true, reason: 'expired' };
  }
  if (
    params.needed > BigInt(0) &&
    (params.balance < params.needed || params.allowance < params.needed)
  ) {
    return { dead: true, reason: 'underfunded' };
  }
  return { dead: false, reason: null };
}

/** Tape row for fulfilled ask (listing fill) or bid (collection buy / match). */
export function resolvePlatformTapeFill(
  order: Order,
  priceUsdc: number | null,
): { tokenId: string; priceUsdc: number } | null {
  if (priceUsdc == null || !Number.isFinite(priceUsdc) || priceUsdc <= 0) {
    return null;
  }

  if (
    order.side === OrderSide.BID ||
    isBidShapedSeaportParameters(order.parameters)
  ) {
    return { tokenId: '—', priceUsdc };
  }

  const tokenId = resolveFulfilledAskTokenId(order);
  if (!tokenId) return null;
  return { tokenId, priceUsdc };
}

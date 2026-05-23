import { Order, OrderSide } from '../entities/order.entity';

export const CRITERIA_TOKEN_SENTINEL = '0';

type SeaportItem = { itemType?: number; identifierOrCriteria?: string; startAmount?: string };

/** Collection criteria bid — USDC offer + ERC721_WITH_CRITERIA consideration. */
export function isBidShapedSeaportParameters(
  parameters: Record<string, unknown>,
): boolean {
  const offer = (parameters as { offer?: SeaportItem[] })?.offer?.[0];
  const cons = (parameters as { consideration?: SeaportItem[] })?.consideration?.[0];
  return Number(offer?.itemType) === 1 && Number(cons?.itemType) === 4;
}

/** Recover ERC-721 id for fulfilled asks when `token_id` was persisted as "0". */
export function resolveFulfilledAskTokenId(
  order: Pick<Order, 'tokenId' | 'parameters' | 'side'>,
): string | null {
  const raw = order.tokenId?.trim();
  if (raw && raw !== CRITERIA_TOKEN_SENTINEL) return raw;

  const offer = (order.parameters as { offer?: SeaportItem[] })?.offer;
  const item = offer?.[0];
  if (!item || Number(item.itemType) !== 2) return null;
  const fromOffer = String(item.identifierOrCriteria ?? '').trim();
  if (!fromOffer || fromOffer === CRITERIA_TOKEN_SENTINEL) return null;
  return fromOffer;
}

export function backfillAskTokenIdFromParameters(order: Order): boolean {
  if (order.side !== OrderSide.ASK) return false;
  if (order.tokenId && order.tokenId !== CRITERIA_TOKEN_SENTINEL) return false;
  const tid = resolveFulfilledAskTokenId(order);
  if (!tid) return false;
  order.tokenId = tid;
  return true;
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

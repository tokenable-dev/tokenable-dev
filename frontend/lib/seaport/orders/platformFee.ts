import {
  PLATFORM_FEE_BPS,
  PLATFORM_FEE_RECIPIENT,
} from "@/constants/contracts";

export interface FeeSplit {
  sellerAmount: bigint;
  feeAmount: bigint;
  feeRecipient: `0x${string}` | null;
  totalAmount: bigint;
}

/**
 * Splits a total USDC price into seller proceeds + platform fee.
 * When no fee recipient is configured the full amount goes to the seller.
 */
export function computeFeeSplit(totalPriceUnits: bigint): FeeSplit {
  if (!PLATFORM_FEE_RECIPIENT || PLATFORM_FEE_BPS <= 0) {
    return {
      sellerAmount: totalPriceUnits,
      feeAmount: BigInt(0),
      feeRecipient: null,
      totalAmount: totalPriceUnits,
    };
  }

  const feeAmount =
    (totalPriceUnits * BigInt(PLATFORM_FEE_BPS)) / BigInt(10_000);
  const sellerAmount = totalPriceUnits - feeAmount;

  return {
    sellerAmount,
    feeAmount,
    feeRecipient: PLATFORM_FEE_RECIPIENT,
    totalAmount: totalPriceUnits,
  };
}

/**
 * Builds the Seaport `consideration` array for an ask listing.
 * Returns 1 item (seller only) when there is no fee, or 2 items (seller + fee).
 * `usdcAddress` must be the active chain's USDC (never the DEFAULT_CHAIN legacy export).
 */
export function buildAskConsideration(
  totalPriceUnits: bigint,
  sellerAddress: `0x${string}`,
  usdcAddress: `0x${string}`,
) {
  const { sellerAmount, feeAmount, feeRecipient } =
    computeFeeSplit(totalPriceUnits);

  const items: Array<{
    itemType: number;
    token: `0x${string}`;
    identifierOrCriteria: bigint;
    startAmount: bigint;
    endAmount: bigint;
    recipient: `0x${string}`;
  }> = [
    {
      itemType: 1, // ERC20
      token: usdcAddress,
      identifierOrCriteria: BigInt(0),
      startAmount: sellerAmount,
      endAmount: sellerAmount,
      recipient: sellerAddress,
    },
  ];

  if (feeRecipient && feeAmount > BigInt(0)) {
    items.push({
      itemType: 1,
      token: usdcAddress,
      identifierOrCriteria: BigInt(0),
      startAmount: feeAmount,
      endAmount: feeAmount,
      recipient: feeRecipient,
    });
  }

  return items;
}

/**
 * Serialized version for the API payload (string amounts).
 */
export function buildAskConsiderationPayload(
  totalPriceUnits: bigint,
  sellerAddress: string,
  usdcAddress: string,
) {
  const { sellerAmount, feeAmount, feeRecipient } =
    computeFeeSplit(totalPriceUnits);

  const items: Array<{
    itemType: number;
    token: string;
    identifierOrCriteria: string;
    startAmount: string;
    endAmount: string;
    recipient: string;
  }> = [
    {
      itemType: 1,
      token: usdcAddress,
      identifierOrCriteria: "0",
      startAmount: String(sellerAmount),
      endAmount: String(sellerAmount),
      recipient: sellerAddress,
    },
  ];

  if (feeRecipient && feeAmount > BigInt(0)) {
    items.push({
      itemType: 1,
      token: usdcAddress,
      identifierOrCriteria: "0",
      startAmount: String(feeAmount),
      endAmount: String(feeAmount),
      recipient: feeRecipient,
    });
  }

  return items;
}

export function feePercent(): number {
  return PLATFORM_FEE_BPS / 100;
}

export { PLATFORM_FEE_BPS, PLATFORM_FEE_RECIPIENT };

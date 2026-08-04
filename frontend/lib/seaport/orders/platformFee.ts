import {
  PLATFORM_FEE_BPS,
  PLATFORM_FEE_RECIPIENT,
} from "@/constants/contracts";

export type AskSettlementPolicy = "standard" | "self_vault_hold";

export interface FeeSplit {
  sellerAmount: bigint;
  feeAmount: bigint;
  feeRecipient: `0x${string}` | null;
  totalAmount: bigint;
  /** When true, consideration is fee-recipient only (no seller line). */
  fullPlatformTake: boolean;
}

/**
 * Splits a total USDC price into seller proceeds + platform fee.
 * When no fee recipient is configured the full amount goes to the seller.
 * `self_vault_hold` → 100% to platform fee recipient (seller paid later off-protocol).
 */
export function computeFeeSplit(
  totalPriceUnits: bigint,
  policy: AskSettlementPolicy = "standard",
): FeeSplit {
  if (policy === "self_vault_hold") {
    if (!PLATFORM_FEE_RECIPIENT) {
      throw new Error(
        "PLATFORM_FEE_RECIPIENT is required for self-vault hold listings",
      );
    }
    return {
      sellerAmount: BigInt(0),
      feeAmount: totalPriceUnits,
      feeRecipient: PLATFORM_FEE_RECIPIENT,
      totalAmount: totalPriceUnits,
      fullPlatformTake: true,
    };
  }

  if (!PLATFORM_FEE_RECIPIENT || PLATFORM_FEE_BPS <= 0) {
    return {
      sellerAmount: totalPriceUnits,
      feeAmount: BigInt(0),
      feeRecipient: null,
      totalAmount: totalPriceUnits,
      fullPlatformTake: false,
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
    fullPlatformTake: false,
  };
}

type ConsiderationItem = {
  itemType: number;
  token: `0x${string}`;
  identifierOrCriteria: bigint;
  startAmount: bigint;
  endAmount: bigint;
  recipient: `0x${string}`;
};

/**
 * Builds the Seaport `consideration` array for an ask listing.
 * - standard: seller (+ optional fee)
 * - self_vault_hold: single USDC item to platform fee recipient (no $0 seller line)
 */
export function buildAskConsideration(
  totalPriceUnits: bigint,
  sellerAddress: `0x${string}`,
  usdcAddress: `0x${string}`,
  policy: AskSettlementPolicy = "standard",
) {
  const { sellerAmount, feeAmount, feeRecipient, fullPlatformTake } =
    computeFeeSplit(totalPriceUnits, policy);

  if (fullPlatformTake && feeRecipient) {
    return [
      {
        itemType: 1,
        token: usdcAddress,
        identifierOrCriteria: BigInt(0),
        startAmount: feeAmount,
        endAmount: feeAmount,
        recipient: feeRecipient,
      },
    ] satisfies ConsiderationItem[];
  }

  const items: ConsiderationItem[] = [
    {
      itemType: 1,
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
  policy: AskSettlementPolicy = "standard",
) {
  const { sellerAmount, feeAmount, feeRecipient, fullPlatformTake } =
    computeFeeSplit(totalPriceUnits, policy);

  if (fullPlatformTake && feeRecipient) {
    return [
      {
        itemType: 1,
        token: usdcAddress,
        identifierOrCriteria: "0",
        startAmount: String(feeAmount),
        endAmount: String(feeAmount),
        recipient: feeRecipient,
      },
    ];
  }

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

export function feePercent(policy: AskSettlementPolicy = "standard"): number {
  if (policy === "self_vault_hold") return 100;
  return PLATFORM_FEE_BPS / 100;
}

export { PLATFORM_FEE_BPS, PLATFORM_FEE_RECIPIENT };

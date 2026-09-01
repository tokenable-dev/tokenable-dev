import { type Address, type PublicClient, zeroAddress } from "viem";
import { parseUnits } from "viem";
import { getChainContracts, type SupportedChainId } from "@/lib/chains";
import {
  SEAPORT_ADDRESS,
  TOKENABLE_RWA_APPROVE_ABI,
  SEAPORT_ABI,
} from "@/constants/contracts";
import { createOrder, replaceListingApi, type CreateOrderPayload, type Order } from "@/lib/core";
import { GAS_FALLBACK, gasWithCapFast, waitForUserTxReceipt } from "@/lib/network";
import { normalizeDecimalTokenId } from "@/lib/marketplace";
import {
  buildAskConsideration,
  buildAskConsiderationPayload,
  type AskSettlementPolicy,
} from "./platformFee";
import { getChainTimestampSec } from "./seaportOrderTime";
import type { SignSeaportOrderFn } from "@/lib/seaport/signSeaportOrder";
import { getRwaSettlementPolicy } from "@/lib/core";

const ZERO_BYTES32 =
  "0x0000000000000000000000000000000000000000000000000000000000000000" as const;
/** 20-byte zero address — must not use the 32-byte `ZERO_BYTES32` string here. */
const ZERO_ADDRESS = zeroAddress;
const ORDER_DURATION_SECONDS = 30 * 24 * 60 * 60;

type WriteAsync = (args: {
  address: Address;
  abi: typeof TOKENABLE_RWA_APPROVE_ABI;
  functionName: "setApprovalForAll";
  args: readonly [Address, boolean];
  chainId: number;
  gas: bigint;
}) => Promise<`0x${string}`>;

/**
 * Ensure `setApprovalForAll(Seaport, true)` → sign Seaport ask → POST create or replace-listing.
 */
export async function submitAskListingOrder(params: {
  tokenId: string | number;
  priceUsdc: string;
  address: Address;
  publicClient: PublicClient;
  signSeaportOrder: SignSeaportOrderFn;
  writeContractAsync: WriteAsync;
  chainId: SupportedChainId;
  mode: "create" | "replace";
  oldOrderHash?: string;
  /** When omitted, fetched from backend (`rwa_tokens.settlement_policy`). */
  settlementPolicy?: AskSettlementPolicy;
}): Promise<Order> {
  const { priceUsdc, address, publicClient, signSeaportOrder, writeContractAsync, mode, chainId } =
    params;
  const { rwaAddress, usdcAddress } = getChainContracts(chainId);
  const tokenIdStr = normalizeDecimalTokenId(params.tokenId);
  const tokenIdBn = BigInt(tokenIdStr);
  const n = parseFloat(priceUsdc);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error("Invalid price");
  }
  if (mode === "replace" && !params.oldOrderHash) {
    throw new Error("oldOrderHash required for replace");
  }

  const priceInUnits = parseUnits(priceUsdc, 6);
  const salt = BigInt(Math.floor(Math.random() * 1_000_000_000_000));

  const [settlementPolicy, now, counter, alreadyAll] = await Promise.all([
    params.settlementPolicy
      ? Promise.resolve(params.settlementPolicy)
      : getRwaSettlementPolicy(tokenIdStr).then((r) => r.settlementPolicy),
    getChainTimestampSec(publicClient),
    publicClient.readContract({
      address: SEAPORT_ADDRESS,
      abi: SEAPORT_ABI,
      functionName: "getCounter",
      args: [address],
    }),
    publicClient.readContract({
      address: rwaAddress,
      abi: TOKENABLE_RWA_APPROVE_ABI,
      functionName: "isApprovedForAll",
      args: [address, SEAPORT_ADDRESS],
    }),
  ]);
  const endTime = now + BigInt(ORDER_DURATION_SECONDS);

  if (!alreadyAll) {
    const gasSetAll = await gasWithCapFast(
      publicClient,
      {
        address: rwaAddress,
        abi: TOKENABLE_RWA_APPROVE_ABI,
        functionName: "setApprovalForAll",
        args: [SEAPORT_ADDRESS, true],
        account: address,
      },
      GAS_FALLBACK.setApprovalForAll,
    );
    const setAllTx = await writeContractAsync({
      address: rwaAddress,
      abi: TOKENABLE_RWA_APPROVE_ABI,
      functionName: "setApprovalForAll",
      args: [SEAPORT_ADDRESS, true],
      chainId,
      gas: gasSetAll,
    });
    await waitForUserTxReceipt(publicClient, setAllTx);
  }

  const considerationItems = buildAskConsideration(
    priceInUnits,
    address,
    usdcAddress,
    settlementPolicy,
  );

  const orderMessage = {
    offerer: address,
    zone: ZERO_ADDRESS,
    offer: [
      {
        itemType: 2,
        token: rwaAddress,
        identifierOrCriteria: tokenIdBn,
        startAmount: BigInt(1),
        endAmount: BigInt(1),
      },
    ],
    consideration: considerationItems,
    orderType: 0,
    startTime: now,
    endTime: endTime,
    zoneHash: ZERO_BYTES32,
    salt: salt,
    conduitKey: ZERO_BYTES32,
    counter: counter,
  };

  const signature = await signSeaportOrder(orderMessage, address);

  const str = (v: unknown): string => String(v);
  const considerationPayload = buildAskConsiderationPayload(
    priceInUnits,
    address,
    usdcAddress,
    settlementPolicy,
  );
  const payload: CreateOrderPayload = {
    side: "ask",
    parameters: {
      offerer: address,
      zone: ZERO_ADDRESS,
      zoneHash: ZERO_BYTES32,
      startTime: str(now),
      endTime: str(endTime),
      orderType: 0,
      offer: [
        {
          itemType: 2,
          token: rwaAddress,
          identifierOrCriteria: tokenIdStr,
          startAmount: "1",
          endAmount: "1",
        },
      ],
      consideration: considerationPayload,
      totalOriginalConsiderationItems: considerationPayload.length,
      salt: str(salt),
      conduitKey: ZERO_BYTES32,
      counter: str(counter),
    },
    signature,
    tokenContract: rwaAddress,
    tokenId: tokenIdStr,
    considerationToken: usdcAddress,
    considerationAmount: String(priceInUnits),
  };

  if (mode === "replace" && params.oldOrderHash) {
    return replaceListingApi({
      callerAddress: address,
      oldOrderHash: params.oldOrderHash,
      order: payload,
    });
  }
  return createOrder(payload);
}

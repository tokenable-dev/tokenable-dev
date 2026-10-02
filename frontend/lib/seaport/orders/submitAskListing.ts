import { type Address, type PublicClient, zeroAddress } from "viem";
import { parseUnits } from "viem";
import { getChainContracts, type SupportedChainId } from "@/lib/chains";
import { SEAPORT_ADDRESS, SEAPORT_ABI } from "@/constants/contracts";
import { createOrder, replaceListingApi, type CreateOrderPayload, type Order } from "@/lib/core";
import { withRpcReadRetry } from "@/lib/network";
import { normalizeDecimalTokenId } from "@/lib/marketplace";
import {
  buildAskConsideration,
  buildAskConsiderationPayload,
  type AskSettlementPolicy,
} from "./platformFee";
import { getChainTimestampSec } from "./seaportOrderTime";
import type { SignSeaportOrderFn } from "@/lib/seaport/signSeaportOrder";
import { getRwaSettlementPolicy } from "@/lib/core";
import { ensureRwaSeaportListingApproval } from "@/lib/seaport/listing/ensureRwaSeaportListingApproval";
import {
  assertListingWalletOwnsToken,
  readRwaListingOwner,
  readRwaSeaportApprovedForAll,
} from "@/lib/seaport/listing/listingChainPreflight";
import type { ListingSeaportApproveWrite } from "@/lib/seaport/listing/listingSeaportApproveWrite";
import { createListingTimingLogger } from "@/lib/seaport/listing/listingTiming";

export { ensureRwaSeaportListingApproval } from "@/lib/seaport/listing/ensureRwaSeaportListingApproval";

const ZERO_BYTES32 =
  "0x0000000000000000000000000000000000000000000000000000000000000000" as const;
const ZERO_ADDRESS = zeroAddress;
const ORDER_DURATION_SECONDS = 30 * 24 * 60 * 60;

/**
 * Sign Seaport ask → POST create or replace-listing.
 * UI entry points should prefer {@link runListingAskInWalletPhases} (Privy-safe).
 */
export async function submitAskListingOrder(params: {
  tokenId: string | number;
  priceUsdc: string;
  address: Address;
  publicClient: PublicClient;
  signSeaportOrder: SignSeaportOrderFn;
  writeContractAsync: ListingSeaportApproveWrite;
  chainId: SupportedChainId;
  mode: "create" | "replace";
  oldOrderHash?: string;
  settlementPolicy?: AskSettlementPolicy;
  /** Caller already ran `ensureRwaSeaportListingApproval` in a prior wallet phase. */
  skipSeaportApproval?: boolean;
  onBeforeSubmit?: () => void;
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

  const settlementPolicy = params.settlementPolicy
    ? params.settlementPolicy
    : await getRwaSettlementPolicy(tokenIdStr).then((r) => {
        if (!r.settlementPolicy) {
          throw new Error(
            `This card is not registered on the selected network (chain ${chainId}). Switch the header network to the chain where it was minted, or re-mint after resetting marketplace data for the current RWA contract.`,
          );
        }
        return r.settlementPolicy;
      });

  const logStep = createListingTimingLogger();

  const [onChainOwner, now, counter, alreadyAll] = await Promise.all([
    readRwaListingOwner(publicClient, chainId, params.tokenId),
    getChainTimestampSec(publicClient),
    withRpcReadRetry(() =>
      publicClient.readContract({
        address: SEAPORT_ADDRESS,
        abi: SEAPORT_ABI,
        functionName: "getCounter",
        args: [address],
      }),
    ),
    readRwaSeaportApprovedForAll(publicClient, chainId, address),
  ]);
  logStep(`chain reads done (approved=${alreadyAll})`);
  assertListingWalletOwnsToken(onChainOwner, address);
  const endTime = now + BigInt(ORDER_DURATION_SECONDS);

  if (!params.skipSeaportApproval && !alreadyAll) {
    await ensureRwaSeaportListingApproval({
      tokenId: params.tokenId,
      address,
      publicClient,
      writeContractAsync,
      chainId,
    });
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
  logStep("order signed");
  params.onBeforeSubmit?.();

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
      offerer: str(orderMessage.offerer),
      zone: str(ZERO_ADDRESS),
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

  const created =
    mode === "replace" && params.oldOrderHash
      ? await replaceListingApi({
          callerAddress: address,
          oldOrderHash: params.oldOrderHash,
          order: payload,
        })
      : await createOrder(payload);
  logStep("order submitted to backend");
  return created;
}

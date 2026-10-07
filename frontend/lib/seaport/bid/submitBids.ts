import { maxUint256, type Address, type PublicClient, zeroAddress } from "viem";
import { getChainContracts, type SupportedChainId } from "@/lib/chains";
import { SEAPORT_ADDRESS, USDC_ABI } from "@/constants/contracts";
import {
  createOrder,
  getMerkleEligibleTokenIds,
  replaceBidApi,
  type CreateOrderPayload,
  type Order,
} from "@/lib/core";
import { GAS_FALLBACK, gasWithCapFast } from "@/lib/network";
import { normalizeDecimalTokenId } from "@/lib/marketplace";
import {
  BidCrossesLiveAskError,
  fetchCrossingAskForBid,
} from "@/lib/seaport/criteria/collectionCriteriaBidAsk";
import { SeaportMerkleTree } from "@/lib/seaport/merkle";
import { collectionCriteriaSignLeafIds } from "@/lib/seaport/criteria/collectionCriteriaRoot";
import { getChainTimestampSec } from "@/lib/seaport/orders/seaportOrderTime";
import type { SignSeaportOrderFn } from "@/lib/seaport/signSeaportOrder";
import type { BidUsdcSeaportApproveWrite } from "./bidUsdcApproveWrite";
import {
  bidNeedsUsdcSeaportApprove,
  ensureUsdcSeaportBidApprovalAfterSign,
  readUsdcSeaportAllowance,
} from "./ensureUsdcSeaportBidApproval";
import {
  resolveTokenBidDurationDays,
  tokenBidDurationSeconds,
  type TokenBidDurationDays,
} from "./tokenBidDuration";

const ZERO_BYTES32 =
  "0x0000000000000000000000000000000000000000000000000000000000000000" as const;
const ZERO_ADDRESS = zeroAddress;
const ITEM_ERC20 = 1;
const ITEM_ERC721 = 2;
const ITEM_ERC721_WITH_CRITERIA = 4;

export type TokenBidSubmitResult = {
  order: Order;
  outcome: "bid";
};

async function registerSeaportBid(params: {
  address: Address;
  payload: CreateOrderPayload;
  mode: "create" | "replace";
  oldOrderHash?: string;
}): Promise<Order> {
  const { address, payload, mode, oldOrderHash } = params;
  if (mode === "replace" && oldOrderHash) {
    return replaceBidApi({
      callerAddress: address,
      oldOrderHash,
      order: payload,
    });
  }
  return createOrder(payload);
}

type BidSubmitBase = {
  collectionKey: string;
  address: Address;
  publicClient: PublicClient;
  signSeaportOrder: SignSeaportOrderFn;
  writeContractAsync: BidUsdcSeaportApproveWrite;
  bidUnits: bigint;
  counter: bigint;
  usdcAllowanceRaw: bigint | undefined;
  chainId: SupportedChainId;
  durationDays: TokenBidDurationDays;
  mode?: "create" | "replace";
  oldOrderHash?: string;
};

function startUsdcApproveGasEstimate(
  publicClient: PublicClient,
  chainId: SupportedChainId,
  address: Address,
  needsUsdcApprove: boolean,
): Promise<bigint | null> {
  if (!needsUsdcApprove) return Promise.resolve(null);
  const { usdcAddress } = getChainContracts(chainId);
  return gasWithCapFast(
    publicClient,
    {
      address: usdcAddress,
      abi: USDC_ABI,
      functionName: "approve",
      args: [SEAPORT_ADDRESS, maxUint256],
      account: address,
    },
    GAS_FALLBACK.erc20Approve,
  );
}

async function assertBidDoesNotCrossLiveAsk(
  collectionKey: string,
  bidder: Address,
  bidUnits: bigint,
): Promise<void> {
  const crossing = await fetchCrossingAskForBid({
    collectionKey,
    bidder,
    bidUnits,
  });
  if (crossing) {
    throw new BidCrossesLiveAskError(crossing);
  }
}

/**
 * Sign + register a card-level Seaport offer (USDC → specific ERC721 tokenId).
 * UI entry points should pass {@link BidUsdcSeaportApproveWrite} from `useMarketplacePrivyWrites`.
 */
export async function submitTokenBid(
  input: BidSubmitBase & { tokenId: string | number },
): Promise<TokenBidSubmitResult> {
  const {
    collectionKey,
    address,
    publicClient,
    signSeaportOrder,
    writeContractAsync,
    bidUnits,
    counter,
    usdcAllowanceRaw,
    chainId,
    durationDays,
    mode = "create",
    oldOrderHash,
  } = input;

  const { rwaAddress, usdcAddress } = getChainContracts(chainId);
  const tokenIdStr = normalizeDecimalTokenId(input.tokenId);
  const tokenIdBn = BigInt(tokenIdStr);

  if (mode === "replace" && !oldOrderHash) {
    throw new Error("oldOrderHash required for replace");
  }

  await assertBidDoesNotCrossLiveAsk(collectionKey, address, bidUnits);

  const days = resolveTokenBidDurationDays(durationDays);
  const salt = BigInt(Math.floor(Math.random() * 1_000_000_000_000));

  const [now, allowancePre] = await Promise.all([
    getChainTimestampSec(publicClient),
    readUsdcSeaportAllowance(publicClient, chainId, address, usdcAllowanceRaw),
  ]);
  const endTime = now + BigInt(tokenBidDurationSeconds(days));
  const needsUsdcApprove = bidNeedsUsdcSeaportApprove(allowancePre, bidUnits);
  const usdcApproveGasPromise = startUsdcApproveGasEstimate(
    publicClient,
    chainId,
    address,
    needsUsdcApprove,
  );

  const orderMessage = {
    offerer: address,
    zone: ZERO_ADDRESS,
    offer: [
      {
        itemType: ITEM_ERC20,
        token: usdcAddress,
        identifierOrCriteria: BigInt(0),
        startAmount: bidUnits,
        endAmount: bidUnits,
      },
    ],
    consideration: [
      {
        itemType: ITEM_ERC721,
        token: rwaAddress,
        identifierOrCriteria: tokenIdBn,
        startAmount: BigInt(1),
        endAmount: BigInt(1),
        recipient: address,
      },
    ],
    orderType: 0,
    startTime: now,
    endTime: endTime,
    zoneHash: ZERO_BYTES32,
    salt: salt,
    conduitKey: ZERO_BYTES32,
    counter: counter,
  };

  const signature = await signSeaportOrder(orderMessage, address);

  await ensureUsdcSeaportBidApprovalAfterSign({
    address,
    publicClient,
    chainId,
    bidUnits,
    needsUsdcApprove,
    writeContractAsync,
    usdcApproveGasPromise,
  });

  const str = (v: unknown): string => String(v);
  const payload: CreateOrderPayload = {
    side: "bid",
    collectionKey,
    parameters: {
      offerer: str(orderMessage.offerer),
      zone: str(ZERO_ADDRESS),
      zoneHash: ZERO_BYTES32,
      startTime: str(now),
      endTime: str(endTime),
      orderType: 0,
      offer: [
        {
          itemType: ITEM_ERC20,
          token: usdcAddress,
          identifierOrCriteria: "0",
          startAmount: str(bidUnits),
          endAmount: str(bidUnits),
        },
      ],
      consideration: [
        {
          itemType: ITEM_ERC721,
          token: rwaAddress,
          identifierOrCriteria: tokenIdStr,
          startAmount: "1",
          endAmount: "1",
          recipient: address,
        },
      ],
      totalOriginalConsiderationItems: 1,
      salt: str(salt),
      conduitKey: ZERO_BYTES32,
      counter: str(counter),
    },
    signature,
    tokenContract: rwaAddress,
    tokenId: tokenIdStr,
    considerationToken: usdcAddress,
    considerationAmount: str(bidUnits),
  };

  const order = await registerSeaportBid({
    address,
    payload,
    mode,
    oldOrderHash,
  });

  return { order, outcome: "bid" };
}

/**
 * Collection Place Bid: USDC for any minted token in the bucket (Seaport
 * ERC721_WITH_CRITERIA). Empty merkle (catalog-only) signs a sentinel leaf so
 * the bid can rest on the book; it is not fillable until the buyer re-signs
 * after the first mint. A token offer cannot be filled by a different copy.
 */
export async function submitCollectionCriteriaBid(
  input: BidSubmitBase,
): Promise<TokenBidSubmitResult> {
  const {
    collectionKey,
    address,
    publicClient,
    signSeaportOrder,
    writeContractAsync,
    bidUnits,
    counter,
    usdcAllowanceRaw,
    chainId,
    durationDays,
    mode = "create",
    oldOrderHash,
  } = input;

  const { rwaAddress, usdcAddress } = getChainContracts(chainId);

  if (mode === "replace" && !oldOrderHash) {
    throw new Error("oldOrderHash required for replace");
  }

  await assertBidDoesNotCrossLiveAsk(collectionKey, address, bidUnits);

  const merkle = await getMerkleEligibleTokenIds(collectionKey, {
    bypassCache: true,
  });
  const mintedIds = (merkle.tokenIds ?? []).map((x) =>
    BigInt(normalizeDecimalTokenId(x)),
  );
  const ids = collectionCriteriaSignLeafIds(mintedIds);
  const rootHex = new SeaportMerkleTree(ids).getHexRoot();
  const rootBn = BigInt(rootHex);

  const days = resolveTokenBidDurationDays(durationDays);
  const salt = BigInt(Math.floor(Math.random() * 1_000_000_000_000));

  const [now, allowancePre] = await Promise.all([
    getChainTimestampSec(publicClient),
    readUsdcSeaportAllowance(publicClient, chainId, address, usdcAllowanceRaw),
  ]);
  const endTime = now + BigInt(tokenBidDurationSeconds(days));
  const needsUsdcApprove = bidNeedsUsdcSeaportApprove(allowancePre, bidUnits);
  const usdcApproveGasPromise = startUsdcApproveGasEstimate(
    publicClient,
    chainId,
    address,
    needsUsdcApprove,
  );

  const orderMessage = {
    offerer: address,
    zone: ZERO_ADDRESS,
    offer: [
      {
        itemType: ITEM_ERC20,
        token: usdcAddress,
        identifierOrCriteria: BigInt(0),
        startAmount: bidUnits,
        endAmount: bidUnits,
      },
    ],
    consideration: [
      {
        itemType: ITEM_ERC721_WITH_CRITERIA,
        token: rwaAddress,
        identifierOrCriteria: rootBn,
        startAmount: BigInt(1),
        endAmount: BigInt(1),
        recipient: address,
      },
    ],
    orderType: 0,
    startTime: now,
    endTime: endTime,
    zoneHash: ZERO_BYTES32,
    salt: salt,
    conduitKey: ZERO_BYTES32,
    counter: counter,
  };

  const signature = await signSeaportOrder(orderMessage, address);

  await ensureUsdcSeaportBidApprovalAfterSign({
    address,
    publicClient,
    chainId,
    bidUnits,
    needsUsdcApprove,
    writeContractAsync,
    usdcApproveGasPromise,
  });

  const str = (v: unknown): string => String(v);
  const payload: CreateOrderPayload = {
    side: "bid",
    collectionKey,
    parameters: {
      offerer: str(orderMessage.offerer),
      zone: str(ZERO_ADDRESS),
      zoneHash: ZERO_BYTES32,
      startTime: str(now),
      endTime: str(endTime),
      orderType: 0,
      offer: [
        {
          itemType: ITEM_ERC20,
          token: usdcAddress,
          identifierOrCriteria: "0",
          startAmount: str(bidUnits),
          endAmount: str(bidUnits),
        },
      ],
      consideration: [
        {
          itemType: ITEM_ERC721_WITH_CRITERIA,
          token: rwaAddress,
          identifierOrCriteria: rootHex,
          startAmount: "1",
          endAmount: "1",
          recipient: address,
        },
      ],
      totalOriginalConsiderationItems: 1,
      salt: str(salt),
      conduitKey: ZERO_BYTES32,
      counter: str(counter),
    },
    signature,
    tokenContract: rwaAddress,
    tokenId: "0",
    considerationToken: usdcAddress,
    considerationAmount: str(bidUnits),
  };

  const order = await registerSeaportBid({
    address,
    payload,
    mode,
    oldOrderHash,
  });

  return { order, outcome: "bid" };
}

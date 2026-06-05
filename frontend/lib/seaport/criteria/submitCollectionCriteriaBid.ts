import { hexToBigInt, maxUint256, type Address, type PublicClient, type WalletClient } from "viem";
import { sepolia } from "@/config/wagmi";
import {
  SEAPORT_ADDRESS,
  SEAPORT_ABI,
  SEAPORT_ORDER_TYPES,
  TOKENABLE_RWA_ADDRESS,
  USDC_ADDRESS,
  USDC_ABI,
} from "@/constants/contracts";
import { createOrder, replaceBidApi, type CreateOrderPayload, type Order } from "@/lib/core";
import { GAS_FALLBACK, gasWithCapFast } from "@/lib/network";
import { assertMerkleRootBytes32 } from "@/lib/seaport/eip712Uint";
import { SeaportMerkleTree } from "@/lib/seaport/merkle";
import type { MatchWriteContractAsync } from "@/lib/seaport/fulfillment/runCriteriaMatch";
import { getChainTimestampSec } from "@/lib/seaport/orders/seaportOrderTime";
import { tryMatchCriteriaBidAgainstBook } from "@/lib/seaport/criteria/tryMatchCriteriaBidAgainstBook";
import type { useWriteContract } from "wagmi";
import {
  CRITERIA_BID_ITEM_CRITERIA721,
  CRITERIA_BID_ITEM_ERC20,
  CRITERIA_BID_ORDER_DURATION_SECONDS,
  CRITERIA_BID_ZERO_ADDRESS,
  CRITERIA_BID_ZERO_BYTES32,
} from "./collectionCriteriaBidConstants";

export type CollectionCriteriaBidSubmitResult = {
  order: Order;
  outcome: "instant" | "bid";
  fillUsdc?: number;
  matchHint?: string | null;
};

export async function submitCollectionCriteriaBid(input: {
  collectionKey: string;
  address: Address;
  publicClient: PublicClient;
  walletClient: WalletClient;
  writeContractAsync: ReturnType<typeof useWriteContract>["writeContractAsync"];
  bidUnits: bigint;
  merkleLeafTokenIds: string[];
  counter: bigint;
  usdcAllowanceRaw: bigint | undefined;
  activeAsks: Order[];
  mode?: "create" | "replace";
  oldOrderHash?: string;
}): Promise<CollectionCriteriaBidSubmitResult> {
  const {
    collectionKey,
    address,
    publicClient,
    walletClient,
    writeContractAsync,
    bidUnits,
    merkleLeafTokenIds,
    counter,
    usdcAllowanceRaw,
    activeAsks,
    mode = "create",
    oldOrderHash,
  } = input;

  if (mode === "replace" && !oldOrderHash) {
    throw new Error("oldOrderHash required for replace");
  }

  const now = await getChainTimestampSec(publicClient);
  const endTime = now + BigInt(CRITERIA_BID_ORDER_DURATION_SECONDS);
  const salt = BigInt(Math.floor(Math.random() * 1_000_000_000_000));

  const tokenIds = merkleLeafTokenIds.map((x) => BigInt(x));
  const tree = new SeaportMerkleTree(tokenIds);
  const rootHex = tree.getHexRoot();
  assertMerkleRootBytes32(rootHex);
  const merkleRootU256 = hexToBigInt(rootHex);

  let allowancePre = usdcAllowanceRaw;
  if (allowancePre === undefined) {
    allowancePre = await publicClient.readContract({
      address: USDC_ADDRESS,
      abi: USDC_ABI,
      functionName: "allowance",
      args: [address, SEAPORT_ADDRESS],
    });
  }
  const needsUsdcApprove = allowancePre < bidUnits;
  const usdcApproveGasPromise = needsUsdcApprove
    ? gasWithCapFast(
        publicClient,
        {
          address: USDC_ADDRESS,
          abi: USDC_ABI,
          functionName: "approve",
          args: [SEAPORT_ADDRESS, maxUint256],
          account: address,
        },
        GAS_FALLBACK.erc20Approve,
      )
    : Promise.resolve(null as bigint | null);

  const orderMessage = {
    offerer: address,
    zone: CRITERIA_BID_ZERO_ADDRESS,
    offer: [
      {
        itemType: CRITERIA_BID_ITEM_ERC20,
        token: USDC_ADDRESS,
        identifierOrCriteria: BigInt(0),
        startAmount: bidUnits,
        endAmount: bidUnits,
      },
    ],
    consideration: [
      {
        itemType: CRITERIA_BID_ITEM_CRITERIA721,
        token: TOKENABLE_RWA_ADDRESS,
        identifierOrCriteria: merkleRootU256,
        startAmount: BigInt(1),
        endAmount: BigInt(1),
        recipient: address,
      },
    ],
    orderType: 0,
    startTime: now,
    endTime: endTime,
    zoneHash: CRITERIA_BID_ZERO_BYTES32,
    salt: salt,
    conduitKey: CRITERIA_BID_ZERO_BYTES32,
    counter: counter,
  };

  const signature = await walletClient.signTypedData({
    account: address,
    domain: {
      name: "Seaport",
      version: "1.5",
      chainId: sepolia.id,
      verifyingContract: SEAPORT_ADDRESS,
    },
    types: SEAPORT_ORDER_TYPES,
    primaryType: "OrderComponents",
    message: orderMessage as never,
  });

  if (needsUsdcApprove) {
    const allowanceAfterSign = await publicClient.readContract({
      address: USDC_ADDRESS,
      abi: USDC_ABI,
      functionName: "allowance",
      args: [address, SEAPORT_ADDRESS],
    });
    if (allowanceAfterSign < bidUnits) {
      const gasApprove =
        (await usdcApproveGasPromise) ??
        (await gasWithCapFast(
          publicClient,
          {
            address: USDC_ADDRESS,
            abi: USDC_ABI,
            functionName: "approve",
            args: [SEAPORT_ADDRESS, maxUint256],
            account: address,
          },
          GAS_FALLBACK.erc20Approve,
        ));
      await writeContractAsync({
        address: USDC_ADDRESS,
        abi: USDC_ABI,
        functionName: "approve",
        args: [SEAPORT_ADDRESS, maxUint256],
        chainId: sepolia.id,
        gas: gasApprove,
      });
    }
  }

  const str = (v: unknown): string => String(v);
  const payload: CreateOrderPayload = {
    side: "bid",
    collectionKey,
    parameters: {
      offerer: str(orderMessage.offerer),
      zone: str(CRITERIA_BID_ZERO_ADDRESS),
      zoneHash: CRITERIA_BID_ZERO_BYTES32,
      startTime: str(now),
      endTime: str(endTime),
      orderType: 0,
      offer: [
        {
          itemType: CRITERIA_BID_ITEM_ERC20,
          token: USDC_ADDRESS,
          identifierOrCriteria: "0",
          startAmount: str(bidUnits),
          endAmount: str(bidUnits),
        },
      ],
      consideration: [
        {
          itemType: CRITERIA_BID_ITEM_CRITERIA721,
          token: TOKENABLE_RWA_ADDRESS,
          identifierOrCriteria: rootHex,
          startAmount: "1",
          endAmount: "1",
          recipient: address,
        },
      ],
      totalOriginalConsiderationItems: 1,
      salt: str(salt),
      conduitKey: CRITERIA_BID_ZERO_BYTES32,
      counter: str(counter),
    },
    signature,
    tokenContract: TOKENABLE_RWA_ADDRESS,
    tokenId: "0",
    considerationToken: USDC_ADDRESS,
    considerationAmount: str(bidUnits),
  };

  const order =
    mode === "replace" && oldOrderHash
      ? await replaceBidApi({
          callerAddress: address,
          oldOrderHash,
          order: payload,
        })
      : await createOrder(payload);

  const matchWrite = ((args: Parameters<MatchWriteContractAsync>[0]) =>
    writeContractAsync(
      args as Parameters<typeof writeContractAsync>[0],
    )) as MatchWriteContractAsync;

  const matchResult = await tryMatchCriteriaBidAgainstBook({
    bid: order,
    collectionKey,
    address,
    publicClient,
    writeContractAsync: matchWrite,
    listingHints: activeAsks,
  });

  if (matchResult.matched) {
    return {
      order,
      outcome: "instant",
      fillUsdc: matchResult.fillUsdc,
      matchHint: null,
    };
  }
  return {
    order,
    outcome: "bid",
    matchHint: matchResult.hint ?? null,
  };
}

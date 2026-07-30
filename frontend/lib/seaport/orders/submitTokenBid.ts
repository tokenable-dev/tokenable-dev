import { maxUint256, type Address, type PublicClient, zeroAddress } from "viem";
import { getChainContracts, type SupportedChainId } from "@/lib/chains";
import {
  SEAPORT_ADDRESS,
  SEAPORT_ABI,
  USDC_ABI,
} from "@/constants/contracts";
import {
  createOrder,
  replaceBidApi,
  type CreateOrderPayload,
  type Order,
} from "@/lib/core";
import { GAS_FALLBACK, gasWithCapFast } from "@/lib/network";
import { normalizeDecimalTokenId } from "@/lib/marketplace";
import { getChainTimestampSec } from "./seaportOrderTime";
import type { SignSeaportOrderFn } from "@/lib/seaport/signSeaportOrder";
import type { useWriteContract } from "wagmi";

const ZERO_BYTES32 =
  "0x0000000000000000000000000000000000000000000000000000000000000000" as const;
const ZERO_ADDRESS = zeroAddress;
/**
 * Seaport `endTime` window for card-level offers (place bid).
 */
export const TOKEN_BID_ORDER_DURATION_SECONDS = 7 * 24 * 60 * 60;
const ITEM_ERC20 = 1;
const ITEM_ERC721 = 2;

export type TokenBidSubmitResult = {
  order: Order;
  outcome: "bid";
};

/**
 * Sign + register a card-level Seaport offer (USDC → specific ERC721 tokenId).
 */
export async function submitTokenBid(input: {
  collectionKey: string;
  tokenId: string | number;
  address: Address;
  publicClient: PublicClient;
  signSeaportOrder: SignSeaportOrderFn;
  writeContractAsync: ReturnType<typeof useWriteContract>["writeContractAsync"];
  bidUnits: bigint;
  counter: bigint;
  usdcAllowanceRaw: bigint | undefined;
  chainId: SupportedChainId;
  mode?: "create" | "replace";
  oldOrderHash?: string;
}): Promise<TokenBidSubmitResult> {
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
    mode = "create",
    oldOrderHash,
  } = input;

  const { rwaAddress, usdcAddress } = getChainContracts(chainId);
  const tokenIdStr = normalizeDecimalTokenId(input.tokenId);
  const tokenIdBn = BigInt(tokenIdStr);

  if (mode === "replace" && !oldOrderHash) {
    throw new Error("oldOrderHash required for replace");
  }

  const now = await getChainTimestampSec(publicClient);
  const endTime = now + BigInt(TOKEN_BID_ORDER_DURATION_SECONDS);
  const salt = BigInt(Math.floor(Math.random() * 1_000_000_000_000));

  let allowancePre = usdcAllowanceRaw;
  if (allowancePre === undefined) {
    allowancePre = await publicClient.readContract({
      address: usdcAddress,
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
          address: usdcAddress,
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

  if (needsUsdcApprove) {
    const allowanceAfterSign = await publicClient.readContract({
      address: usdcAddress,
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
            address: usdcAddress,
            abi: USDC_ABI,
            functionName: "approve",
            args: [SEAPORT_ADDRESS, maxUint256],
            account: address,
          },
          GAS_FALLBACK.erc20Approve,
        ));
      await writeContractAsync({
        address: usdcAddress,
        abi: USDC_ABI,
        functionName: "approve",
        args: [SEAPORT_ADDRESS, maxUint256],
        chainId,
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

  const order =
    mode === "replace" && oldOrderHash
      ? await replaceBidApi({
          callerAddress: address,
          oldOrderHash,
          order: payload,
        })
      : await createOrder(payload);

  return { order, outcome: "bid" };
}

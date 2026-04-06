import type { Address, PublicClient, WalletClient } from "viem";
import { parseUnits } from "viem";
import { sepolia } from "@/config/wagmi";
import {
  TOKENABLE_RWA_ADDRESS,
  USDC_ADDRESS,
  SEAPORT_ADDRESS,
  TOKENABLE_RWA_APPROVE_ABI,
  SEAPORT_ABI,
  SEAPORT_ORDER_TYPES,
} from "@/constants/contracts";
import { createOrder, replaceListingApi, type CreateOrderPayload, type Order } from "@/lib/api";
import { GAS_FALLBACK, gasWithCapFast } from "@/lib/chainGas";
import { normalizeDecimalTokenId } from "@/lib/normalizeTokenId";

const ZERO_BYTES32 =
  "0x0000000000000000000000000000000000000000000000000000000000000000" as const;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as Address;
const ORDER_DURATION_SECONDS = 30 * 24 * 60 * 60;

type WriteAsync = (args: {
  address: Address;
  abi: typeof TOKENABLE_RWA_APPROVE_ABI;
  functionName: "approve";
  args: readonly [Address, bigint];
  chainId: number;
  gas: bigint;
}) => Promise<`0x${string}`>;

/**
 * Approve RWA (ERC-721) → sign Seaport ask → POST create or replace-listing.
 */
export async function submitAskListingOrder(params: {
  tokenId: string | number;
  priceUsdc: string;
  address: Address;
  publicClient: PublicClient;
  walletClient: WalletClient;
  writeContractAsync: WriteAsync;
  mode: "create" | "replace";
  oldOrderHash?: string;
}): Promise<Order> {
  const { priceUsdc, address, publicClient, walletClient, writeContractAsync, mode } = params;
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
  const counter = await publicClient.readContract({
    address: SEAPORT_ADDRESS,
    abi: SEAPORT_ABI,
    functionName: "getCounter",
    args: [address],
  });
  const now = BigInt(Math.floor(Date.now() / 1000));
  const endTime = now + BigInt(ORDER_DURATION_SECONDS);
  const salt = BigInt(Math.floor(Math.random() * 1_000_000_000_000));

  const approvedFor = await publicClient.readContract({
    address: TOKENABLE_RWA_ADDRESS,
    abi: TOKENABLE_RWA_APPROVE_ABI,
    functionName: "getApproved",
    args: [tokenIdBn],
  });
  const needsNftApprove =
    (approvedFor as string).toLowerCase() !== SEAPORT_ADDRESS.toLowerCase();

  const approveGasPromise = needsNftApprove
    ? gasWithCapFast(
        publicClient,
        {
          address: TOKENABLE_RWA_ADDRESS,
          abi: TOKENABLE_RWA_APPROVE_ABI,
          functionName: "approve",
        args: [SEAPORT_ADDRESS, tokenIdBn],
        account: address,
        },
        GAS_FALLBACK.erc721Approve,
      )
    : Promise.resolve(null as bigint | null);

  const orderMessage = {
    offerer: address,
    zone: ZERO_ADDRESS,
    offer: [
      {
        itemType: 2,
        token: TOKENABLE_RWA_ADDRESS,
        identifierOrCriteria: tokenIdBn,
        startAmount: BigInt(1),
        endAmount: BigInt(1),
      },
    ],
    consideration: [
      {
        itemType: 1,
        token: USDC_ADDRESS,
        identifierOrCriteria: BigInt(0),
        startAmount: priceInUnits,
        endAmount: priceInUnits,
        recipient: address,
      },
    ],
    orderType: 0,
    startTime: now,
    endTime,
    zoneHash: ZERO_BYTES32,
    salt,
    conduitKey: ZERO_BYTES32,
    counter,
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
    message: orderMessage,
  });

  if (needsNftApprove) {
    const gasApprove = (await approveGasPromise) ?? GAS_FALLBACK.erc721Approve;
    await writeContractAsync({
      address: TOKENABLE_RWA_ADDRESS,
      abi: TOKENABLE_RWA_APPROVE_ABI,
      functionName: "approve",
      args: [SEAPORT_ADDRESS, tokenIdBn],
      chainId: sepolia.id,
      gas: gasApprove,
    });
  }

  const str = (v: unknown): string => String(v);
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
          token: TOKENABLE_RWA_ADDRESS,
          identifierOrCriteria: tokenIdStr,
          startAmount: "1",
          endAmount: "1",
        },
      ],
      consideration: [
        {
          itemType: 1,
          token: USDC_ADDRESS,
          identifierOrCriteria: "0",
          startAmount: str(priceInUnits),
          endAmount: str(priceInUnits),
          recipient: address,
        },
      ],
      totalOriginalConsiderationItems: 1,
      salt: str(salt),
      conduitKey: ZERO_BYTES32,
      counter: str(counter),
    },
    signature,
    tokenContract: TOKENABLE_RWA_ADDRESS,
    tokenId: tokenIdStr,
    considerationToken: USDC_ADDRESS,
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

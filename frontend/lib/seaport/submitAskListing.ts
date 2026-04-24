import { type Address, type PublicClient, type WalletClient, zeroAddress } from "viem";
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
import {
  buildAskConsideration,
  buildAskConsiderationPayload,
} from "@/lib/seaport/platformFee";
import { getChainTimestampSec } from "@/lib/seaport/seaportOrderTime";

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
  /** Wall clock can be ahead of `block.timestamp` — Seaport requires `startTime <= now` at fill time. */
  const now = await getChainTimestampSec(publicClient);
  const endTime = now + BigInt(ORDER_DURATION_SECONDS);
  const salt = BigInt(Math.floor(Math.random() * 1_000_000_000_000));

  const [counter, alreadyAll] = await Promise.all([
    publicClient.readContract({
      address: SEAPORT_ADDRESS,
      abi: SEAPORT_ABI,
      functionName: "getCounter",
      args: [address],
    }),
    publicClient.readContract({
      address: TOKENABLE_RWA_ADDRESS,
      abi: TOKENABLE_RWA_APPROVE_ABI,
      functionName: "isApprovedForAll",
      args: [address, SEAPORT_ADDRESS],
    }),
  ]);
  if (!alreadyAll) {
    const gasSetAll = await gasWithCapFast(
      publicClient,
      {
        address: TOKENABLE_RWA_ADDRESS,
        abi: TOKENABLE_RWA_APPROVE_ABI,
        functionName: "setApprovalForAll",
        args: [SEAPORT_ADDRESS, true],
        account: address,
      },
      GAS_FALLBACK.setApprovalForAll,
    );
    const setAllTx = await writeContractAsync({
      address: TOKENABLE_RWA_ADDRESS,
      abi: TOKENABLE_RWA_APPROVE_ABI,
      functionName: "setApprovalForAll",
      args: [SEAPORT_ADDRESS, true],
      chainId: sepolia.id,
      gas: gasSetAll,
    });
    await publicClient.waitForTransactionReceipt({ hash: setAllTx });
  }

  const considerationItems = buildAskConsideration(priceInUnits, address);

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
    consideration: considerationItems,
    orderType: 0,
    startTime: now,
    endTime: endTime,
    zoneHash: ZERO_BYTES32,
    salt: salt,
    conduitKey: ZERO_BYTES32,
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

  const str = (v: unknown): string => String(v);
  const considerationPayload = buildAskConsiderationPayload(priceInUnits, address);
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
      consideration: considerationPayload,
      totalOriginalConsiderationItems: considerationPayload.length,
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

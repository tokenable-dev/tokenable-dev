import type { Address } from "viem";
import { sepolia } from "@/config/wagmi";

/** Must match backend `collection-bid.eip712.ts` */
export const COLLECTION_BID_DOMAIN = {
  name: "TokenableCollectionBid",
  version: "1",
  chainId: sepolia.id,
  verifyingContract: "0x0000000000000000000000000000000000000000" as Address,
} as const;

export const COLLECTION_BID_TYPES = {
  CollectionBid: [
    { name: "bucketKey", type: "bytes32" },
    { name: "considerationAmount", type: "uint256" },
    { name: "endTime", type: "uint256" },
    { name: "buyer", type: "address" },
    { name: "nonce", type: "uint256" },
  ],
} as const;

/** bucketKey from API is 64 hex chars without 0x */
export function bucketKeyToBytes32(bucketKey64: string): `0x${string}` {
  const h = bucketKey64.trim().toLowerCase().replace(/^0x/, "");
  if (!/^[0-9a-f]{64}$/.test(h)) {
    throw new Error("Invalid bucketKey");
  }
  return `0x${h}`;
}

export function randomPoolBidNonce(): string {
  const n =
    BigInt(Date.now()) * BigInt(1000000) +
    BigInt(Math.floor(Math.random() * 1000000));
  return n.toString();
}

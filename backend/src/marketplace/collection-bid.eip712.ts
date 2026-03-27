import { verifyTypedData } from 'ethers';

/** Off-chain commitment: buyer pays `considerationAmount` USDC (min units) for one NFT in `bucketKey` before `endTime`. */
export const COLLECTION_BID_DOMAIN = {
  name: 'TokenableCollectionBid',
  version: '1',
} as const;

export const COLLECTION_BID_TYPES: Record<
  string,
  Array<{ name: string; type: string }>
> = {
  CollectionBid: [
    { name: 'bucketKey', type: 'bytes32' },
    { name: 'considerationAmount', type: 'uint256' },
    { name: 'endTime', type: 'uint256' },
    { name: 'buyer', type: 'address' },
    { name: 'nonce', type: 'uint256' },
  ],
};

export function bucketKeyHexToBytes32(bucketKey64Hex: string): `0x${string}` {
  const h = bucketKey64Hex.trim().toLowerCase().replace(/^0x/, '');
  if (!/^[0-9a-f]{64}$/.test(h)) {
    throw new Error('bucketKey must be 64 hex characters (sha256)');
  }
  return `0x${h}`;
}

export function verifyCollectionBidSignature(params: {
  chainId: number;
  bucketKey64Hex: string;
  considerationAmount: string;
  endTime: string;
  buyer: string;
  nonce: string;
  signature: string;
}): string {
  const domain = {
    ...COLLECTION_BID_DOMAIN,
    chainId: params.chainId,
    verifyingContract: '0x0000000000000000000000000000000000000000' as const,
  };
  const value = {
    bucketKey: bucketKeyHexToBytes32(params.bucketKey64Hex),
    considerationAmount: BigInt(params.considerationAmount),
    endTime: BigInt(params.endTime),
    buyer: params.buyer,
    nonce: BigInt(params.nonce),
  };
  return verifyTypedData(domain, COLLECTION_BID_TYPES, value, params.signature);
}

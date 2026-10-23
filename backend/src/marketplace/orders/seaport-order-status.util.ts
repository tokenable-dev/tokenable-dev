import { Contract, type Provider } from 'ethers';
import { SEAPORT_CANONICAL_ADDRESS } from './seaport-order-hash.util';

const SEAPORT_ORDER_STATUS_ABI = [
  'function getOrderStatus(bytes32 orderHash) view returns (bool isValidated, bool isCancelled, uint256 totalFilled, uint256 totalSize)',
] as const;

export type SeaportFillStatus = {
  isValidated: boolean;
  isCancelled: boolean;
  totalFilled: bigint;
  totalSize: bigint;
};

export async function readSeaportOrderStatus(
  provider: Provider,
  seaportOrderHash: string,
): Promise<SeaportFillStatus> {
  const seaport = new Contract(
    SEAPORT_CANONICAL_ADDRESS,
    SEAPORT_ORDER_STATUS_ABI,
    provider,
  );
  const hash = seaportOrderHash.startsWith('0x')
    ? seaportOrderHash
    : `0x${seaportOrderHash}`;
  const result = (await seaport.getOrderStatus(hash)) as [
    boolean,
    boolean,
    bigint,
    bigint,
  ];
  return {
    isValidated: Boolean(result[0]),
    isCancelled: Boolean(result[1]),
    totalFilled: BigInt(result[2]),
    totalSize: BigInt(result[3]),
  };
}

export function seaportOrderIsFullyFilled(status: SeaportFillStatus): boolean {
  if (status.isCancelled) return false;
  if (status.totalSize === 0n) return false;
  return status.totalFilled >= status.totalSize;
}

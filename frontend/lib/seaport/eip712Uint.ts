import { hexToBigInt, pad, size, toHex, type Hex } from "viem";

/** 2^256 − 1 (bigint literal 없이). */
export const U256_MAX = hexToBigInt(
  "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
);

/**
 * MetaMask Keyring은 `eth_signTypedData_v4`에서 큰 uint256을 Number로 다루다 실패하는 경우가 있습니다.
 * Seaport OrderComponents의 uint256은 **32바이트 0x-hex**로 넣으면 안정적이며,
 * viem `hashTypedData`는 십진 문자열과 동일 해시를 냅니다.
 */
export function u256Hex32(n: bigint): Hex {
  if (n < BigInt(0) || n > U256_MAX) {
    throw new Error("uint256 out of range");
  }
  return pad(toHex(n), { size: 32 });
}

export function assertMerkleRootBytes32(rootHex: Hex): void {
  const bytes = size(rootHex);
  if (bytes !== 32) {
    throw new Error(
      `Invalid Merkle root: expected bytes32 (${bytes} bytes). Refresh or list an asset first.`,
    );
  }
}

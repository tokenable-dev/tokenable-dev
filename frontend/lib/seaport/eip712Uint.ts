import { hexToBigInt, pad, size, toHex, type Hex } from "viem";

/** 2^256 − 1 (bigint literal 없이). */
export const U256_MAX = hexToBigInt(
  "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
);

/**
 * MetaMask Keyring은 `eth_signTypedData_v4`에서 큰 uint256을 Number로 다루다 실패하는 경우가 있습니다.
 * **서명 메시지**에는 가능하면 `bigint`를 그대로 쓰는 편이 좋습니다. 지갑 UI가 토큰 ID 등을
 * `1`처럼 짧게 보여줄 때가 많고, viem은 `uint256`에 bigint·십진 문자열·짧은 0xhex를 동일하게 해시합니다.
 *
 * **32바이트 왼쪽 패딩 hex**는 토큰 ID `1`조차 `0x00…01`로 보여 UX가 나빠지므로, 서명용으로는
 * 지양하고, 정말 필요할 때만(레거시 지갑 이슈 재현 시) 사용하세요.
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

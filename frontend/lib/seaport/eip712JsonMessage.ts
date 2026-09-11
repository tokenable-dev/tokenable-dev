/**
 * EIP-712 typed data passed through JSON (Privy SDK, `eth_signTypedData_v4`) cannot
 * contain `bigint`. Decimal strings hash the same as bigint for uint256 fields.
 */
export function eip712MessageForJsonRpc<T>(message: T): T {
  return JSON.parse(
    JSON.stringify(message, (_key, value: unknown) =>
      typeof value === "bigint" ? value.toString() : value,
    ),
  ) as T;
}

import type { SignTypedDataParams } from "@privy-io/react-auth";
import { SEAPORT_ORDER_TYPES } from "@/constants/contracts";
import { getSeaportOrderDomain, type SupportedChainId } from "@/lib/chains";
import { eip712MessageForJsonRpc } from "@/lib/seaport/eip712JsonMessage";

/** Full EIP-712 type map for JSON-RPC / Privy SDK (includes EIP712Domain). */
const SEAPORT_EIP712_TYPES = {
  EIP712Domain: [
    { name: "name", type: "string" },
    { name: "version", type: "string" },
    { name: "chainId", type: "uint256" },
    { name: "verifyingContract", type: "address" },
  ],
  ...SEAPORT_ORDER_TYPES,
} as const;

/** Build Privy-compatible Seaport OrderComponents typed data from a viem-style order message. */
export function buildSeaportOrderTypedData(
  orderMessage: Record<string, unknown>,
  chainId: SupportedChainId,
): SignTypedDataParams {
  const domain = getSeaportOrderDomain(chainId);
  return {
    domain: {
      name: domain.name,
      version: domain.version,
      chainId: domain.chainId,
      verifyingContract: domain.verifyingContract,
    },
    types: SEAPORT_EIP712_TYPES as unknown as SignTypedDataParams["types"],
    primaryType: "OrderComponents",
    message: eip712MessageForJsonRpc(orderMessage),
  };
}

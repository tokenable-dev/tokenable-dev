import type { Address, WalletClient } from "viem";
import { getSeaportOrderDomain, type SupportedChainId } from "@/lib/chains";
import { SEAPORT_ADDRESS, SEAPORT_ORDER_TYPES } from "@/constants/contracts";
import { DEFAULT_CHAIN_ID } from "@/lib/chains/registry";

export type SignSeaportOrderFn = (
  message: Record<string, unknown>,
  address: Address,
) => Promise<`0x${string}`>;

/** @deprecated Use getSeaportOrderDomain(chainId) */
export const SEAPORT_ORDER_DOMAIN = getSeaportOrderDomain(DEFAULT_CHAIN_ID);

/** External MetaMask (linked via Privy) → wagmi wallet client. */
export function signSeaportOrderWithWalletClient(
  walletClient: WalletClient,
  chainId: SupportedChainId,
): SignSeaportOrderFn {
  const domain = getSeaportOrderDomain(chainId);
  return (message, address) =>
    walletClient.signTypedData({
      account: address,
      domain,
      types: SEAPORT_ORDER_TYPES,
      primaryType: "OrderComponents",
      message: message as never,
    });
}

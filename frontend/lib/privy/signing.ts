import type { SignTypedDataParams } from "@privy-io/react-auth";
import type { Address } from "viem";
import type { SupportedChainId } from "@/lib/chains";
import { buildSeaportOrderTypedData } from "@/lib/seaport/buildSeaportTypedData";
import type { SignSeaportOrderFn } from "@/lib/seaport/signSeaportOrder";

export type PrivySignTypedDataFn = (
  input: SignTypedDataParams,
  options?: { address?: string; uiOptions?: { title?: string; buttonText?: string } },
) => Promise<{ signature: string }>;

/**
 * Privy embedded wallets must use Privy `signTypedData` — never wagmi
 * `walletClient.signTypedData` (opens SignRequestScreen without modal state → crash).
 */
export function createPrivySeaportSigner(
  privySignTypedData: PrivySignTypedDataFn,
  address: Address,
  chainId: SupportedChainId,
): SignSeaportOrderFn {
  return async (message) => {
    const typedData = buildSeaportOrderTypedData(message, chainId);
    const { signature } = await privySignTypedData(typedData, {
      address,
      uiOptions: {
        title: "Sign collection bid",
        buttonText: "Sign and continue",
      },
    });
    return signature as `0x${string}`;
  };
}

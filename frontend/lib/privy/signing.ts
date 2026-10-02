import type { SignTypedDataParams } from "@privy-io/react-auth";
import type { Address } from "viem";
import type { SupportedChainId } from "@/lib/chains";
import { buildSeaportOrderTypedData } from "@/lib/seaport/buildSeaportTypedData";
import type { SignSeaportOrderFn } from "@/lib/seaport/signSeaportOrder";

export type PrivySignTypedDataFn = (
  input: SignTypedDataParams,
  options?: { address?: string; uiOptions?: { title?: string; buttonText?: string } },
) => Promise<{ signature: string }>;

function seaportItemType(
  items: unknown,
): number | undefined {
  const first = Array.isArray(items) ? items[0] : undefined;
  if (!first || typeof first !== "object") return undefined;
  const n = Number((first as { itemType?: unknown }).itemType);
  return Number.isFinite(n) ? n : undefined;
}

/** Privy modal copy — inferred from the Seaport payload, not the call site. */
function privySeaportSignUi(message: Record<string, unknown>): {
  title: string;
  buttonText: string;
} {
  const offerType = seaportItemType(message.offer);
  const consType = seaportItemType(message.consideration);
  if (offerType === 2 && consType === 1) {
    return { title: "Sign listing", buttonText: "Sign and list" };
  }
  if (offerType === 1 && consType === 4) {
    return { title: "Sign collection bid", buttonText: "Sign and continue" };
  }
  if (offerType === 1 && consType === 2) {
    return { title: "Sign offer", buttonText: "Sign and continue" };
  }
  return { title: "Sign order", buttonText: "Sign and continue" };
}

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
      uiOptions: privySeaportSignUi(message),
    });
    return signature as `0x${string}`;
  };
}

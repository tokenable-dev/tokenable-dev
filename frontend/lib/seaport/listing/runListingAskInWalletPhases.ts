import type { Order } from "@/lib/core";
import { runWalletFlow } from "@/lib/privy/session";
import { ensureRwaSeaportListingApproval } from "./ensureRwaSeaportListingApproval";
import type { ListingSeaportApproveWrite } from "./listingSeaportApproveWrite";
import { submitAskListingOrder } from "@/lib/seaport/orders/submitAskListing";

export type ListingAskWalletStep = "approving" | "signing" | "submitting";

export type SubmitAskListingInput = Parameters<typeof submitAskListingOrder>[0];

/**
 * Privy-safe list: approve in one `runWalletFlow`, sign+API in another (avoids #300).
 */
export async function runListingAskInWalletPhases(
  input: SubmitAskListingInput,
  opts: {
    alreadyApprovedForSeaport: boolean;
    onStep?: (step: ListingAskWalletStep) => void;
  },
): Promise<Order> {
  const { alreadyApprovedForSeaport, onStep } = opts;

  if (!alreadyApprovedForSeaport) {
    onStep?.("approving");
    await runWalletFlow(() =>
      ensureRwaSeaportListingApproval({
        tokenId: input.tokenId,
        address: input.address,
        publicClient: input.publicClient,
        writeContractAsync: input.writeContractAsync as ListingSeaportApproveWrite,
        chainId: input.chainId,
      }),
    );
  }

  onStep?.("signing");
  return runWalletFlow(() =>
    submitAskListingOrder({
      ...input,
      skipSeaportApproval: true,
      onBeforeSubmit: () => onStep?.("submitting"),
    }),
  );
}

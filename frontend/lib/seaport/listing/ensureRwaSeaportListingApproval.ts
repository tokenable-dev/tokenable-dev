import type { Address, PublicClient } from "viem";
import type { SupportedChainId } from "@/lib/chains";
import { getChainContracts } from "@/lib/chains";
import { SEAPORT_ADDRESS, TOKENABLE_RWA_APPROVE_ABI } from "@/constants/contracts";
import {
  GAS_FALLBACK,
  gasWithCapFast,
  userTxFees,
  waitForUserTxReceipt,
} from "@/lib/network";
import { pauseAfterWalletPrompt } from "@/lib/privy/wallet";
import {
  assertListingWalletOwnsToken,
  readRwaListingOwner,
  readRwaSeaportApprovedForAll,
} from "./listingChainPreflight";
import { createListingTimingLogger } from "./listingTiming";
import type { ListingSeaportApproveWrite } from "./listingSeaportApproveWrite";

/**
 * First-time list: `setApprovalForAll(Seaport, true)` in its own `runWalletFlow` so Privy
 * modal teardown does not overlap the next sign UI (React #300 at Providers).
 */
export async function ensureRwaSeaportListingApproval(params: {
  tokenId: string | number;
  address: Address;
  publicClient: PublicClient;
  writeContractAsync: ListingSeaportApproveWrite;
  chainId: SupportedChainId;
}): Promise<void> {
  const { address, publicClient, writeContractAsync, chainId } = params;
  const { rwaAddress } = getChainContracts(chainId);
  const logStep = createListingTimingLogger();

  const [onChainOwner, alreadyAll] = await Promise.all([
    readRwaListingOwner(publicClient, chainId, params.tokenId),
    readRwaSeaportApprovedForAll(publicClient, chainId, address),
  ]);
  logStep(`chain reads done (approved=${alreadyAll})`);
  assertListingWalletOwnsToken(onChainOwner, address);

  if (alreadyAll) {
    logStep("Seaport already approved — skip setApprovalForAll");
    return;
  }

  const [gasSetAll, fees] = await Promise.all([
    gasWithCapFast(
      publicClient,
      {
        address: rwaAddress,
        abi: TOKENABLE_RWA_APPROVE_ABI,
        functionName: "setApprovalForAll",
        args: [SEAPORT_ADDRESS, true],
        account: address,
      },
      GAS_FALLBACK.setApprovalForAll,
    ),
    userTxFees(publicClient),
  ]);
  logStep(`approve wallet prompt (tip=${fees.maxPriorityFeePerGas ?? "wallet"})`);
  const setAllTx = await writeContractAsync({
    address: rwaAddress,
    abi: TOKENABLE_RWA_APPROVE_ABI,
    functionName: "setApprovalForAll",
    args: [SEAPORT_ADDRESS, true],
    chainId,
    gas: gasSetAll,
    ...fees,
  });
  logStep(`approve tx sent ${setAllTx}`);
  await waitForUserTxReceipt(publicClient, setAllTx);
  logStep("approve tx confirmed on-chain");
  await pauseAfterWalletPrompt();
}

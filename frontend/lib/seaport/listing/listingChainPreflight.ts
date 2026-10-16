import type { Address, PublicClient } from "viem";
import type { SupportedChainId } from "@/lib/chains";
import { getChainContracts } from "@/lib/chains";
import { SEAPORT_ADDRESS, TOKENABLE_RWA_APPROVE_ABI } from "@/constants/contracts";
import { normalizeDecimalTokenId } from "@/lib/marketplace";
import { withRpcReadRetry } from "@/lib/network";

export function shortWalletLabel(w: string): string {
  return w.length >= 10 ? `${w.slice(0, 6)}…${w.slice(-4)}` : w;
}

export async function readRwaListingOwner(
  publicClient: PublicClient,
  chainId: SupportedChainId,
  tokenId: string | number,
): Promise<Address> {
  const { rwaAddress } = getChainContracts(chainId);
  const tokenIdStr = normalizeDecimalTokenId(tokenId);
  const tokenIdBn = BigInt(tokenIdStr);
  try {
    return await withRpcReadRetry(() =>
      publicClient.readContract({
        address: rwaAddress,
        abi: TOKENABLE_RWA_APPROVE_ABI,
        functionName: "ownerOf",
        args: [tokenIdBn],
      }),
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/invalid token|nonexistent token|owner query for nonexistent/i.test(msg)) {
      throw new Error(
        `Token #${tokenIdStr} does not exist on ${rwaAddress} (chain ${chainId}). ` +
          `Usually the app RWA address does not match the mint contract, or DB rows were left after a redeploy — ` +
          `switch network / align NEXT_PUBLIC_CHAIN_*_RWA with the backend, or run admin “reset for new contract” before minting on a new CA.`,
      );
    }
    throw e;
  }
}

export async function readRwaSeaportApprovedForAll(
  publicClient: PublicClient,
  chainId: SupportedChainId,
  owner: Address,
): Promise<boolean> {
  const { rwaAddress } = getChainContracts(chainId);
  return withRpcReadRetry(() =>
    publicClient.readContract({
      address: rwaAddress,
      abi: TOKENABLE_RWA_APPROVE_ABI,
      functionName: "isApprovedForAll",
      args: [owner, SEAPORT_ADDRESS],
    }),
  );
}

export function assertListingWalletOwnsToken(
  onChainOwner: Address,
  listingWallet: Address,
): void {
  if (onChainOwner.toLowerCase() === listingWallet.toLowerCase()) return;
  throw new Error(
    `Connected wallet ${shortWalletLabel(listingWallet)} does not own this card on-chain (owner is ${shortWalletLabel(onChainOwner)}). ` +
      "Switch to that wallet to list — a failed buy does not move ownership.",
  );
}

"use client";

import { useMarketplaceAdminCustodyNfts } from "@/hooks/marketplace-admin/useMarketplaceAdminCustodyNfts";
import { useAdminDeliverNft } from "@/hooks/marketplace-admin/useAdminDeliverNft";
import { useAppChain } from "@/providers/AppChainProvider";
import { MarketplaceAdminCustodyNftRow } from "./MarketplaceAdminCustodyNftRow";
import { ADMIN_COUNT, ADMIN_LIST } from "./adminUi";
import { MarketplaceAdminPageHeader } from "./MarketplaceAdminPageHeader";

function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function MarketplaceAdminCustodyNftsPage() {
  const { chain } = useAppChain();
  const query = useMarketplaceAdminCustodyNfts();
  const { deliverToken, deliveringTokenId } = useAdminDeliverNft();
  const items = query.data?.items ?? [];
  const custodyWallet = query.data?.custodyWallet;

  return (
    <>
      <MarketplaceAdminPageHeader
        title="Custody NFTs"
        subtitle={`Vault mints on ${chain.label} land in that chain's custody wallet first. Deliver each NFT to the depositor's Tokenable primary linked wallet when ready. Switch network in the top bar to manage another chain.`}
      />

      {custodyWallet ? (
        <p className="mb-4 text-sm text-zinc-600">
          Custody wallet ({chain.shortLabel}):{" "}
          <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs">
            {shortAddr(custodyWallet)}
          </code>
        </p>
      ) : null}

      {query.isLoading ? (
        <p className="text-base text-zinc-700">Loading custody NFTs…</p>
      ) : query.isError ? (
        <p className="text-base text-red-600" role="alert">
          {query.error instanceof Error
            ? query.error.message
            : "Failed to load custody NFTs"}
        </p>
      ) : items.length === 0 ? (
        <p className="text-base text-zinc-700">
          No NFTs are currently held in custody on {chain.label}. New vault mints
          will appear here until delivered to users.
        </p>
      ) : (
        <div className={ADMIN_LIST}>
          <p className={ADMIN_COUNT}>
            {items.length} NFT{items.length === 1 ? "" : "s"} awaiting delivery on{" "}
            {chain.shortLabel}
          </p>
          {items.map((row) => (
            <MarketplaceAdminCustodyNftRow
              key={row.tokenId}
              row={row}
              delivering={deliveringTokenId === row.tokenId}
              onDeliver={() => void deliverToken(row)}
            />
          ))}
        </div>
      )}
    </>
  );
}

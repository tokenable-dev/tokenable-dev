"use client";

import { useMarketplaceAdminCustodyNfts } from "@/hooks/marketplace-admin/useMarketplaceAdminCustodyNfts";
import { useAdminDeliverNft } from "@/hooks/marketplace-admin/useAdminDeliverNft";
import { MarketplaceAdminCustodyNftRow } from "./MarketplaceAdminCustodyNftRow";
import { ADMIN_COUNT, ADMIN_LIST } from "./adminUi";
import { MarketplaceAdminPageHeader } from "./MarketplaceAdminPageHeader";

function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function MarketplaceAdminCustodyNftsPage() {
  const query = useMarketplaceAdminCustodyNfts();
  const { deliverToken, deliveringTokenId } = useAdminDeliverNft();
  const items = query.data?.items ?? [];
  const custodyWallet = query.data?.custodyWallet;

  return (
    <>
      <MarketplaceAdminPageHeader
        title="Custody NFTs"
        subtitle="Vault mints land in the platform custody wallet first. Deliver each NFT to the depositor's Tokenable primary linked wallet when ready."
      />

      {custodyWallet ? (
        <p className="mb-4 text-sm text-zinc-600">
          Custody wallet:{" "}
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
          No NFTs are currently held in custody. New vault mints will appear here until
          delivered to users.
        </p>
      ) : (
        <div className={ADMIN_LIST}>
          <p className={ADMIN_COUNT}>
            {items.length} NFT{items.length === 1 ? "" : "s"} awaiting delivery
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

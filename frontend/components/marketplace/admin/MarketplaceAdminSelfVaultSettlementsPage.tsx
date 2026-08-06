"use client";

import { useState } from "react";
import type { SelfVaultSettlementStatus } from "@/lib/core";
import {
  useAdminSelfVaultSettlementActions,
  useMarketplaceAdminSelfVaultSettlements,
} from "@/hooks/marketplace-admin/useMarketplaceAdminSelfVaultSettlements";
import { useAppChain } from "@/providers/AppChainProvider";
import {
  ADMIN_BTN_SECONDARY,
  ADMIN_COUNT,
  ADMIN_LIST,
  ADMIN_SEGMENT_BTN,
  ADMIN_SEGMENT_BTN_ACTIVE,
  ADMIN_TEXT_ERROR,
} from "./adminUi";
import { MarketplaceAdminPageHeader } from "./MarketplaceAdminPageHeader";
import { MarketplaceAdminSelfVaultSettlementRow } from "./MarketplaceAdminSelfVaultSettlementRow";

type FilterId = "open" | SelfVaultSettlementStatus;

const FILTERS: { id: FilterId; label: string }[] = [
  { id: "open", label: "Needs action" },
  { id: "confirmed", label: "Ready to pay" },
  { id: "pending_confirm", label: "Pending confirm" },
  { id: "paid", label: "Paid" },
  { id: "rejected", label: "Rejected" },
];

export function MarketplaceAdminSelfVaultSettlementsPage() {
  const { chain } = useAppChain();
  const [filter, setFilter] = useState<FilterId>("open");
  const apiStatus =
    filter === "open" ? undefined : (filter as SelfVaultSettlementStatus);
  const query = useMarketplaceAdminSelfVaultSettlements(apiStatus);
  const actions = useAdminSelfVaultSettlementActions();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");

  const rawItems = query.data?.items ?? [];
  const items =
    filter === "open"
      ? rawItems.filter(
          (r) => r.status === "pending_confirm" || r.status === "confirmed",
        )
      : rawItems;

  async function run(id: string, fn: () => Promise<unknown>) {
    setActionError("");
    setBusyId(id);
    try {
      await fn();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <MarketplaceAdminPageHeader
        title="Self-vault payouts"
        subtitle={`After a self-vault sale, USDC lands in the platform fee wallet (100% on-chain). Ops can Pay seller early (~95% USDC), or the backend auto-confirms and pays ~5 minutes after the sale. Reject to skip payout. Active network: ${chain.label}.`}
      />

      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            className={
              filter === f.id ? ADMIN_SEGMENT_BTN_ACTIVE : ADMIN_SEGMENT_BTN
            }
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
        <button
          type="button"
          className={`${ADMIN_BTN_SECONDARY} ml-auto`}
          disabled={actions.backfill.isPending}
          onClick={() => {
            void (async () => {
              setActionError("");
              try {
                const result = await actions.backfill.mutateAsync();
                if (result.created === 0) {
                  setActionError(
                    `No new rows (skipped ${result.skipped}). Confirm the sale was a self-vault ask and buyer holding was seeded.`,
                  );
                }
              } catch (e) {
                setActionError(e instanceof Error ? e.message : String(e));
              }
            })();
          }}
        >
          {actions.backfill.isPending
            ? "Backfilling…"
            : "Backfill missing sales"}
        </button>
      </div>

      {actionError ? (
        <p className={`mb-3 ${ADMIN_TEXT_ERROR}`} role="alert">
          {actionError}
        </p>
      ) : null}

      {query.isLoading ? (
        <p className="text-base text-zinc-700">Loading settlements…</p>
      ) : query.isError ? (
        <p className={ADMIN_TEXT_ERROR} role="alert">
          {query.error instanceof Error
            ? query.error.message
            : "Failed to load settlements"}
        </p>
      ) : items.length === 0 ? (
        <p className="text-base text-zinc-700">
          No self-vault settlements in this filter on {chain.shortLabel}.
        </p>
      ) : (
        <div className={ADMIN_LIST}>
          <p className={ADMIN_COUNT}>
            {items.length} settlement{items.length === 1 ? "" : "s"}
          </p>
          {items.map((row) => (
            <MarketplaceAdminSelfVaultSettlementRow
              key={row.id}
              row={row}
              busy={busyId === row.id}
              onConfirm={() =>
                void run(row.id, () => actions.confirm.mutateAsync(row.id))
              }
              onReject={() => {
                if (
                  !window.confirm(
                    `Reject settlement for token #${row.tokenId}? Seller will not be paid via this ledger.`,
                  )
                ) {
                  return;
                }
                void run(row.id, () => actions.reject.mutateAsync(row.id));
              }}
              onExecutePayout={() => {
                if (
                  !window.confirm(
                    `Send $${(Number(BigInt(row.sellerPayoutUsdc)) / 1e6).toFixed(2)} USDC from the platform fee wallet to the seller?`,
                  )
                ) {
                  return;
                }
                void run(row.id, () =>
                  actions.executePayout.mutateAsync(row.id),
                );
              }}
            />
          ))}
        </div>
      )}
    </>
  );
}

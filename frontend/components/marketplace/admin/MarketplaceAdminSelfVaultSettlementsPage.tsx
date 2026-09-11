"use client";

import { useMemo, useState } from "react";
import type { SelfVaultSettlement, SelfVaultSettlementStatus } from "@/lib/core";
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
  ADMIN_TEXT_MUTED,
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

/** Same token can have multiple open payouts (A→B then B→C before auto-pay). */
function openSaleIndexById(
  items: SelfVaultSettlement[],
): Map<string, { index: number; total: number }> {
  const byToken = new Map<string, SelfVaultSettlement[]>();
  for (const row of items) {
    const key = `${row.tokenContract}:${row.tokenId}`;
    const list = byToken.get(key) ?? [];
    list.push(row);
    byToken.set(key, list);
  }
  const out = new Map<string, { index: number; total: number }>();
  for (const list of byToken.values()) {
    const chronological = [...list].sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
    chronological.forEach((row, i) => {
      out.set(row.id, { index: i + 1, total: chronological.length });
    });
  }
  return out;
}

export function MarketplaceAdminSelfVaultSettlementsPage() {
  const { chain } = useAppChain();
  const [filter, setFilter] = useState<FilterId>("open");
  const query = useMarketplaceAdminSelfVaultSettlements(filter);
  const actions = useAdminSelfVaultSettlementActions();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");

  const items = query.data?.items ?? [];
  const saleIndex = useMemo(() => openSaleIndexById(items), [items]);

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
        subtitle={`Each self-vault sale creates its own payout row (keyed by ask). Resales before auto-pay show as separate rows for the same token. Ops can Pay seller early (~95% USDC), or the backend auto-pays ~5 minutes after each sale. Reject skips that sale’s payout. Active network: ${chain.label}.`}
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
                    `No new rows (skipped ${result.skipped}). Confirm the sale was a self-vault ask and buyer was recorded on fulfill.`,
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
          {filter === "open" ? (
            <p className={`-mt-1 mb-1 text-sm ${ADMIN_TEXT_MUTED}`}>
              Same token with multiple rows = unpaid prior sale + later resale.
              Pay each seller separately.
            </p>
          ) : null}
          {items.map((row) => (
            <MarketplaceAdminSelfVaultSettlementRow
              key={row.id}
              row={row}
              saleIndex={saleIndex.get(row.id)}
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

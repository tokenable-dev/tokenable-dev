"use client";

import { useResolvedMediaUrl } from "@/hooks/media";
import type { AdminCustodyNftRow } from "@/lib/core";
import {
  ADMIN_ARTICLE,
  ADMIN_BTN_PRIMARY,
  ADMIN_COVER_BOX_CARD,
  ADMIN_TEXT_META,
  ADMIN_TEXT_MUTED,
  ADMIN_TEXT_SECONDARY,
} from "./adminUi";

function shortAddr(addr: string | null | undefined): string {
  if (!addr?.trim()) return "—";
  const a = addr.trim();
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export function MarketplaceAdminCustodyNftRow({
  row,
  delivering,
  onDeliver,
}: {
  row: AdminCustodyNftRow;
  delivering: boolean;
  onDeliver: () => void;
}) {
  const { url: imageSrc } = useResolvedMediaUrl(row.resolvedImageUrl);
  const canDeliver =
    !row.burnedAt && !row.hasActiveListing && Boolean(row.recipientPrimaryWallet);

  return (
    <article className={ADMIN_ARTICLE}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className={`${ADMIN_COVER_BOX_CARD} h-28 w-20 shrink-0 overflow-hidden`}>
          {imageSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageSrc} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-zinc-400">
              No image
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-zinc-900">
              Token #{row.tokenId}
            </h3>
            {row.certNumber ? (
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">
                PSA #{row.certNumber}
              </span>
            ) : null}
            {row.vaultCycleStatus ? (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-amber-200">
                {row.vaultCycleStatus}
              </span>
            ) : null}
          </div>

          <p className={`text-sm ${ADMIN_TEXT_SECONDARY}`}>
            {row.displayName?.trim() || "Untitled RWA"}
          </p>

          <dl className={`grid gap-1 text-xs sm:grid-cols-2 ${ADMIN_TEXT_META}`}>
            <div>
              <dt className={ADMIN_TEXT_MUTED}>Custody wallet</dt>
              <dd className="font-mono">{shortAddr(row.custodyWallet)}</dd>
            </div>
            <div>
              <dt className={ADMIN_TEXT_MUTED}>Depositor</dt>
              <dd>
                {row.recipientUserEmail ??
                  row.recipientUserName ??
                  (row.depositedByUserId ? "Unknown user" : "No depositor record")}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className={ADMIN_TEXT_MUTED}>Delivery target (primary linked wallet)</dt>
              <dd className="font-mono break-all">
                {row.recipientPrimaryWallet ?? "No linked wallet"}
              </dd>
            </div>
          </dl>

          {!row.recipientPrimaryWallet ? (
            <p className="text-xs text-amber-700">
              User must sign in with Privy and link an account wallet before delivery.
            </p>
          ) : null}
          {row.hasActiveListing ? (
            <p className="text-xs text-amber-700">
              Active listing must be cancelled before delivery.
            </p>
          ) : null}
        </div>

        <div className="shrink-0 sm:self-center">
          <button
            type="button"
            disabled={!canDeliver || delivering}
            onClick={onDeliver}
            className={ADMIN_BTN_PRIMARY}
          >
            {delivering ? "Delivering…" : "Deliver to user"}
          </button>
        </div>
      </div>
    </article>
  );
}

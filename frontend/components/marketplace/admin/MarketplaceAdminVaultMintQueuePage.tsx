"use client";

import Link from "next/link";
import { useState } from "react";
import {
  useAdminVaultMintQueue,
  useAdminVaultSubmissionMutations,
} from "@/hooks/marketplace-admin/useMarketplaceAdminVaultSubmissions";
import { AdminSectionTitle } from "./AdminAnalyticsWidgets";
import {
  ADMIN_ARTICLE,
  ADMIN_BTN_PRIMARY,
  ADMIN_INPUT,
  ADMIN_PANEL,
  ADMIN_TEXT_ERROR,
  ADMIN_TEXT_META,
  ADMIN_TEXT_MUTED,
  ADMIN_TEXT_SECONDARY,
} from "./adminUi";
import { MarketplaceAdminPageHeader } from "./MarketplaceAdminPageHeader";

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function MarketplaceAdminVaultMintQueuePage() {
  const [q, setQ] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [lastOk, setLastOk] = useState<string | null>(null);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);

  const queueQuery = useAdminVaultMintQueue(q);
  const { mintAndDeliver } = useAdminVaultSubmissionMutations();
  const rows = queueQuery.data ?? [];

  const runMint = async (submissionId: string, itemId: string, cert: string) => {
    if (
      !window.confirm(
        `Mint + deliver cert ${cert} to the depositor’s linked wallet?\n\nThis runs PSA analyze → IPFS → custody mint → transfer (may take ~1–2 min).`,
      )
    ) {
      return;
    }
    setActionError(null);
    setLastOk(null);
    setBusyItemId(itemId);
    try {
      const result = await mintAndDeliver.mutateAsync({
        id: submissionId,
        itemId,
      });
      setLastOk(
        result.adoptedExisting
          ? `Adopted existing token #${result.tokenId}${
              result.alreadyWithUser
                ? " (already in user wallet)"
                : result.deliverTxHash
                  ? `\nDeliver: ${result.deliverTxHash}`
                  : ""
            }\n→ ${result.recipientAddress}`
          : `Token #${result.tokenId} → ${result.recipientAddress}\nMint: ${result.mintTxHash}\nDeliver: ${result.deliverTxHash}`,
      );
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Mint failed");
    } finally {
      setBusyItemId(null);
    }
  };

  return (
    <>
      <MarketplaceAdminPageHeader
        title="Mint queue"
        subtitle="Cards at PSA (reviewing / approved). Mint & deliver sends the NFT to the depositor’s wallet — Live on their portfolio."
      />

      <div className={`${ADMIN_ARTICLE} mb-6`}>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <AdminSectionTitle title="Ready to go live" />
          <p className={`text-sm ${ADMIN_TEXT_MUTED}`}>
            Auto-refreshes ~15s ·{" "}
            <Link
              href="/marketplace/admin/vault/psa-mail"
              className="text-sky-800 underline-offset-2 hover:underline"
            >
              PSA mail
            </Link>
            {" · "}
            <Link
              href="/marketplace/admin/vault/submissions"
              className="text-sky-800 underline-offset-2 hover:underline"
            >
              Submissions
            </Link>
          </p>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          <input
            className={`${ADMIN_INPUT} min-w-[220px] flex-1`}
            placeholder="Search cert, package, email…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        {actionError ? (
          <p className={`mb-3 text-sm ${ADMIN_TEXT_ERROR}`}>{actionError}</p>
        ) : null}
        {lastOk ? (
          <pre
            className={`mb-3 whitespace-pre-wrap rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-900 ${ADMIN_PANEL}`}
          >
            {lastOk}
          </pre>
        ) : null}

        {queueQuery.isPending ? (
          <p className={`text-sm ${ADMIN_TEXT_MUTED}`}>Loading mint queue…</p>
        ) : queueQuery.isError ? (
          <p className={`text-sm ${ADMIN_TEXT_ERROR}`}>
            {queueQuery.error instanceof Error
              ? queueQuery.error.message
              : "Failed to load mint queue"}
          </p>
        ) : rows.length === 0 ? (
          <p className={`text-sm ${ADMIN_TEXT_SECONDARY}`}>
            No cards in PSA reviewing/approved. Confirm arrival on PSA mail first.
          </p>
        ) : (
          <ul className="space-y-3">
            {rows.map((row) => {
              const busy = busyItemId === row.itemId || mintAndDeliver.isPending;
              return (
                <li
                  key={row.itemId}
                  className={`${ADMIN_PANEL} flex flex-wrap items-center gap-4 p-4`}
                >
                  <div className="relative h-16 w-12 shrink-0 overflow-hidden rounded bg-zinc-100">
                    {row.imageUrl ? (
                      <img
                        src={row.imageUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-[10px] text-zinc-400">
                        N/A
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-zinc-900">
                      {row.name?.trim() || `PSA #${row.cert}`}
                    </p>
                    <p className={`text-xs ${ADMIN_TEXT_META}`}>
                      Cert {row.cert}
                      {row.grade ? ` · ${row.grade}` : ""} · {row.itemStatus}
                    </p>
                    <p className={`text-xs ${ADMIN_TEXT_MUTED}`}>
                      {row.publicId} ·{" "}
                      {row.userEmail || row.userName || row.userId} ·{" "}
                      {formatWhen(row.updatedAt)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/marketplace/admin/vault/submissions?q=${encodeURIComponent(row.publicId)}`}
                      className="rounded-lg border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                    >
                      Package
                    </Link>
                    <button
                      type="button"
                      className={ADMIN_BTN_PRIMARY}
                      disabled={busy}
                      onClick={() =>
                        void runMint(row.submissionId, row.itemId, row.cert)
                      }
                    >
                      {busyItemId === row.itemId
                        ? "Minting…"
                        : "Mint & deliver"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}

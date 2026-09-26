"use client";

import Link from "next/link";
import { useState } from "react";
import {
  useAdminPsaVaultedReviews,
  useAdminVaultMintQueue,
  useAdminVaultSubmissionMutations,
} from "@/hooks/marketplace-admin/useMarketplaceAdminVaultSubmissions";
import { AdminSectionTitle } from "./AdminAnalyticsWidgets";
import {
  ADMIN_ARTICLE,
  ADMIN_BTN_PRIMARY,
  ADMIN_BTN_SECONDARY,
  ADMIN_INPUT,
  ADMIN_PANEL,
  ADMIN_SEGMENT,
  ADMIN_SEGMENT_BTN,
  ADMIN_SEGMENT_BTN_ACTIVE,
  ADMIN_TEXT_ERROR,
  ADMIN_TEXT_META,
  ADMIN_TEXT_MUTED,
  ADMIN_TEXT_SECONDARY,
} from "./adminUi";
import { MarketplaceAdminPageHeader } from "./MarketplaceAdminPageHeader";

type VaultedFilter = "pending" | "minted" | "failed" | "dismissed";

const VAULTED_FILTERS: { key: VaultedFilter; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "minted", label: "Processed" },
  { key: "failed", label: "Failed" },
  { key: "dismissed", label: "Dismissed" },
];

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
  const [vaultedFilter, setVaultedFilter] = useState<VaultedFilter>("pending");
  const [actionError, setActionError] = useState<string | null>(null);
  const [lastOk, setLastOk] = useState<string | null>(null);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);

  const queueQuery = useAdminVaultMintQueue(q);
  const vaultedQuery = useAdminPsaVaultedReviews(vaultedFilter);
  const {
    mintAndDeliver,
    mintVaultedReview,
    dismissVaultedReview,
  } = useAdminVaultSubmissionMutations();
  const rows = queueQuery.data ?? [];
  const vaultedRows = vaultedQuery.data ?? [];

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

  const run = async (fn: () => Promise<unknown>) => {
    setActionError(null);
    setLastOk(null);
    try {
      await fn();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Action failed");
    }
  };

  return (
    <>
      <MarketplaceAdminPageHeader
        title="Mint queue"
        subtitle="Ready cards at PSA. Gmail “now secured in your PSA Vault” auto mint and deliver — Processed tab keeps the audit trail."
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
            No cards waiting. Arrival confirm puts cards here; vaulted Gmail
            auto-mints them to Live.
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
                      // eslint-disable-next-line @next/next/no-img-element
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
                        : "Mint and deliver"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className={`${ADMIN_ARTICLE} mb-6`}>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <AdminSectionTitle title="Vaulted mail → Live" />
          <p className={`text-sm ${ADMIN_TEXT_MUTED}`}>
            Audit of Gmail “now secured…” auto / manual mint
          </p>
        </div>

        <div className={`${ADMIN_SEGMENT} mb-4`} role="tablist" aria-label="Vaulted review status">
          {VAULTED_FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              role="tab"
              aria-selected={vaultedFilter === f.key}
              className={
                vaultedFilter === f.key
                  ? ADMIN_SEGMENT_BTN_ACTIVE
                  : ADMIN_SEGMENT_BTN
              }
              onClick={() => setVaultedFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>

        {vaultedQuery.isLoading ? (
          <p className={`text-sm ${ADMIN_TEXT_SECONDARY}`}>Loading vaulted mail…</p>
        ) : vaultedQuery.isError ? (
          <p className={ADMIN_TEXT_ERROR} role="alert">
            Failed to load vaulted reviews
          </p>
        ) : vaultedRows.length === 0 ? (
          <p className={`text-sm ${ADMIN_TEXT_MUTED}`}>
            No {vaultedFilter} vaulted reviews.
          </p>
        ) : (
          <ul className="space-y-3">
            {vaultedRows.map((rev) => (
              <li key={rev.id} className={`${ADMIN_PANEL} p-4`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-zinc-900">
                        {rev.subject ?? "Items Received at PSA Vault"}
                      </p>
                      {rev.mintedVia === "auto" ? (
                        <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-800">
                          Auto-minted
                        </span>
                      ) : rev.mintedVia === "admin" ? (
                        <span className="rounded-md bg-sky-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-sky-800">
                          Manual mint
                        </span>
                      ) : null}
                    </div>
                    <p className={`text-xs ${ADMIN_TEXT_META}`}>
                      {formatWhen(rev.createdAt)}
                      {rev.reviewedAt
                        ? ` · reviewed ${formatWhen(rev.reviewedAt)}`
                        : ""}
                    </p>
                    {rev.ingestNote ? (
                      <p className="text-sm font-medium text-amber-800">
                        Needs attention: {rev.ingestNote}
                      </p>
                    ) : null}
                    {rev.errorSummary ? (
                      <p className="text-sm text-rose-700">{rev.errorSummary}</p>
                    ) : null}
                    <p className={`text-xs ${ADMIN_TEXT_META}`}>
                      Certs: {rev.certs.join(", ") || "—"}
                      {rev.unmatchedCerts.length > 0
                        ? ` · unmatched: ${rev.unmatchedCerts.join(", ")}`
                        : ""}
                    </p>
                    {(rev.mintResults ?? []).length > 0 ? (
                      <ul className="mt-2 space-y-1">
                        {rev.mintResults.map((m, i) => (
                          <li key={`${m.cert}-${i}`} className="text-sm text-zinc-800">
                            {m.ok ? (
                              <>
                                Cert {m.cert}
                                {m.tokenId != null ? ` → token #${m.tokenId}` : ""}
                                {m.publicId ? (
                                  <>
                                    {" · "}
                                    <Link
                                      href={`/marketplace/admin/vault/submissions?q=${encodeURIComponent(m.publicId)}`}
                                      className="font-medium text-sky-800 underline-offset-2 hover:underline"
                                    >
                                      {m.publicId}
                                    </Link>
                                  </>
                                ) : null}
                              </>
                            ) : (
                              <span className="text-rose-700">
                                Cert {m.cert}: {m.error ?? "failed"}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (rev.items ?? []).length > 0 ? (
                      <ul className="mt-2 space-y-1">
                        {rev.items.map((it) => (
                          <li key={it.itemId} className="text-sm text-zinc-800">
                            <Link
                              href={`/marketplace/admin/vault/submissions?q=${encodeURIComponent(it.publicId)}`}
                              className="font-medium text-sky-800 underline-offset-2 hover:underline"
                            >
                              {it.publicId}
                            </Link>
                            <span className={ADMIN_TEXT_MUTED}>
                              {" "}
                              · {it.userEmail ?? it.userName ?? "user"} · cert{" "}
                              {it.cert} · {it.itemStatus}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                  {(vaultedFilter === "pending" || vaultedFilter === "failed") && (
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <button
                        type="button"
                        className={ADMIN_BTN_PRIMARY}
                        disabled={
                          mintVaultedReview.isPending ||
                          dismissVaultedReview.isPending
                        }
                        onClick={() =>
                          void run(() => mintVaultedReview.mutateAsync(rev.id))
                        }
                      >
                        Mint and deliver
                      </button>
                      <button
                        type="button"
                        className={ADMIN_BTN_SECONDARY}
                        disabled={
                          mintVaultedReview.isPending ||
                          dismissVaultedReview.isPending
                        }
                        onClick={() =>
                          void run(() =>
                            dismissVaultedReview.mutateAsync(rev.id),
                          )
                        }
                      >
                        Dismiss
                      </button>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

"use client";

import Link from "next/link";
import { useState } from "react";
import {
  useAdminPsaArrivalReviews,
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

type ReviewFilter = "pending" | "confirmed" | "dismissed";

const FILTERS: { key: ReviewFilter; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "confirmed", label: "Processed" },
  { key: "dismissed", label: "Dismissed" },
];

function confirmBadge(rev: {
  status: string;
  confirmedVia: "auto" | "admin" | null;
}): string | null {
  if (rev.status !== "confirmed") return null;
  if (rev.confirmedVia === "auto") return "Auto-confirmed";
  if (rev.confirmedVia === "admin") return "Confirmed manually";
  return "Confirmed";
}

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

export function MarketplaceAdminPsaMailPage() {
  const [filter, setFilter] = useState<ReviewFilter>("pending");
  const [actionError, setActionError] = useState<string | null>(null);
  const [injectOk, setInjectOk] = useState<string | null>(null);
  const [testCert, setTestCert] = useState("");
  const [testCardLabel, setTestCardLabel] = useState("");

  const arrivalReviewsQuery = useAdminPsaArrivalReviews(filter);
  const { confirmArrivalReview, dismissArrivalReview, injectTestMail, injectVaultedTestMail } =
    useAdminVaultSubmissionMutations();

  const arrivalReviews = arrivalReviewsQuery.data ?? [];
  const busy =
    confirmArrivalReview.isPending ||
    dismissArrivalReview.isPending ||
    injectTestMail.isPending ||
    injectVaultedTestMail.isPending;
  const isPendingTab = filter === "pending";

  const previewCert = testCert.trim() || "86507410";
  const previewLabel =
    testCardLabel.trim() || "TOKENABLE TEST CARD PSA 10";

  const run = async (fn: () => Promise<unknown>) => {
    setActionError(null);
    setInjectOk(null);
    try {
      await fn();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Action failed");
    }
  };

  return (
    <>
      <MarketplaceAdminPageHeader
        title="PSA mail inbox"
        subtitle="Items Received mails from Gmail auto-advance matched packages to At PSA. Incomplete or unmatched mail stays in Pending for manual Confirm or Dismiss."
      />

      <div className={`${ADMIN_ARTICLE} mb-6`}>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <AdminSectionTitle title="Arrival reviews" />
          <p className={`text-sm ${ADMIN_TEXT_MUTED}`}>
            Auto-refreshes ~15s ·{" "}
            <Link
              href="/marketplace/admin/vault/submissions"
              className="text-sky-800 underline-offset-2 hover:underline"
            >
              Open submissions
            </Link>
          </p>
        </div>

        <div className={`${ADMIN_SEGMENT} mb-4`} role="tablist" aria-label="Review status">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              role="tab"
              aria-selected={filter === f.key}
              className={
                filter === f.key ? ADMIN_SEGMENT_BTN_ACTIVE : ADMIN_SEGMENT_BTN
              }
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>

        {actionError ? (
          <p className={`${ADMIN_TEXT_ERROR} mb-3`} role="alert">
            {actionError}
          </p>
        ) : null}
        {injectOk ? (
          <p className="mb-3 text-sm font-medium text-emerald-800" role="status">
            {injectOk}
          </p>
        ) : null}

        {arrivalReviewsQuery.isLoading ? (
          <p className={`text-sm ${ADMIN_TEXT_SECONDARY}`}>Loading mail queue…</p>
        ) : arrivalReviewsQuery.isError ? (
          <p className={ADMIN_TEXT_ERROR} role="alert">
            Failed to load PSA arrival reviews
          </p>
        ) : arrivalReviews.length === 0 ? (
          <p className={`text-sm ${ADMIN_TEXT_MUTED}`}>
            {isPendingTab
              ? "No pending PSA received mails."
              : `No ${filter} reviews.`}
          </p>
        ) : (
          <ul className="space-y-3">
            {arrivalReviews.map((rev) => {
              const badge = confirmBadge(rev);
              return (
              <li key={rev.id} className={`${ADMIN_PANEL} p-4`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-zinc-900">
                        {rev.subject ?? "Items Received at PSA Vault"}
                      </p>
                      {badge ? (
                        <span
                          className={`rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
                            rev.confirmedVia === "auto"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-sky-100 text-sky-800"
                          }`}
                        >
                          {badge}
                        </span>
                      ) : null}
                    </div>
                    <p className={`text-xs ${ADMIN_TEXT_META}`}>
                      {formatWhen(rev.createdAt)}
                      {rev.reviewedAt
                        ? ` · reviewed ${formatWhen(rev.reviewedAt)}`
                        : ""}
                      {rev.fromAddress ? ` · ${rev.fromAddress}` : ""}
                    </p>
                    {rev.ingestNote ? (
                      <p
                        className="text-sm font-medium text-amber-800"
                        role="status"
                      >
                        Needs attention: {rev.ingestNote}
                        {rev.ingestNote === "no_certs"
                          ? " — certs not parsed; check mail format or mark arrived on the package"
                          : ""}
                      </p>
                    ) : null}
                    <p className={`text-xs ${ADMIN_TEXT_META}`}>
                      Certs: {rev.certs.join(", ") || "—"}
                      {rev.unmatchedCerts.length > 0
                        ? ` · unmatched: ${rev.unmatchedCerts.join(", ")}`
                        : ""}
                      {rev.skippedPublicIds.length > 0
                        ? ` · skipped at confirm: ${rev.skippedPublicIds.join(", ")}`
                        : ""}
                    </p>
                    {(rev.packages ?? []).length === 0 ? (
                      <p className={`text-sm ${ADMIN_TEXT_SECONDARY}`}>
                        No open in-transit package matched these certs yet. Use{" "}
                        <Link
                          href="/marketplace/admin/vault/submissions"
                          className="text-sky-800 underline-offset-2 hover:underline"
                        >
                          Submissions → Mark arrived
                        </Link>
                        , or Dismiss if false positive.
                      </p>
                    ) : (
                      <ul className="mt-2 space-y-1">
                        {rev.packages.map((pkg) => (
                          <li
                            key={pkg.publicId}
                            className="text-sm text-zinc-800"
                          >
                            <Link
                              href={`/marketplace/admin/vault/submissions?q=${encodeURIComponent(pkg.publicId)}`}
                              className="font-medium text-sky-800 underline-offset-2 hover:underline"
                            >
                              {pkg.publicId}
                            </Link>
                            <span className={ADMIN_TEXT_MUTED}>
                              {" "}
                              · {pkg.userEmail ?? pkg.userName ?? "user"} ·{" "}
                              {pkg.status} · certs {pkg.certs.join(", ")}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  {isPendingTab ? (
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <button
                        type="button"
                        className={ADMIN_BTN_PRIMARY}
                        disabled={busy || (rev.packages ?? []).length === 0}
                        onClick={() =>
                          void run(() =>
                            confirmArrivalReview.mutateAsync(rev.id),
                          )
                        }
                      >
                        Confirm → At PSA
                      </button>
                      <button
                        type="button"
                        className={ADMIN_BTN_SECONDARY}
                        disabled={busy}
                        onClick={() =>
                          void run(() =>
                            dismissArrivalReview.mutateAsync(rev.id),
                          )
                        }
                      >
                        Dismiss
                      </button>
                    </div>
                  ) : (
                    <p className={`text-xs ${ADMIN_TEXT_MUTED} shrink-0`}>
                      {rev.status}
                      {badge ? ` · ${badge}` : ""}
                    </p>
                  )}
                </div>
              </li>
            );
            })}
          </ul>
        )}
      </div>

      <div className={`${ADMIN_ARTICLE} mb-6`}>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <AdminSectionTitle title="Send test Items Received mail" />
          <p className={`text-sm ${ADMIN_TEXT_MUTED}`}>
            Inserts into Gmail + runs one poll · requires{" "}
            <code className="text-xs">PSA_RECEIVED_MAIL_TEST_INJECT=1</code>
          </p>
        </div>
        <form
          className={`${ADMIN_PANEL} space-y-3 p-4`}
          onSubmit={(e) => {
            e.preventDefault();
            const cert = testCert.trim();
            if (!/^\d{7,10}$/.test(cert)) {
              setActionError("Cert must be 7–10 digits (from an in_transit package).");
              return;
            }
            void run(async () => {
              const res = await injectTestMail.mutateAsync({
                cert,
                cardLabel: testCardLabel.trim() || undefined,
              });
              setFilter("pending");
              setInjectOk(
                `Injected message ${res.messageId} · poll queued ${res.poll.queued.length} review(s)`,
              );
            });
          }}
        >
          <label className="block space-y-1">
            <span className={`text-sm font-medium text-zinc-800`}>
              Cert number (in_transit package)
            </span>
            <input
              className={ADMIN_INPUT}
              inputMode="numeric"
              autoComplete="off"
              placeholder="e.g. 86507410"
              value={testCert}
              onChange={(e) => setTestCert(e.target.value)}
              disabled={busy}
            />
          </label>
          <label className="block space-y-1">
            <span className={`text-sm font-medium text-zinc-800`}>
              Card label (optional)
            </span>
            <input
              className={ADMIN_INPUT}
              autoComplete="off"
              placeholder="2023 POKEMON … PIKACHU/GREY FELT HAT PSA 10"
              value={testCardLabel}
              onChange={(e) => setTestCardLabel(e.target.value)}
              disabled={busy}
            />
          </label>
          <div className={`rounded-md bg-zinc-50 p-3 text-xs ${ADMIN_TEXT_META}`}>
            <p className="mb-1 font-medium text-zinc-700">Mail preview (arrival → At PSA)</p>
            <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-zinc-600">
              {`From: PSA Vault <noreply@collectors.com>
Subject: Items Received at PSA Vault

Items Vaulted
Your items have been received and securely stored in your vault.

${previewCert} - ${previewLabel}`}
            </pre>
          </div>
          <button
            type="submit"
            className={ADMIN_BTN_PRIMARY}
            disabled={busy || !testCert.trim()}
          >
            {injectTestMail.isPending
              ? "Sending and polling…"
              : "Send test arrival mail and poll"}
          </button>
        </form>
      </div>

      <div className={`${ADMIN_ARTICLE} mb-6`}>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <AdminSectionTitle title="Send test Items Vaulted (secured) mail" />
          <p className={`text-sm ${ADMIN_TEXT_MUTED}`}>
            Auto mint and deliver · requires{" "}
            <code className="text-xs">PSA_RECEIVED_MAIL_TEST_INJECT=1</code>{" "}
            (or{" "}
            <code className="text-xs">PSA_VAULTED_MAIL_TEST_INJECT=1</code>) ·
            cert must be on a{" "}
            <Link
              href="/marketplace/admin/vault/mint-queue"
              className="text-sky-800 underline-offset-2 hover:underline"
            >
              mint-queue
            </Link>{" "}
            item
          </p>
        </div>
        <form
          className={`${ADMIN_PANEL} space-y-3 p-4`}
          onSubmit={(e) => {
            e.preventDefault();
            const cert = testCert.trim();
            if (!/^\d{7,10}$/.test(cert)) {
              setActionError(
                "Cert must be 7–10 digits (from a psa_reviewing mint-queue item).",
              );
              return;
            }
            void run(async () => {
              const res = await injectVaultedTestMail.mutateAsync({
                cert,
                cardLabel: testCardLabel.trim() || undefined,
              });
              setInjectOk(
                `Injected vaulted message ${res.messageId} · queued ${res.poll.queued.length} · auto-minted ${res.poll.minted.length}`,
              );
            });
          }}
        >
          <p className={`text-sm ${ADMIN_TEXT_SECONDARY}`}>
            Reuses the cert / label fields above. Body uses “now secured in your
            PSA Vault” so the vaulted poller (not arrival) picks it up.
          </p>
          <div className={`rounded-md bg-zinc-50 p-3 text-xs ${ADMIN_TEXT_META}`}>
            <p className="mb-1 font-medium text-zinc-700">Mail preview (vaulted → Live)</p>
            <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-zinc-600">
              {`From: PSA Vault <noreply@collectors.com>
Subject: Items Received at PSA Vault

Items Vaulted
The following items are now secured in your PSA Vault.

${previewCert} - ${previewLabel}`}
            </pre>
          </div>
          <button
            type="submit"
            className={ADMIN_BTN_PRIMARY}
            disabled={busy || !testCert.trim()}
          >
            {injectVaultedTestMail.isPending
              ? "Sending, polling and minting…"
              : "Send test vaulted mail and poll"}
          </button>
        </form>
      </div>
    </>
  );
}

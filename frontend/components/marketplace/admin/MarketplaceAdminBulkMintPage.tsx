"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getAdminBulkMintJob,
  getAdminPartnerInventory,
  listAdminBulkMintJobs,
  listAdminMarketplacePartners,
  postAdminBulkMintCancelListing,
  postAdminBulkMintCommit,
  postAdminBulkMintJobFile,
  postAdminBulkMintJobJson,
  postAdminBulkMintPrepare,
  rq,
  type AdminBulkMintJob,
  type AdminBulkMintJobItem,
  type AdminBulkMintJobSummary,
  type AdminPartnerInventoryItem,
} from "@/lib/core";
import {
  ADMIN_ARTICLE,
  ADMIN_BTN_PRIMARY,
  ADMIN_BTN_SECONDARY,
  ADMIN_INPUT,
  ADMIN_INPUT_MONO,
  ADMIN_LABEL,
  ADMIN_PAGE_SUBTITLE,
  ADMIN_PANEL,
  ADMIN_TEXT_ERROR,
  ADMIN_TEXT_MUTED,
  ADMIN_TEXT_SECONDARY,
} from "./adminUi";
import { MarketplaceAdminPageHeader } from "./MarketplaceAdminPageHeader";

/** Paste lines: `certNumber,price` or `certNumber\tprice`. */
function parseCertPriceTextarea(
  raw: string,
): Array<{ certNumber: string; price: string }> {
  const out: Array<{ certNumber: string; price: string }> = [];
  const seen = new Set<string>();
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || /^cert/i.test(trimmed)) continue;
    const cells = trimmed.split(/[\t,;]+/).map((s) => s.trim());
    const certDigits = (cells[0] ?? "").replace(/\D/g, "");
    const price = (cells[1] ?? "").replace(/[$,]/g, "");
    if (certDigits.length < 7 || certDigits.length > 10) continue;
    if (!price || !(Number(price) > 0)) continue;
    if (seen.has(certDigits)) continue;
    seen.add(certDigits);
    out.push({ certNumber: certDigits, price });
  }
  return out;
}

function statusTone(status: string): string {
  if (
    status === "listed" ||
    status === "sold" ||
    status === "ready" ||
    status === "completed" ||
    status === "ready_to_commit"
  ) {
    return "text-emerald-700";
  }
  if (status.includes("fail") || status === "failed") return "text-red-600";
  if (status === "preparing" || status === "committing" || status === "minting") {
    return "text-amber-700";
  }
  return "text-zinc-700";
}

function displayItemStatus(it: AdminBulkMintJobItem): string {
  if (it.saleStatus === "sold") return "Sold";
  if (it.saleStatus === "listed" || it.status === "listed") return "Listed";
  if (it.saleStatus === "cancelled") return "Cancelled";
  if (it.saleStatus === "expired") return "Expired";
  return it.status;
}

function ItemTable({
  items,
  jobId,
  onCancelListing,
  cancelPending,
}: {
  items: AdminBulkMintJobItem[];
  jobId: string;
  onCancelListing: (itemId: string) => void;
  cancelPending: boolean;
}) {
  if (!items.length) {
    return <p className={`text-sm ${ADMIN_TEXT_MUTED}`}>No items yet.</p>;
  }
  return (
    <div className="max-h-[420px] overflow-auto rounded-md border border-zinc-200">
      <table className="min-w-full text-left text-sm">
        <thead className="sticky top-0 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-600">
          <tr>
            <th className="px-3 py-2 font-medium">#</th>
            <th className="px-3 py-2 font-medium">Cert</th>
            <th className="px-3 py-2 font-medium">Price</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium">Token</th>
            <th className="px-3 py-2 font-medium">Order</th>
            <th className="px-3 py-2 font-medium">Actions</th>
            <th className="px-3 py-2 font-medium">Error</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it) => {
            const canCancel =
              it.saleStatus === "listed" ||
              (it.status === "listed" && it.saleStatus !== "sold");
            return (
              <tr key={it.id} className="border-t border-zinc-100">
                <td className="px-3 py-2 text-zinc-500">{it.sortIndex + 1}</td>
                <td className="px-3 py-2 font-mono text-xs">{it.certNumber}</td>
                <td className="px-3 py-2 font-mono text-xs">${it.listPriceUsdc}</td>
                <td
                  className={`px-3 py-2 font-medium ${statusTone(displayItemStatus(it).toLowerCase())}`}
                >
                  {displayItemStatus(it)}
                </td>
                <td className="px-3 py-2 font-mono text-xs text-zinc-700">
                  {it.tokenId ?? "—"}
                </td>
                <td className="max-w-[120px] truncate px-3 py-2 font-mono text-xs text-zinc-600">
                  {it.orderHash ? `${it.orderHash.slice(0, 10)}…` : "—"}
                </td>
                <td className="px-3 py-2">
                  {canCancel ? (
                    <button
                      type="button"
                      className={ADMIN_BTN_SECONDARY}
                      disabled={cancelPending}
                      onClick={() => {
                        if (
                          window.confirm(
                            `Cancel listing for cert ${it.certNumber}? You can re-list via Approve mint and list.`,
                          )
                        ) {
                          onCancelListing(it.id);
                        }
                      }}
                    >
                      Cancel listing
                    </button>
                  ) : (
                    <span className={`text-xs ${ADMIN_TEXT_MUTED}`}>—</span>
                  )}
                </td>
                <td className="max-w-[180px] truncate px-3 py-2 text-xs text-red-600">
                  {it.errorMessage ?? ""}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="sr-only">Job {jobId}</p>
    </div>
  );
}

function JobSummary({ job }: { job: AdminBulkMintJob }) {
  const sold = job.items?.filter((i) => i.saleStatus === "sold").length ?? 0;
  const listedLive =
    job.items?.filter(
      (i) =>
        i.saleStatus === "listed" ||
        (i.status === "listed" && i.saleStatus !== "sold"),
    ).length ?? job.listedCount;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2">
        <p className={`text-xs ${ADMIN_TEXT_MUTED}`}>Status</p>
        <p className={`font-semibold ${statusTone(job.status)}`}>{job.status}</p>
      </div>
      <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2">
        <p className={`text-xs ${ADMIN_TEXT_MUTED}`}>Items</p>
        <p className="font-semibold text-zinc-900">{job.itemCount}</p>
      </div>
      <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2">
        <p className={`text-xs ${ADMIN_TEXT_MUTED}`}>Prepared / Minted</p>
        <p className="font-semibold text-zinc-900">
          {job.preparedCount} / {job.mintedCount}
        </p>
      </div>
      <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2">
        <p className={`text-xs ${ADMIN_TEXT_MUTED}`}>Listed / Sold</p>
        <p className="font-semibold text-zinc-900">
          {listedLive} / {sold}
        </p>
      </div>
      <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2">
        <p className={`text-xs ${ADMIN_TEXT_MUTED}`}>Failed</p>
        <p className="font-semibold text-zinc-900">{job.failedCount}</p>
      </div>
    </div>
  );
}

function JobsHistoryTable({
  jobs,
  activeJobId,
  onOpen,
}: {
  jobs: AdminBulkMintJobSummary[];
  activeJobId: string | null;
  onOpen: (id: string) => void;
}) {
  if (!jobs.length) {
    return <p className={`text-sm ${ADMIN_TEXT_MUTED}`}>No jobs yet.</p>;
  }
  return (
    <div className="max-h-[240px] overflow-auto rounded-md border border-zinc-200">
      <table className="min-w-full text-left text-sm">
        <thead className="sticky top-0 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-600">
          <tr>
            <th className="px-3 py-2 font-medium">Created</th>
            <th className="px-3 py-2 font-medium">Partner</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium">Items</th>
            <th className="px-3 py-2 font-medium">Listed</th>
            <th className="px-3 py-2 font-medium" />
          </tr>
        </thead>
        <tbody>
          {jobs.map((j) => (
            <tr
              key={j.id}
              className={`border-t border-zinc-100 ${
                activeJobId === j.id ? "bg-emerald-50/60" : ""
              }`}
            >
              <td className="px-3 py-2 text-xs text-zinc-600">
                {new Date(j.createdAt).toLocaleString()}
              </td>
              <td className="px-3 py-2 text-sm">{j.partnerDisplayName ?? "—"}</td>
              <td className={`px-3 py-2 font-medium ${statusTone(j.status)}`}>
                {j.status}
              </td>
              <td className="px-3 py-2">{j.itemCount}</td>
              <td className="px-3 py-2">{j.listedCount}</td>
              <td className="px-3 py-2">
                <button
                  type="button"
                  className={ADMIN_BTN_SECONDARY}
                  onClick={() => onOpen(j.id)}
                >
                  Open
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InventoryTable({ rows }: { rows: AdminPartnerInventoryItem[] }) {
  if (!rows.length) {
    return (
      <p className={`text-sm ${ADMIN_TEXT_MUTED}`}>
        No minted inventory for this partner yet.
      </p>
    );
  }
  const listed = rows.filter((r) => r.saleStatus === "listed").length;
  const sold = rows.filter((r) => r.saleStatus === "sold").length;
  return (
    <div className="space-y-2">
      <p className={`text-xs ${ADMIN_TEXT_MUTED}`}>
        {rows.length} tokens · {listed} listed · {sold} sold
      </p>
      <div className="max-h-[280px] overflow-auto rounded-md border border-zinc-200">
        <table className="min-w-full text-left text-sm">
          <thead className="sticky top-0 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-600">
            <tr>
              <th className="px-3 py-2 font-medium">Cert</th>
              <th className="px-3 py-2 font-medium">Token</th>
              <th className="px-3 py-2 font-medium">Price</th>
              <th className="px-3 py-2 font-medium">Sale</th>
              <th className="px-3 py-2 font-medium">Job</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.itemId} className="border-t border-zinc-100">
                <td className="px-3 py-2 font-mono text-xs">{r.certNumber}</td>
                <td className="px-3 py-2 font-mono text-xs">{r.tokenId ?? "—"}</td>
                <td className="px-3 py-2 font-mono text-xs">${r.listPriceUsdc}</td>
                <td className={`px-3 py-2 font-medium ${statusTone(r.saleStatus)}`}>
                  {r.saleStatus}
                </td>
                <td className="px-3 py-2 font-mono text-xs text-zinc-500">
                  {r.jobId.slice(0, 8)}…
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Partner company-wallet mint + Seaport list — Excel cert+price → prepare → one approve.
 */
export function MarketplaceAdminBulkMintPage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const jobIdFromUrl = searchParams.get("jobId");

  const [partnerId, setPartnerId] = useState("");
  const [certText, setCertText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [jobId, setJobId] = useState<string | null>(jobIdFromUrl);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (jobIdFromUrl && jobIdFromUrl !== jobId) setJobId(jobIdFromUrl);
  }, [jobIdFromUrl, jobId]);

  const openJob = useCallback(
    (id: string) => {
      setJobId(id);
      router.replace(`/marketplace/admin/bulk-mint?jobId=${encodeURIComponent(id)}`);
    },
    [router],
  );

  const parsedRows = useMemo(() => parseCertPriceTextarea(certText), [certText]);

  const partnersQuery = useQuery({
    queryKey: rq.adminMarketplacePartners,
    queryFn: listAdminMarketplacePartners,
  });

  const jobsQuery = useQuery({
    queryKey: rq.adminBulkMintJobs(partnerId || undefined),
    queryFn: () =>
      listAdminBulkMintJobs({
        partnerId: partnerId || undefined,
        limit: 40,
      }),
  });

  const inventoryQuery = useQuery({
    queryKey: rq.adminPartnerInventory(partnerId),
    queryFn: () => getAdminPartnerInventory(partnerId),
    enabled: Boolean(partnerId),
  });

  const jobQuery = useQuery({
    queryKey: rq.adminBulkMintJob(jobId ?? ""),
    queryFn: () => getAdminBulkMintJob(jobId!),
    enabled: Boolean(jobId),
    refetchInterval: (q) => {
      const s = q.state.data?.status;
      if (s === "preparing" || s === "committing" || s === "pending") return 2000;
      if (s === "completed") return 15_000;
      return false;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!partnerId) throw new Error("Select a registered partner.");
      if (file) return postAdminBulkMintJobFile({ partnerId, file });
      if (!parsedRows.length) {
        throw new Error(
          "Paste cert,price rows or upload an Excel/CSV with certNumber + price.",
        );
      }
      return postAdminBulkMintJobJson({ partnerId, items: parsedRows });
    },
    onSuccess: (job) => {
      setFormError(null);
      openJob(job.id);
      void queryClient.setQueryData(rq.adminBulkMintJob(job.id), job);
      void queryClient.invalidateQueries({
        queryKey: rq.adminBulkMintJobs(partnerId || undefined),
      });
    },
    onError: (e: Error) => setFormError(e.message),
  });

  const prepareMutation = useMutation({
    mutationFn: () => postAdminBulkMintPrepare(jobId!),
    onSuccess: (job) => {
      void queryClient.setQueryData(rq.adminBulkMintJob(job.id), job);
      void queryClient.invalidateQueries({ queryKey: rq.adminBulkMintJob(job.id) });
    },
  });

  const commitMutation = useMutation({
    mutationFn: () => postAdminBulkMintCommit(jobId!),
    onSuccess: (job) => {
      void queryClient.setQueryData(rq.adminBulkMintJob(job.id), job);
      void queryClient.invalidateQueries({ queryKey: rq.adminBulkMintJob(job.id) });
      void queryClient.invalidateQueries({
        queryKey: rq.adminBulkMintJobs(partnerId || undefined),
      });
      if (partnerId) {
        void queryClient.invalidateQueries({
          queryKey: rq.adminPartnerInventory(partnerId),
        });
      }
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (itemId: string) =>
      postAdminBulkMintCancelListing({ jobId: jobId!, itemId }),
    onSuccess: (job) => {
      void queryClient.setQueryData(rq.adminBulkMintJob(job.id), job);
      if (partnerId) {
        void queryClient.invalidateQueries({
          queryKey: rq.adminPartnerInventory(partnerId),
        });
      }
    },
  });

  const job = jobQuery.data;
  const readyCount = job?.items?.filter((i) => i.status === "ready").length ?? 0;
  const listRetryCount =
    job?.items?.filter((i) => i.status === "minted" || i.status === "list_failed")
      .length ?? 0;
  const canCommit =
    Boolean(jobId) &&
    (readyCount > 0 || listRetryCount > 0) &&
    (job?.status === "ready_to_commit" ||
      job?.status === "failed" ||
      job?.status === "completed") &&
    !commitMutation.isPending;

  const selectedPartner = partnersQuery.data?.find((p) => p.id === partnerId);

  const onCommit = useCallback(() => {
    if (!jobId || !canCommit) return;
    const name =
      job?.partnerDisplayName || selectedPartner?.displayName || "partner";
    if (
      !window.confirm(
        `Mint and list for ${name}?\n` +
          `Ready to mint: ${readyCount}\n` +
          `Retry list: ${listRetryCount}\n` +
          `On-chain mint TX ≈ ${Math.ceil(readyCount / 50) || 0} (chunks of 50).\n` +
          `NFTs mint to the company wallet; asks are signed server-side.`,
      )
    ) {
      return;
    }
    commitMutation.mutate();
  }, [
    jobId,
    canCommit,
    readyCount,
    listRetryCount,
    job?.partnerDisplayName,
    selectedPartner?.displayName,
    commitMutation,
  ]);

  const activePartners = partnersQuery.data?.filter((p) => p.isActive) ?? [];

  return (
    <>
      <MarketplaceAdminPageHeader
        title="Partner bulk mint and list"
        subtitle="Upload Excel/CSV with certNumber + price (or paste cert,price lines), prepare via PSA + IPFS, then approve once to mint into the company wallet and list Seaport asks."
      />

      <p className={`mb-6 text-sm ${ADMIN_TEXT_SECONDARY}`}>
        Register the company wallet first under{" "}
        <a
          className="font-medium text-[var(--brand-500)] hover:underline"
          href="/marketplace/admin/partners"
        >
          Partners
        </a>
        . Markets show the company display name; sale proceeds go to that wallet via
        Seaport. Use job history and inventory below for Listed vs Sold.
      </p>

      <section className={`${ADMIN_ARTICLE} mb-6 space-y-4`}>
        <h2 className="text-base font-semibold text-zinc-900">1. Create job</h2>

        <div>
          <label className={ADMIN_LABEL} htmlFor="bulk-partner">
            Partner company
          </label>
          <select
            id="bulk-partner"
            className={ADMIN_INPUT}
            value={partnerId}
            onChange={(e) => setPartnerId(e.target.value)}
          >
            <option value="">Select partner…</option>
            {activePartners.map((p) => (
              <option key={p.id} value={p.id}>
                {p.displayName} ({p.walletAddress.slice(0, 8)}…)
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={ADMIN_LABEL} htmlFor="bulk-certs">
            Cert + price (paste)
          </label>
          <textarea
            id="bulk-certs"
            className={`${ADMIN_INPUT_MONO} min-h-[120px]`}
            placeholder={"certNumber,price\n83179580,1250\n84956785,980.50"}
            value={certText}
            onChange={(e) => setCertText(e.target.value)}
          />
          <p className={`mt-1 text-xs ${ADMIN_TEXT_MUTED}`}>
            {parsedRows.length} valid row{parsedRows.length === 1 ? "" : "s"} (max 500)
          </p>
        </div>

        <div>
          <label className={ADMIN_LABEL} htmlFor="bulk-file">
            Or upload Excel / CSV
          </label>
          <input
            id="bulk-file"
            type="file"
            accept=".xlsx,.xls,.csv,.txt"
            className="block w-full text-sm text-zinc-700 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-100 file:px-3 file:py-2 file:text-sm file:font-medium"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>

        {formError || createMutation.isError ? (
          <p className={ADMIN_TEXT_ERROR} role="alert">
            {formError ??
              (createMutation.error instanceof Error
                ? createMutation.error.message
                : "Create failed")}
          </p>
        ) : null}

        <button
          type="button"
          className={ADMIN_BTN_PRIMARY}
          disabled={createMutation.isPending}
          onClick={() => createMutation.mutate()}
        >
          {createMutation.isPending ? "Creating…" : "Create job and start prepare"}
        </button>
      </section>

      <section className={`${ADMIN_PANEL} mb-6 space-y-3 p-4 sm:p-5`}>
        <h2 className="text-base font-semibold text-zinc-900">Recent jobs</h2>
        {jobsQuery.isLoading ? (
          <p className={`text-sm ${ADMIN_TEXT_SECONDARY}`}>Loading jobs…</p>
        ) : (
          <JobsHistoryTable
            jobs={jobsQuery.data ?? []}
            activeJobId={jobId}
            onOpen={openJob}
          />
        )}
      </section>

      {partnerId ? (
        <section className={`${ADMIN_PANEL} mb-6 space-y-3 p-4 sm:p-5`}>
          <h2 className="text-base font-semibold text-zinc-900">
            Partner inventory
          </h2>
          {inventoryQuery.isLoading ? (
            <p className={`text-sm ${ADMIN_TEXT_SECONDARY}`}>Loading…</p>
          ) : inventoryQuery.isError ? (
            <p className={ADMIN_TEXT_ERROR} role="alert">
              {inventoryQuery.error instanceof Error
                ? inventoryQuery.error.message
                : "Failed to load inventory"}
            </p>
          ) : (
            <InventoryTable rows={inventoryQuery.data ?? []} />
          )}
        </section>
      ) : null}

      {jobId ? (
        <section className={`${ADMIN_PANEL} space-y-4 p-4 sm:p-5`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-zinc-900">Job detail</h2>
              <p className={`mt-1 font-mono text-xs ${ADMIN_TEXT_MUTED}`}>{jobId}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={ADMIN_BTN_SECONDARY}
                disabled={!jobId || prepareMutation.isPending || job?.status === "preparing"}
                onClick={() => prepareMutation.mutate()}
              >
                {prepareMutation.isPending ? "Starting…" : "Re-run prepare"}
              </button>
              <button
                type="button"
                className={ADMIN_BTN_PRIMARY}
                disabled={!canCommit}
                onClick={onCommit}
              >
                {commitMutation.isPending
                  ? "Committing…"
                  : `Approve mint and list (${readyCount}+${listRetryCount})`}
              </button>
            </div>
          </div>

          {jobQuery.isLoading && !job ? (
            <p className={`text-sm ${ADMIN_TEXT_SECONDARY}`}>Loading job…</p>
          ) : jobQuery.isError ? (
            <p className={ADMIN_TEXT_ERROR} role="alert">
              {jobQuery.error instanceof Error
                ? jobQuery.error.message
                : "Failed to load job"}
            </p>
          ) : job ? (
            <>
              <JobSummary job={job} />
              {job.errorMessage ? (
                <p className={ADMIN_TEXT_ERROR} role="alert">
                  {job.errorMessage}
                </p>
              ) : null}
              <p className={ADMIN_PAGE_SUBTITLE}>
                Partner:{" "}
                <span className="font-medium text-zinc-800">
                  {job.partnerDisplayName ?? "—"}
                </span>{" "}
                ·{" "}
                <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs">
                  {job.partnerWalletAddress ?? job.partnerId}
                </code>{" "}
                · chain {job.chainId}
              </p>
              <ItemTable
                items={job.items ?? []}
                jobId={job.id}
                cancelPending={cancelMutation.isPending}
                onCancelListing={(itemId) => cancelMutation.mutate(itemId)}
              />
            </>
          ) : null}

          {commitMutation.isError || cancelMutation.isError ? (
            <p className={ADMIN_TEXT_ERROR} role="alert">
              {(commitMutation.error || cancelMutation.error) instanceof Error
                ? (commitMutation.error || cancelMutation.error)!.message
                : "Action failed"}
            </p>
          ) : null}
        </section>
      ) : null}
    </>
  );
}

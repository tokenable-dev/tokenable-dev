"use client";

import { useEffect, useMemo, useState } from "react";
import type { AdminVaultSubmission } from "@/lib/core";
import {
  useAdminVaultSubmissionCounts,
  useAdminVaultSubmissionDetail,
  useAdminVaultSubmissionMutations,
  useAdminVaultSubmissions,
} from "@/hooks/marketplace-admin/useMarketplaceAdminVaultSubmissions";
import { AdminSectionTitle, AdminStatTile } from "./AdminAnalyticsWidgets";
import {
  ADMIN_ARTICLE,
  ADMIN_BADGE,
  ADMIN_BTN_DANGER,
  ADMIN_BTN_PRIMARY,
  ADMIN_BTN_SECONDARY,
  ADMIN_COUNT,
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

type PipelineKey =
  | "all"
  | "draft"
  | "awaiting_shipment"
  | "in_transit"
  | "psa_reviewing"
  | "completed"
  | "cancelled";

const PIPELINE: {
  key: PipelineKey;
  label: string;
  short: string;
  hint: string;
  accent: string;
}[] = [
  {
    key: "all",
    label: "All",
    short: "All",
    hint: "Every package",
    accent: "bg-zinc-900 text-white",
  },
  {
    key: "draft",
    label: "Draft",
    short: "Draft",
    hint: "Cards saved, not ready",
    accent: "bg-zinc-200 text-zinc-800",
  },
  {
    key: "awaiting_shipment",
    label: "Ready to ship",
    short: "Ready",
    hint: "Packing slip · awaiting drop-off",
    accent: "bg-amber-100 text-amber-900",
  },
  {
    key: "in_transit",
    label: "In transit",
    short: "Transit",
    hint: "Tracking on the way to PSA",
    accent: "bg-sky-100 text-sky-900",
  },
  {
    key: "psa_reviewing",
    label: "At PSA",
    short: "Review",
    hint: "Approve or reject each card",
    accent: "bg-violet-100 text-violet-900",
  },
  {
    key: "completed",
    label: "Done",
    short: "Done",
    hint: "Minted or closed",
    accent: "bg-emerald-100 text-emerald-900",
  },
  {
    key: "cancelled",
    label: "Cancelled",
    short: "Cancel",
    hint: "Abandoned packages",
    accent: "bg-rose-100 text-rose-900",
  },
];

const STATUS_LABEL: Record<string, string> = Object.fromEntries(
  PIPELINE.map((p) => [p.key, p.label]),
);

const ITEM_STATUS_STYLE: Record<string, string> = {
  draft: "bg-zinc-100 text-zinc-700",
  confirmed: "bg-amber-50 text-amber-800",
  in_transit: "bg-sky-50 text-sky-800",
  reviewing: "bg-violet-50 text-violet-800",
  approved: "bg-emerald-50 text-emerald-800",
  rejected: "bg-rose-50 text-rose-800",
  minting: "bg-indigo-50 text-indigo-800",
  completed: "bg-emerald-100 text-emerald-900",
  failed: "bg-red-100 text-red-800",
};

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

function statusBadgeClass(status: string): string {
  const row = PIPELINE.find((p) => p.key === status);
  return row?.accent ?? "bg-zinc-100 text-zinc-700";
}

function nextActionLabel(sub: AdminVaultSubmission): string | null {
  if (sub.status === "in_transit" || sub.status === "awaiting_shipment") {
    return "Mark arrived";
  }
  if (sub.status === "psa_reviewing") {
    const pending = sub.items.filter((i) => i.status === "reviewing").length;
    if (pending > 0) return `Review ${pending} card${pending === 1 ? "" : "s"}`;
    return "Review cards";
  }
  return null;
}

export function MarketplaceAdminVaultSubmissionsPage() {
  const [status, setStatus] = useState<PipelineKey>("all");
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rejectItemId, setRejectItemId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const countsQuery = useAdminVaultSubmissionCounts();
  const listQuery = useAdminVaultSubmissions(status, search);
  const detailQuery = useAdminVaultSubmissionDetail(selectedId);
  const { markArrived, setStatus: setPkgStatus, setItemStatus } =
    useAdminVaultSubmissionMutations();

  const counts = countsQuery.data;
  const list = listQuery.data ?? [];
  const detail = detailQuery.data ?? null;
  const busy =
    markArrived.isPending || setPkgStatus.isPending || setItemStatus.isPending;

  useEffect(() => {
    if (!selectedId && list.length > 0) {
      setSelectedId(list[0]!.id);
    }
  }, [list, selectedId]);

  useEffect(() => {
    if (selectedId && list.length > 0 && !list.some((r) => r.id === selectedId)) {
      setSelectedId(list[0]?.id ?? null);
    }
  }, [list, selectedId]);

  const attentionCount = useMemo(() => {
    if (!counts) return 0;
    return (counts.in_transit ?? 0) + (counts.psa_reviewing ?? 0);
  }, [counts]);

  const run = async (fn: () => Promise<unknown>) => {
    setActionError(null);
    try {
      await fn();
      setRejectItemId(null);
      setRejectReason("");
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Action failed");
    }
  };

  return (
    <>
      <MarketplaceAdminPageHeader
        title="Vault submissions"
        subtitle="Track sell-flow packages from draft → PSA → mint. Mark arrivals, approve or reject cards, and keep users’ Vault Detail scenarios in sync."
      />

      {/* Pipeline overview */}
      <div className={`${ADMIN_ARTICLE} mb-6`}>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <AdminSectionTitle title="Live pipeline" />
          {attentionCount > 0 ? (
            <p className="text-sm font-medium text-amber-800">
              {attentionCount} need attention (transit + review)
            </p>
          ) : (
            <p className={`text-sm ${ADMIN_TEXT_MUTED}`}>Auto-refreshes every ~15s</p>
          )}
        </div>

        {countsQuery.isLoading ? (
          <p className={`text-sm ${ADMIN_TEXT_SECONDARY}`}>Loading counts…</p>
        ) : countsQuery.isError ? (
          <p className={ADMIN_TEXT_ERROR} role="alert">
            Failed to load pipeline counts
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            {PIPELINE.map((stage, idx) => {
              const n = counts?.[stage.key] ?? 0;
              const active = status === stage.key;
              return (
                <button
                  key={stage.key}
                  type="button"
                  onClick={() => {
                    setStatus(stage.key);
                    setSelectedId(null);
                  }}
                  className={`rounded-lg border px-3 py-3 text-left transition-colors ${
                    active
                      ? "border-[var(--brand-500)] bg-[var(--brand-500)]/5 ring-1 ring-[var(--brand-500)]/30"
                      : "border-zinc-200 bg-zinc-50/80 hover:border-zinc-300 hover:bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span
                      className={`${ADMIN_BADGE} ${stage.accent} ${
                        stage.key === "all" ? "" : ""
                      }`}
                    >
                      {stage.short}
                    </span>
                    {idx > 0 && idx < PIPELINE.length - 1 ? (
                      <span className={`text-[10px] ${ADMIN_TEXT_MUTED}`}>→</span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-2xl font-semibold tabular-nums text-zinc-900">
                    {n}
                  </p>
                  <p className={`mt-0.5 text-[11px] leading-snug ${ADMIN_TEXT_META}`}>
                    {stage.hint}
                  </p>
                </button>
              );
            })}
          </div>
        )}

        {counts ? (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <AdminStatTile label="In flight" value={(counts.in_transit ?? 0) + (counts.awaiting_shipment ?? 0)} />
            <AdminStatTile label="At PSA" value={counts.psa_reviewing ?? 0} />
            <AdminStatTile label="Completed" value={counts.completed ?? 0} />
            <AdminStatTile label="Total packages" value={counts.all ?? 0} />
          </div>
        ) : null}
      </div>

      {/* Filters */}
      <div className={`${ADMIN_ARTICLE} mb-6 space-y-3`}>
        <div className={`flex flex-wrap gap-1 ${ADMIN_SEGMENT}`}>
          {PIPELINE.map((p) => (
            <button
              key={`seg-${p.key}`}
              type="button"
              onClick={() => {
                setStatus(p.key);
                setSelectedId(null);
              }}
              className={
                status === p.key ? ADMIN_SEGMENT_BTN_ACTIVE : ADMIN_SEGMENT_BTN
              }
            >
              {p.label}
              {counts ? (
                <span className="ml-1 tabular-nums opacity-70">
                  {counts[p.key] ?? 0}
                </span>
              ) : null}
            </button>
          ))}
        </div>
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(q.trim());
            setSelectedId(null);
          }}
        >
          <input
            className={`${ADMIN_INPUT} min-w-[220px] flex-1`}
            placeholder="SUB-… · email · name · cert"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button type="submit" className={ADMIN_BTN_PRIMARY}>
            Search
          </button>
          {search ? (
            <button
              type="button"
              className={ADMIN_BTN_SECONDARY}
              onClick={() => {
                setQ("");
                setSearch("");
              }}
            >
              Clear
            </button>
          ) : null}
        </form>
      </div>

      {listQuery.isLoading ? (
        <p className={`text-base ${ADMIN_TEXT_SECONDARY}`}>Loading submissions…</p>
      ) : listQuery.isError ? (
        <p className={ADMIN_TEXT_ERROR} role="alert">
          {listQuery.error instanceof Error
            ? listQuery.error.message
            : "Failed to load submissions"}
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
          {/* List */}
          <div className={`${ADMIN_PANEL} overflow-hidden`}>
            <div className="border-b border-zinc-200 px-4 py-3">
              <p className={ADMIN_COUNT}>
                {list.length} package{list.length === 1 ? "" : "s"}
                {search ? ` matching “${search}”` : ""}
              </p>
            </div>
            {list.length === 0 ? (
              <p className={`px-4 py-8 text-sm ${ADMIN_TEXT_SECONDARY}`}>
                No submissions in this stage. Try another filter or wait for a
                user to continue the sell flow.
              </p>
            ) : (
              <ul className="max-h-[70vh] divide-y divide-zinc-100 overflow-y-auto">
                {list.map((row) => {
                  const active = row.id === selectedId;
                  const action = nextActionLabel(row);
                  return (
                    <li key={row.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedId(row.id);
                          setActionError(null);
                          setRejectItemId(null);
                        }}
                        className={`flex w-full gap-3 px-4 py-3 text-left transition-colors ${
                          active
                            ? "bg-[var(--brand-500)]/5"
                            : "hover:bg-zinc-50"
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-sm font-semibold text-zinc-900">
                              {row.publicId}
                            </span>
                            <span
                              className={`${ADMIN_BADGE} ${statusBadgeClass(row.status)}`}
                            >
                              {STATUS_LABEL[row.status] ?? row.status}
                            </span>
                            <span className={`${ADMIN_BADGE} bg-zinc-100 text-zinc-600`}>
                              Scenario {row.scenario}
                            </span>
                          </div>
                          <p className={`mt-1 truncate text-sm ${ADMIN_TEXT_SECONDARY}`}>
                            {row.userEmail ?? row.userName ?? "Unknown user"}
                            {" · "}
                            {row.items.length} card
                            {row.items.length === 1 ? "" : "s"}
                          </p>
                          <p className={`mt-0.5 text-xs ${ADMIN_TEXT_META}`}>
                            Updated {formatWhen(row.updatedAt)}
                            {row.trackingNumber
                              ? ` · ${row.carrier ?? "Track"} ${row.trackingNumber}`
                              : ""}
                          </p>
                          {action ? (
                            <p className="mt-1 text-xs font-medium text-amber-800">
                              Next: {action}
                            </p>
                          ) : null}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Detail */}
          <div className={`${ADMIN_PANEL} overflow-hidden`}>
            {!selectedId ? (
              <p className={`px-4 py-10 text-sm ${ADMIN_TEXT_SECONDARY}`}>
                Select a package to manage status and cards.
              </p>
            ) : detailQuery.isLoading ? (
              <p className={`px-4 py-10 text-sm ${ADMIN_TEXT_SECONDARY}`}>
                Loading detail…
              </p>
            ) : detailQuery.isError || !detail ? (
              <p className={`${ADMIN_TEXT_ERROR} px-4 py-10`} role="alert">
                Could not load submission detail
              </p>
            ) : (
              <SubmissionDetail
                detail={detail}
                busy={busy}
                actionError={actionError}
                rejectItemId={rejectItemId}
                rejectReason={rejectReason}
                onRejectItemId={setRejectItemId}
                onRejectReason={setRejectReason}
                onMarkArrived={() =>
                  void run(() => markArrived.mutateAsync(detail.id))
                }
                onSetPackageStatus={(s) =>
                  void run(() =>
                    setPkgStatus.mutateAsync({ id: detail.id, status: s }),
                  )
                }
                onApprove={(itemId) =>
                  void run(() =>
                    setItemStatus.mutateAsync({
                      id: detail.id,
                      itemId,
                      status: "approved",
                    }),
                  )
                }
                onReject={(itemId) =>
                  void run(() =>
                    setItemStatus.mutateAsync({
                      id: detail.id,
                      itemId,
                      status: "rejected",
                      rejectionReason: rejectReason.trim() || undefined,
                    }),
                  )
                }
                onSetItemStatus={(itemId, s) =>
                  void run(() =>
                    setItemStatus.mutateAsync({
                      id: detail.id,
                      itemId,
                      status: s,
                    }),
                  )
                }
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}

function SubmissionDetail({
  detail,
  busy,
  actionError,
  rejectItemId,
  rejectReason,
  onRejectItemId,
  onRejectReason,
  onMarkArrived,
  onSetPackageStatus,
  onApprove,
  onReject,
  onSetItemStatus,
}: {
  detail: AdminVaultSubmission;
  busy: boolean;
  actionError: string | null;
  rejectItemId: string | null;
  rejectReason: string;
  onRejectItemId: (id: string | null) => void;
  onRejectReason: (v: string) => void;
  onMarkArrived: () => void;
  onSetPackageStatus: (status: string) => void;
  onApprove: (itemId: string) => void;
  onReject: (itemId: string) => void;
  onSetItemStatus: (itemId: string, status: string) => void;
}) {
  const canArrive =
    detail.status === "in_transit" || detail.status === "awaiting_shipment";

  return (
    <div>
      <div className="border-b border-zinc-200 px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono text-lg font-semibold text-zinc-900">
              {detail.publicId}
            </p>
            <p className={`mt-1 text-sm ${ADMIN_TEXT_SECONDARY}`}>
              {detail.userName ? `${detail.userName} · ` : ""}
              {detail.userEmail ?? "No email"}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <span className={`${ADMIN_BADGE} ${statusBadgeClass(detail.status)}`}>
              {STATUS_LABEL[detail.status] ?? detail.status}
            </span>
            <span className={`${ADMIN_BADGE} bg-zinc-100 text-zinc-700`}>
              Scenario {detail.scenario}
            </span>
          </div>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div>
            <dt className={ADMIN_TEXT_META}>Carrier</dt>
            <dd className="font-medium text-zinc-900">
              {detail.carrier ?? "—"}
            </dd>
          </div>
          <div>
            <dt className={ADMIN_TEXT_META}>Tracking</dt>
            <dd className="font-mono text-xs font-medium text-zinc-900 break-all">
              {detail.trackingNumber ?? "—"}
            </dd>
          </div>
          <div>
            <dt className={ADMIN_TEXT_META}>Shipped</dt>
            <dd className="font-medium text-zinc-900">
              {formatWhen(detail.shippedAt)}
            </dd>
          </div>
          <div>
            <dt className={ADMIN_TEXT_META}>Updated</dt>
            <dd className="font-medium text-zinc-900">
              {formatWhen(detail.updatedAt)}
            </dd>
          </div>
        </dl>

        <div className="mt-4 flex flex-wrap gap-2">
          {canArrive ? (
            <button
              type="button"
              disabled={busy}
              className={ADMIN_BTN_PRIMARY}
              onClick={onMarkArrived}
            >
              Mark arrived at PSA
            </button>
          ) : null}
          {detail.status === "psa_reviewing" ? (
            <button
              type="button"
              disabled={busy}
              className={ADMIN_BTN_SECONDARY}
              onClick={() => onSetPackageStatus("completed")}
            >
              Close package
            </button>
          ) : null}
          {detail.status !== "cancelled" && detail.status !== "completed" ? (
            <button
              type="button"
              disabled={busy}
              className={ADMIN_BTN_DANGER}
              onClick={() => onSetPackageStatus("cancelled")}
            >
              Cancel package
            </button>
          ) : null}
          {detail.status === "cancelled" ? (
            <button
              type="button"
              disabled={busy}
              className={ADMIN_BTN_SECONDARY}
              onClick={() => onSetPackageStatus("draft")}
            >
              Reopen as draft
            </button>
          ) : null}
        </div>

        {actionError ? (
          <p className={`mt-3 ${ADMIN_TEXT_ERROR}`} role="alert">
            {actionError}
          </p>
        ) : null}
      </div>

      <div className="px-4 py-4 sm:px-5">
        <h3 className="text-sm font-semibold text-zinc-900">
          Cards ({detail.items.length})
        </h3>
        <p className={`mt-1 text-xs ${ADMIN_TEXT_MUTED}`}>
          Approve moves toward mint (scenario E). Reject returns the card to the
          user path (scenario F/H).
        </p>

        {detail.items.length === 0 ? (
          <p className={`mt-4 text-sm ${ADMIN_TEXT_SECONDARY}`}>No cards yet.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {detail.items.map((item) => {
              const reviewing =
                item.status === "reviewing" ||
                item.status === "in_transit" ||
                item.status === "confirmed";
              return (
                <li
                  key={item.id}
                  className="flex gap-3 rounded-lg border border-zinc-200 bg-zinc-50/60 p-3"
                >
                      {item.imageUrl ? (
                    // External catalog / PSA URLs — next/image not required in admin ops list.
                    <img
                      src={item.imageUrl}
                      alt=""
                      className="h-16 w-12 shrink-0 rounded object-cover"
                    />
                  ) : (
                    <div className="flex h-16 w-12 shrink-0 items-center justify-center rounded bg-zinc-200 text-[10px] text-zinc-500">
                      No img
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium text-zinc-900">
                        {item.name ?? `Cert ${item.cert}`}
                      </p>
                      <span
                        className={`${ADMIN_BADGE} ${
                          ITEM_STATUS_STYLE[item.status] ?? "bg-zinc-100 text-zinc-700"
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>
                    <p className={`mt-0.5 font-mono text-xs ${ADMIN_TEXT_META}`}>
                      #{item.cert}
                      {item.grade ? ` · ${item.grade}` : ""}
                      {item.vaultCycleId
                        ? ` · cycle ${item.vaultCycleId.slice(0, 8)}…`
                        : ""}
                    </p>
                    {item.rejectionReason ? (
                      <p className="mt-1 text-xs text-rose-700">
                        Rejected: {item.rejectionReason}
                      </p>
                    ) : null}

                    {reviewing ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          className={ADMIN_BTN_PRIMARY}
                          onClick={() => onApprove(item.id)}
                        >
                          Approve
                        </button>
                        {rejectItemId === item.id ? (
                          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
                            <input
                              className={`${ADMIN_INPUT} min-w-[180px] flex-1`}
                              placeholder="Rejection reason"
                              value={rejectReason}
                              onChange={(e) => onRejectReason(e.target.value)}
                            />
                            <button
                              type="button"
                              disabled={busy}
                              className={ADMIN_BTN_DANGER}
                              onClick={() => onReject(item.id)}
                            >
                              Confirm reject
                            </button>
                            <button
                              type="button"
                              className={ADMIN_BTN_SECONDARY}
                              onClick={() => onRejectItemId(null)}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={busy}
                            className={ADMIN_BTN_DANGER}
                            onClick={() => {
                              onRejectItemId(item.id);
                              onRejectReason("");
                            }}
                          >
                            Reject
                          </button>
                        )}
                        {item.status !== "reviewing" ? (
                          <button
                            type="button"
                            disabled={busy}
                            className={ADMIN_BTN_SECONDARY}
                            onClick={() => onSetItemStatus(item.id, "reviewing")}
                          >
                            Mark reviewing
                          </button>
                        ) : null}
                      </div>
                    ) : null}

                    {item.status === "approved" ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          className={ADMIN_BTN_SECONDARY}
                          onClick={() => onSetItemStatus(item.id, "completed")}
                        >
                          Mark mint complete
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          className={ADMIN_BTN_DANGER}
                          onClick={() => onSetItemStatus(item.id, "failed")}
                        >
                          Mark mint failed
                        </button>
                      </div>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

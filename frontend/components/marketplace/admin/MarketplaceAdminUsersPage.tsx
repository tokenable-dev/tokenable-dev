"use client";

import { useState } from "react";
import type { AdminUserFilter } from "@/lib/core";
import {
  ADMIN_USERS_PAGE_SIZE,
  useMarketplaceAdminUserStats,
  useMarketplaceAdminUsers,
} from "@/hooks/marketplace-admin/useMarketplaceAdminUsers";
import { usePrivyFundingStatus } from "@/hooks/wallet/usePrivyFundingStatus";
import {
  resolveFundingTargetChainId,
  resolvePrivyFundingEnvironment,
} from "@/lib/privy/funding";
import { getChainDefinition } from "@/lib/chains";
import {
  ADMIN_ARTICLE,
  ADMIN_BTN_LOAD_MORE,
  ADMIN_BTN_PRIMARY,
  ADMIN_BTN_SECONDARY,
  ADMIN_COUNT,
  ADMIN_INPUT,
  ADMIN_LINK_SM,
  ADMIN_LIST,
  ADMIN_SEGMENT,
  ADMIN_SEGMENT_BTN,
  ADMIN_SEGMENT_BTN_ACTIVE,
  ADMIN_TEXT_META,
  ADMIN_TEXT_SECONDARY,
} from "./adminUi";
import { AdminStatTile } from "./AdminAnalyticsWidgets";
import { MarketplaceAdminPageHeader } from "./MarketplaceAdminPageHeader";
import { MarketplaceAdminUserRow } from "./MarketplaceAdminUserRow";

const FILTERS: { value: AdminUserFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "privy", label: "Privy" },
  { value: "with_wallet", label: "Wallet" },
  { value: "kyc_approved", label: "KYC ✓" },
  { value: "kyc_pending", label: "KYC …" },
  { value: "kyc_rejected", label: "KYC ✕" },
  { value: "kyc_none", label: "KYC —" },
  { value: "legacy", label: "Legacy" },
];

function AdminPrivySupportPanel() {
  const funding = usePrivyFundingStatus();
  const targetChainId = resolveFundingTargetChainId();
  const chainLabel = getChainDefinition(targetChainId).shortLabel;
  const env = resolvePrivyFundingEnvironment();

  const readyLabel =
    funding.ready === null ? "…" : funding.ready ? "Ready" : "Not ready";
  const readyClass =
    funding.ready === true
      ? "text-emerald-700"
      : funding.ready === false
        ? "text-amber-700"
        : "text-zinc-600";

  return (
    <div className={`${ADMIN_ARTICLE} mb-6`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-zinc-900">Privy / MoonPay</h2>
        <a
          href={funding.dashboardUrl}
          target="_blank"
          rel="noreferrer"
          className={ADMIN_LINK_SM}
        >
          Dashboard
        </a>
      </div>
      <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className={ADMIN_TEXT_META}>MoonPay</dt>
          <dd className={`font-medium ${readyClass}`}>{readyLabel}</dd>
        </div>
        <div>
          <dt className={ADMIN_TEXT_META}>Env</dt>
          <dd className="font-medium capitalize text-zinc-900">{env}</dd>
        </div>
        <div>
          <dt className={ADMIN_TEXT_META}>Chain</dt>
          <dd className="font-medium text-zinc-900">
            {chainLabel} ({targetChainId})
          </dd>
        </div>
        <div>
          <dt className={ADMIN_TEXT_META}>Asset</dt>
          <dd className="font-medium text-zinc-900">USDC</dd>
        </div>
      </dl>
      {funding.error ? (
        <p className="mt-2 text-sm text-red-600" role="alert">
          Funding settings unavailable
        </p>
      ) : null}
    </div>
  );
}

export function MarketplaceAdminUsersPage() {
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<AdminUserFilter>("all");
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const statsQuery = useMarketplaceAdminUserStats();
  const { listQuery, patchMutation, deleteMutation, actionMutation } =
    useMarketplaceAdminUsers({ q: search, filter, page });

  const items = listQuery.data?.items ?? [];
  const total = listQuery.data?.total ?? 0;
  const hasMore = listQuery.data?.hasMore ?? false;
  const busy =
    patchMutation.isPending ||
    deleteMutation.isPending ||
    actionMutation.isPending;

  const stats = statsQuery.data;

  return (
    <>
      <MarketplaceAdminPageHeader title="Users" />

      <AdminPrivySupportPanel />

      {stats ? (
        <div
          className={`${ADMIN_ARTICLE} mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7`}
        >
          <AdminStatTile label="Total" value={stats.total} />
          <AdminStatTile label="Privy" value={stats.privy} />
          <AdminStatTile label="Wallet" value={stats.withWallet} />
          <AdminStatTile label="KYC ✓" value={stats.kycApproved} />
          <AdminStatTile label="KYC …" value={stats.kycPending} />
          <AdminStatTile label="KYC ✕" value={stats.kycRejected} />
          <AdminStatTile label="KYC —" value={stats.kycNone} />
        </div>
      ) : null}

      <div className={`${ADMIN_ARTICLE} mb-6 space-y-3`}>
        <div className={`flex flex-wrap gap-1 ${ADMIN_SEGMENT}`}>
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => {
                setFilter(f.value);
                setPage(1);
                setExpandedId(null);
              }}
              className={
                filter === f.value ? ADMIN_SEGMENT_BTN_ACTIVE : ADMIN_SEGMENT_BTN
              }
            >
              {f.label}
            </button>
          ))}
        </div>
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(q.trim());
            setPage(1);
            setExpandedId(null);
          }}
        >
          <input
            className={`${ADMIN_INPUT} min-w-[200px] flex-1`}
            placeholder="email · privy · wallet · applicant"
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
                setPage(1);
              }}
            >
              Clear
            </button>
          ) : null}
        </form>
      </div>

      {listQuery.isLoading ? (
        <p className={`text-sm ${ADMIN_TEXT_SECONDARY}`}>…</p>
      ) : listQuery.isError ? (
        <p className="text-sm text-red-600" role="alert">
          {listQuery.error instanceof Error
            ? listQuery.error.message
            : "Failed"}
        </p>
      ) : items.length === 0 ? (
        <p className={`text-sm ${ADMIN_TEXT_SECONDARY}`}>No results</p>
      ) : (
        <div className={ADMIN_LIST}>
          <p className={ADMIN_COUNT}>
            {items.length}/{total.toLocaleString()}
            {search ? ` · ${search}` : ""}
          </p>
          {items.map((row) => (
            <MarketplaceAdminUserRow
              key={row.id}
              row={row}
              expanded={expandedId === row.id}
              onToggle={() =>
                setExpandedId((prev) => (prev === row.id ? null : row.id))
              }
              busy={busy}
              onPatchName={async (userId, name) => {
                await patchMutation.mutateAsync({
                  userId,
                  body: { name: name.trim() || null },
                });
              }}
              onDelete={async (userId) => {
                await deleteMutation.mutateAsync(userId);
                setExpandedId(null);
              }}
              onAction={async (input) => {
                await actionMutation.mutateAsync(input);
              }}
            />
          ))}
          {total > ADMIN_USERS_PAGE_SIZE ? (
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                type="button"
                className={`${ADMIN_BTN_LOAD_MORE} w-auto min-w-[7rem] px-6`}
                disabled={page <= 1 || listQuery.isFetching}
                onClick={() => {
                  setExpandedId(null);
                  setPage((p) => Math.max(1, p - 1));
                }}
              >
                Prev
              </button>
              <span className="text-sm text-zinc-700">
                {page}/{Math.max(1, Math.ceil(total / ADMIN_USERS_PAGE_SIZE))}
              </span>
              <button
                type="button"
                className={`${ADMIN_BTN_LOAD_MORE} w-auto min-w-[7rem] px-6`}
                disabled={!hasMore || listQuery.isFetching}
                onClick={() => {
                  setExpandedId(null);
                  setPage((p) => p + 1);
                }}
              >
                Next
              </button>
            </div>
          ) : null}
        </div>
      )}
    </>
  );
}

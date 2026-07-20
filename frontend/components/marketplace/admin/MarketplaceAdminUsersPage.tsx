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
  ADMIN_LABEL,
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
  { value: "with_wallet", label: "With wallet" },
  { value: "kyc_approved", label: "KYC approved" },
  { value: "kyc_pending", label: "KYC pending" },
  { value: "legacy", label: "Pre-Privy" },
];

function AdminPrivySupportPanel() {
  const funding = usePrivyFundingStatus();
  const targetChainId = resolveFundingTargetChainId();
  const chainLabel = getChainDefinition(targetChainId).shortLabel;
  const env = resolvePrivyFundingEnvironment();

  const readyLabel =
    funding.ready === null
      ? "…"
      : funding.ready
        ? "Ready"
        : "Not ready";

  const readyClass =
    funding.ready === true
      ? "text-emerald-700"
      : funding.ready === false
        ? "text-amber-700"
        : "text-zinc-600";

  return (
    <div className={`${ADMIN_ARTICLE} mb-6`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">Privy & Add funds</h2>
          <p className={`mt-1 max-w-2xl text-sm ${ADMIN_TEXT_SECONDARY}`}>
            User support for auth, wallets, and MoonPay top-ups. Per-user payment history
            lives in Privy / MoonPay dashboards — not in Tokenable admin.
          </p>
        </div>
        <a
          href={funding.dashboardUrl}
          target="_blank"
          rel="noreferrer"
          className={ADMIN_LINK_SM}
        >
          Privy Dashboard → Funding
        </a>
      </div>

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className={ADMIN_TEXT_META}>MoonPay status</dt>
          <dd className={`font-medium ${readyClass}`}>{readyLabel}</dd>
        </div>
        <div>
          <dt className={ADMIN_TEXT_META}>On-ramp env</dt>
          <dd className="font-medium text-zinc-900 capitalize">{env}</dd>
        </div>
        <div>
          <dt className={ADMIN_TEXT_META}>Funding target chain</dt>
          <dd className="font-medium text-zinc-900">
            {chainLabel} ({targetChainId})
          </dd>
        </div>
        <div>
          <dt className={ADMIN_TEXT_META}>Asset</dt>
          <dd className="font-medium text-zinc-900">USDC</dd>
        </div>
      </dl>

      {funding.isLoading ? (
        <p className={`mt-3 text-sm ${ADMIN_TEXT_SECONDARY}`}>Loading funding config…</p>
      ) : funding.error ? (
        <p className="mt-3 text-sm text-red-600" role="alert">
          Could not load funding settings — pass site access gate if enabled, then retry.
        </p>
      ) : funding.ready === false && funding.checklist.length > 0 ? (
        <ul className={`mt-3 list-disc space-y-1 pl-5 text-xs ${ADMIN_TEXT_SECONDARY}`}>
          {funding.checklist.slice(0, 3).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}

      <ul className={`mt-4 list-disc space-y-1 pl-5 text-xs ${ADMIN_TEXT_SECONDARY}`}>
        <li>
          <strong className="font-medium text-zinc-800">Add funds</strong> (header wallet
          menu) sends USDC via MoonPay to the user&apos;s{" "}
          <strong className="font-medium text-zinc-800">embedded Privy wallet</strong>{" "}
          (email/social) or primary external wallet (wallet login).
        </li>
        <li>
          Payment issues: confirm linked wallet, KYC status, header network matches funding
          chain, and MoonPay keys in Privy Dashboard.
        </li>
        <li>
          Look up a user in{" "}
          <a
            href="https://dashboard.privy.io/apps?page=users"
            target="_blank"
            rel="noreferrer"
            className={ADMIN_LINK_SM}
          >
            Privy Dashboard → Users
          </a>{" "}
          using their Privy ID from the expanded row.
        </li>
      </ul>
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
      <MarketplaceAdminPageHeader
        title="Users"
        subtitle="Search accounts, review Privy auth and wallets, and run support actions."
      />

      <AdminPrivySupportPanel />

      {stats ? (
        <div className={`${ADMIN_ARTICLE} mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5`}>
          <AdminStatTile label="Total users" value={stats.total} />
          <AdminStatTile label="Privy linked" value={stats.privy} />
          <AdminStatTile label="With wallet" value={stats.withWallet} />
          <AdminStatTile label="KYC approved" value={stats.kycApproved} />
          <AdminStatTile label="KYC pending" value={stats.kycPending} />
        </div>
      ) : null}

      <div className={`${ADMIN_ARTICLE} mb-6 space-y-4`}>
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
          <div className="min-w-[200px] flex-1">
            <label className={ADMIN_LABEL}>Search</label>
            <input
              className={ADMIN_INPUT}
              placeholder="Email, Privy ID, name, or wallet…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="flex items-end gap-2">
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
          </div>
        </form>
      </div>

      {listQuery.isLoading ? (
        <p className="text-base text-zinc-700">Loading users…</p>
      ) : listQuery.isError ? (
        <p className="text-base text-red-600" role="alert">
          {listQuery.error instanceof Error
            ? listQuery.error.message
            : "Failed to load users"}
        </p>
      ) : items.length === 0 ? (
        <p className="text-base text-zinc-700">No users match this filter.</p>
      ) : (
        <div className={ADMIN_LIST}>
          <p className={ADMIN_COUNT}>
            Showing {items.length} of {total.toLocaleString()} user
            {total === 1 ? "" : "s"}
            {search ? ` · search “${search}”` : ""}
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
                Previous
              </button>
              <span className="text-sm text-zinc-700">
                Page {page} of {Math.max(1, Math.ceil(total / ADMIN_USERS_PAGE_SIZE))}
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

"use client";

import { useState } from "react";
import type { AdminUserFilter } from "@/lib/core";
import {
  ADMIN_USERS_PAGE_SIZE,
  useMarketplaceAdminUserStats,
  useMarketplaceAdminUsers,
} from "@/hooks/marketplace-admin/useMarketplaceAdminUsers";
import {
  ADMIN_ARTICLE,
  ADMIN_BTN_LOAD_MORE,
  ADMIN_BTN_PRIMARY,
  ADMIN_BTN_SECONDARY,
  ADMIN_COUNT,
  ADMIN_INPUT,
  ADMIN_LABEL,
  ADMIN_LIST,
  ADMIN_SEGMENT,
  ADMIN_SEGMENT_BTN,
  ADMIN_SEGMENT_BTN_ACTIVE,
  ADMIN_TEXT_META,
} from "./adminUi";
import { MarketplaceAdminPageHeader } from "./MarketplaceAdminPageHeader";
import { MarketplaceAdminUserRow } from "./MarketplaceAdminUserRow";

const FILTERS: { value: AdminUserFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "privy", label: "Privy" },
  { value: "google", label: "Google" },
  { value: "email", label: "Email OTP" },
  { value: "wallet", label: "Wallet login" },
  { value: "with_wallet", label: "With wallet" },
  { value: "kyc_approved", label: "KYC approved" },
  { value: "kyc_pending", label: "KYC pending" },
  { value: "legacy", label: "Pre-Privy" },
];

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
        subtitle="Privy accounts — auth methods, linked wallets, KYC, and support actions."
      />

      {stats ? (
        <div
          className={`${ADMIN_ARTICLE} mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-10`}
        >
          {(
            [
              ["Total", stats.total],
              ["Privy", stats.privy],
              ["Google", stats.google],
              ["Email OTP", stats.emailOtp],
              ["Wallet login", stats.walletLogin],
              ["With wallet", stats.withWallet],
              ["KYC ✓", stats.kycApproved],
              ["KYC pending", stats.kycPending],
              ["Verified", stats.verified],
              ["Pre-Privy", stats.legacy],
            ] as const
          ).map(([label, val]) => (
            <div key={label}>
              <p className={`text-xs font-medium ${ADMIN_TEXT_META}`}>{label}</p>
              <p className="text-lg font-semibold text-zinc-900 sm:text-xl">
                {val.toLocaleString()}
              </p>
            </div>
          ))}
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

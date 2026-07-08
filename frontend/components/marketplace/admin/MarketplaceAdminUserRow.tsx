"use client";

import { useEffect, useState } from "react";
import type { AdminUserSummary } from "@/lib/core";
import {
  formatAdminUserEmail,
  formatAuthProviderLabel,
  formatKycStatus,
  formatPrivyAuthMethod,
  privyAuthMethodBadgeClass,
} from "@/lib/core/api/marketplace-admin-users";
import { useMarketplaceAdminUserDetail } from "@/hooks/marketplace-admin/useMarketplaceAdminUsers";
import {
  ADMIN_ARTICLE,
  ADMIN_BTN_DANGER_EMPHASIS_ALT,
  ADMIN_BTN_PRIMARY,
  ADMIN_BTN_SECONDARY,
  ADMIN_DETAILS_DANGER_SUMMARY,
  ADMIN_INPUT,
  ADMIN_INPUT_MONO,
  ADMIN_LABEL,
  ADMIN_PANEL_DANGER_DARK_COMPACT,
  ADMIN_SEGMENT,
  ADMIN_SEGMENT_BTN,
  ADMIN_SEGMENT_BTN_ACTIVE,
} from "./adminUi";

type DetailTab = "overview" | "auth" | "wallets" | "watchlist";

type ActionInput = {
  userId: string;
  action: "force-verify" | "link-wallet" | "unlink-wallet" | "remove-watchlist";
  address?: string;
  collectionKey?: string;
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function kycBadgeClass(status: AdminUserSummary["kycStatus"]): string {
  if (status === "approved") {
    return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
  }
  if (status === "pending") {
    return "bg-sky-50 text-sky-700 ring-1 ring-sky-200";
  }
  if (status === "rejected") {
    return "bg-red-50 text-red-700 ring-1 ring-red-200";
  }
  return "bg-zinc-100 text-zinc-600 ring-1 ring-zinc-200";
}

const DETAIL_TABS: { id: DetailTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "auth", label: "Privy auth" },
  { id: "wallets", label: "Wallets" },
  { id: "watchlist", label: "Watchlist" },
];

export function MarketplaceAdminUserRow({
  row,
  expanded,
  onToggle,
  busy,
  onAction,
  onPatchName,
  onDelete,
}: {
  row: AdminUserSummary;
  expanded: boolean;
  onToggle: () => void;
  busy: boolean;
  onAction: (input: ActionInput) => Promise<void>;
  onPatchName: (userId: string, name: string) => Promise<void>;
  onDelete: (userId: string) => Promise<void>;
}) {
  const detailQuery = useMarketplaceAdminUserDetail(row.id, expanded);
  const detail = detailQuery.data;

  const [tab, setTab] = useState<DetailTab>("overview");
  const [nameInput, setNameInput] = useState(row.name ?? "");
  const [walletInput, setWalletInput] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    setNameInput(row.name ?? "");
    setActionError(null);
    if (!expanded) {
      setTab("overview");
      setWalletInput("");
      setDeleteConfirm("");
    }
  }, [row.id, row.name, expanded]);

  const runAction = async (input: ActionInput) => {
    setActionError(null);
    try {
      await onAction(input);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Action failed");
    }
  };

  const primaryWallet = detail?.wallets.find((w) => w.isPrimary) ?? detail?.wallets[0];

  return (
    <article className={ADMIN_ARTICLE}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-zinc-900 sm:text-lg">
            {formatAdminUserEmail(row.email)}
          </p>
          {row.name ? (
            <p className="mt-0.5 text-sm text-zinc-600">{row.name}</p>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-2">
            <span
              className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${privyAuthMethodBadgeClass(row.privyAuthMethod)}`}
            >
              {formatPrivyAuthMethod(row.privyAuthMethod)}
            </span>
            <span
              className={`rounded-md px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${kycBadgeClass(row.kycStatus)}`}
            >
              {formatKycStatus(row.kycStatus)}
            </span>
            {row.privyId ? (
              <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-700 ring-1 ring-indigo-200">
                Privy linked
              </span>
            ) : (
              <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-800 ring-1 ring-amber-200">
                No Privy ID
              </span>
            )}
            {row.walletCount > 0 ? (
              <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600 ring-1 ring-zinc-200">
                {row.walletCount} wallet{row.walletCount === 1 ? "" : "s"}
              </span>
            ) : null}
          </div>
          {row.walletAddress ? (
            <p className="mt-2 font-mono text-[11px] text-zinc-700">
              Primary {row.walletAddress}
            </p>
          ) : null}
          <p className="mt-1 font-mono text-[10px] text-zinc-500">{row.id}</p>
          <p className="mt-0.5 text-xs text-zinc-600">Joined {formatDate(row.createdAt)}</p>
        </div>
        <button type="button" onClick={onToggle} className={ADMIN_BTN_SECONDARY}>
          {expanded ? "Collapse" : "Manage"}
        </button>
      </div>

      {expanded ? (
        <div className="mt-5 space-y-5 border-t border-zinc-200 pt-5">
          {detailQuery.isLoading ? (
            <p className="text-sm text-zinc-700">Loading user detail…</p>
          ) : detailQuery.isError ? (
            <p className="text-sm text-red-600" role="alert">
              {detailQuery.error instanceof Error
                ? detailQuery.error.message
                : "Failed to load detail"}
            </p>
          ) : detail ? (
            <>
              <div className={`flex flex-wrap gap-1 ${ADMIN_SEGMENT}`}>
                {DETAIL_TABS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTab(t.id)}
                    className={
                      tab === t.id ? ADMIN_SEGMENT_BTN_ACTIVE : ADMIN_SEGMENT_BTN
                    }
                  >
                    {t.label}
                    {t.id === "wallets" && detail.wallets.length > 0
                      ? ` (${detail.wallets.length})`
                      : ""}
                    {t.id === "watchlist" && detail.watchlistKeys.length > 0
                      ? ` (${detail.watchlistKeys.length})`
                      : ""}
                  </button>
                ))}
              </div>

              {tab === "overview" ? (
                <section className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className={ADMIN_LABEL}>Display name</label>
                      <input
                        className={ADMIN_INPUT}
                        value={nameInput}
                        onChange={(e) => setNameInput(e.target.value)}
                        disabled={busy}
                      />
                    </div>
                    <div className="flex items-end gap-2">
                      <button
                        type="button"
                        className={ADMIN_BTN_PRIMARY}
                        disabled={busy}
                        onClick={() => void onPatchName(row.id, nameInput)}
                      >
                        Save name
                      </button>
                      {!detail.emailVerified ? (
                        <button
                          type="button"
                          className={ADMIN_BTN_SECONDARY}
                          disabled={busy}
                          onClick={() =>
                            void runAction({ userId: row.id, action: "force-verify" })
                          }
                        >
                          Mark email verified
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <dl className="grid gap-3 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-zinc-600">Privy ID</dt>
                      <dd className="break-all font-mono text-xs text-zinc-800">
                        {detail.privyId ?? "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-zinc-600">Auth method</dt>
                      <dd className="text-zinc-800">
                        {formatPrivyAuthMethod(detail.privyAuthMethod)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-zinc-600">Email verified</dt>
                      <dd className="text-zinc-800">
                        {detail.emailVerified ? "Yes" : "No"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-zinc-600">Last Privy sync</dt>
                      <dd className="text-zinc-800">
                        {detail.lastPrivySyncAt
                          ? formatDate(detail.lastPrivySyncAt)
                          : "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-zinc-600">KYC</dt>
                      <dd className="text-zinc-800">
                        {formatKycStatus(detail.kycStatus)}
                        {detail.kycVerifiedAt
                          ? ` · ${formatDate(detail.kycVerifiedAt)}`
                          : ""}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-zinc-600">Primary wallet</dt>
                      <dd className="break-all font-mono text-xs text-zinc-800">
                        {primaryWallet?.walletAddress ?? detail.walletAddress ?? "—"}
                        {primaryWallet?.walletKind === "embedded" ? " (embedded)" : ""}
                        {primaryWallet?.walletKind === "external" ? " (external)" : ""}
                      </dd>
                    </div>
                  </dl>
                </section>
              ) : null}

              {tab === "auth" ? (
                <section>
                  <p className="text-sm text-zinc-600">
                    Linked Privy authentication methods synced from{" "}
                    <code className="text-zinc-800">user_auth_providers</code>.
                  </p>
                  {detail.authProviders.length === 0 ? (
                    <p className="mt-3 text-sm text-zinc-700">No providers recorded.</p>
                  ) : (
                    <ul className="mt-3 space-y-2">
                      {detail.authProviders.map((p) => (
                        <li
                          key={p.id}
                          className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm"
                        >
                          <p className="font-medium text-zinc-900">
                            {formatAuthProviderLabel(p.providerType)}
                            {p.isVerified ? (
                              <span className="ml-2 text-[10px] uppercase text-emerald-600">
                                verified
                              </span>
                            ) : null}
                          </p>
                          <p className="mt-0.5 break-all font-mono text-[11px] text-zinc-600">
                            {p.providerSubject}
                          </p>
                          {p.email ? (
                            <p className="mt-0.5 text-xs text-zinc-600">{p.email}</p>
                          ) : null}
                          <p className="mt-0.5 text-[10px] text-zinc-500">
                            Linked {formatDate(p.linkedAt)}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              ) : null}

              {tab === "wallets" ? (
                <section>
                  <p className="text-sm text-zinc-600">
                    Embedded Privy wallet is the signing primary for email/social users.
                    External wallets (MetaMask) are primary for wallet-first sign-ups.
                  </p>
                  {detail.wallets.length === 0 ? (
                    <p className="mt-3 text-sm text-zinc-700">No linked wallets.</p>
                  ) : (
                    <ul className="mt-3 space-y-2">
                      {detail.wallets.map((w) => (
                        <li
                          key={w.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2"
                        >
                          <div>
                            <p className="font-mono text-xs text-zinc-800">
                              {w.walletAddress}
                              {w.isPrimary ? (
                                <span className="ml-2 text-[10px] uppercase text-amber-600">
                                  primary
                                </span>
                              ) : null}
                              {w.walletKind === "embedded" ? (
                                <span className="ml-2 text-[10px] uppercase text-indigo-600">
                                  embedded
                                </span>
                              ) : (
                                <span className="ml-2 text-[10px] uppercase text-violet-600">
                                  external
                                </span>
                              )}
                            </p>
                            <p className="text-[10px] text-zinc-600">
                              {w.chainType}
                              {w.walletClient ? ` · ${w.walletClient}` : ""}
                              {w.connectorType ? ` · ${w.connectorType}` : ""}
                              {` · ${w.source}`}
                            </p>
                          </div>
                          <button
                            type="button"
                            className={ADMIN_BTN_SECONDARY}
                            disabled={busy}
                            onClick={() =>
                              void runAction({
                                userId: row.id,
                                action: "unlink-wallet",
                                address: w.walletAddress,
                              })
                            }
                          >
                            Unlink
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <input
                      className={`${ADMIN_INPUT_MONO} min-w-[240px] flex-1`}
                      placeholder="0x… admin override link"
                      value={walletInput}
                      onChange={(e) => setWalletInput(e.target.value)}
                      disabled={busy}
                    />
                    <button
                      type="button"
                      className={ADMIN_BTN_SECONDARY}
                      disabled={busy || !walletInput.trim()}
                      onClick={() =>
                        void runAction({
                          userId: row.id,
                          action: "link-wallet",
                          address: walletInput,
                        })
                      }
                    >
                      Link wallet
                    </button>
                  </div>
                </section>
              ) : null}

              {tab === "watchlist" ? (
                <section>
                  {detail.watchlistKeys.length === 0 ? (
                    <p className="text-sm text-zinc-700">Empty watchlist.</p>
                  ) : (
                    <ul className="max-h-48 space-y-1 overflow-y-auto">
                      {detail.watchlistKeys.map((key) => (
                        <li
                          key={key}
                          className="flex items-center justify-between gap-2 rounded-md border border-zinc-200 px-2 py-1.5"
                        >
                          <span className="truncate font-mono text-[11px] text-zinc-700">
                            {key}
                          </span>
                          <button
                            type="button"
                            className="shrink-0 text-[11px] font-semibold text-red-600 hover:text-red-700"
                            disabled={busy}
                            onClick={() =>
                              void runAction({
                                userId: row.id,
                                action: "remove-watchlist",
                                collectionKey: key,
                              })
                            }
                          >
                            Remove
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              ) : null}

              <details className={ADMIN_PANEL_DANGER_DARK_COMPACT}>
                <summary className={ADMIN_DETAILS_DANGER_SUMMARY}>
                  Danger zone
                </summary>
                <div className="mt-3 space-y-2">
                  <p className="text-xs text-zinc-600">
                    Type <span className="font-mono text-zinc-700">DELETE</span> to
                    permanently remove this Privy account record (wallets, watchlist,
                    tokens).
                  </p>
                  <input
                    className={ADMIN_INPUT}
                    value={deleteConfirm}
                    onChange={(e) => setDeleteConfirm(e.target.value)}
                    placeholder="DELETE"
                    disabled={busy}
                  />
                  <button
                    type="button"
                    className={ADMIN_BTN_DANGER_EMPHASIS_ALT}
                    disabled={busy || deleteConfirm !== "DELETE"}
                    onClick={() => void onDelete(row.id)}
                  >
                    Delete user
                  </button>
                </div>
              </details>
            </>
          ) : null}

          {actionError ? (
            <p className="text-sm text-red-600" role="alert">
              {actionError}
            </p>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

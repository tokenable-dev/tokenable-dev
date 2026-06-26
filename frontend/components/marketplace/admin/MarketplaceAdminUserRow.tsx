"use client";

import { useEffect, useState } from "react";
import type { AdminUserSummary } from "@/lib/core";
import {
  useMarketplaceAdminUserDetail,
} from "@/hooks/marketplace-admin/useMarketplaceAdminUsers";
import {
  ADMIN_ARTICLE,
  ADMIN_BTN_PRIMARY,
  ADMIN_BTN_SECONDARY,
  ADMIN_DETAILS_SUMMARY,
  ADMIN_INPUT,
  ADMIN_INPUT_MONO,
  ADMIN_LABEL,
} from "./adminUi";

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function signupLabel(type: AdminUserSummary["signupType"]): string {
  if (type === "google") return "Google";
  if (type === "google+email") return "Google + email";
  return "Email";
}

type ActionInput = {
  userId: string;
  action:
    | "resend-verification"
    | "send-password-reset"
    | "force-verify"
    | "clear-tokens"
    | "set-password"
    | "link-wallet"
    | "unlink-wallet"
    | "remove-watchlist";
  password?: string;
  address?: string;
  collectionKey?: string;
};

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

  const [nameInput, setNameInput] = useState(row.name ?? "");
  const [walletInput, setWalletInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    setNameInput(row.name ?? "");
    setActionError(null);
    if (!expanded) {
      setWalletInput("");
      setPasswordInput("");
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

  return (
    <article className={ADMIN_ARTICLE}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-zinc-900 sm:text-lg">
            {row.email}
          </p>
          {row.name ? (
            <p className="mt-0.5 text-sm text-zinc-600">{row.name}</p>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-2">
            <span
              className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                row.emailVerified
                  ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                  : "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
              }`}
            >
              {row.emailVerified ? "Verified" : "Unverified"}
            </span>
            <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600 ring-1 ring-zinc-200">
              {signupLabel(row.signupType)}
            </span>
            {row.walletCount > 0 ? (
              <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600 ring-1 ring-zinc-200">
                {row.walletCount} wallet{row.walletCount === 1 ? "" : "s"}
              </span>
            ) : null}
            {row.watchlistCount > 0 ? (
              <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600 ring-1 ring-zinc-200">
                {row.watchlistCount} watchlist
              </span>
            ) : null}
          </div>
          <p className="mt-2 font-mono text-[11px] text-zinc-700">{row.id}</p>
          <p className="mt-1 text-xs text-zinc-600">Joined {formatDate(row.createdAt)}</p>
        </div>
        <button
          type="button"
          onClick={onToggle}
          className={ADMIN_BTN_SECONDARY}
        >
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
              <section>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-600">
                  Profile
                </h4>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className={ADMIN_LABEL}>Display name</label>
                    <input
                      className={ADMIN_INPUT}
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      disabled={busy}
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      type="button"
                      className={ADMIN_BTN_PRIMARY}
                      disabled={busy}
                      onClick={() => void onPatchName(row.id, nameInput)}
                    >
                      Save name
                    </button>
                  </div>
                </div>
                <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-zinc-600">Google ID</dt>
                    <dd className="font-mono text-xs text-zinc-700">
                      {detail.googleId ?? "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-zinc-600">Has password</dt>
                    <dd className="text-zinc-800">{detail.hasPassword ? "Yes" : "No"}</dd>
                  </div>
                  <div>
                    <dt className="text-zinc-600">Pending email verify</dt>
                    <dd className="text-zinc-800">
                      {detail.pendingEmailVerification ? "Yes" : "No"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-zinc-600">Pending password reset</dt>
                    <dd className="text-zinc-800">
                      {detail.pendingPasswordReset ? "Yes" : "No"}
                    </dd>
                  </div>
                </dl>
              </section>

              <section>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-600">
                  Wallets
                </h4>
                {detail.wallets.length === 0 ? (
                  <p className="mt-2 text-sm text-zinc-700">No linked wallets.</p>
                ) : (
                  <ul className="mt-2 space-y-2">
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
                          </p>
                          <p className="text-[10px] text-zinc-700">
                            Linked {formatDate(w.linkedAt)}
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
                <div className="mt-3 flex flex-wrap gap-2">
                  <input
                    className={`${ADMIN_INPUT_MONO} min-w-[240px] flex-1`}
                    placeholder="0x… link wallet"
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

              <section>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-600">
                  Watchlist ({detail.watchlistKeys.length})
                </h4>
                {detail.watchlistKeys.length === 0 ? (
                  <p className="mt-2 text-sm text-zinc-700">Empty watchlist.</p>
                ) : (
                  <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto">
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

              <section>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-600">
                  Account actions
                </h4>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={ADMIN_BTN_SECONDARY}
                    disabled={busy || detail.emailVerified}
                    onClick={() =>
                      void runAction({ userId: row.id, action: "resend-verification" })
                    }
                  >
                    Resend verification
                  </button>
                  <button
                    type="button"
                    className={ADMIN_BTN_SECONDARY}
                    disabled={busy}
                    onClick={() =>
                      void runAction({ userId: row.id, action: "force-verify" })
                    }
                  >
                    Force verify email
                  </button>
                  <button
                    type="button"
                    className={ADMIN_BTN_SECONDARY}
                    disabled={busy || !detail.hasPassword}
                    onClick={() =>
                      void runAction({ userId: row.id, action: "send-password-reset" })
                    }
                  >
                    Send reset email
                  </button>
                  <button
                    type="button"
                    className={ADMIN_BTN_SECONDARY}
                    disabled={busy}
                    onClick={() =>
                      void runAction({ userId: row.id, action: "clear-tokens" })
                    }
                  >
                    Clear pending tokens
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap items-end gap-2">
                  <div className="min-w-[200px] flex-1">
                    <label className={ADMIN_LABEL}>Set password</label>
                    <input
                      type="password"
                      className={ADMIN_INPUT}
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      disabled={busy}
                      autoComplete="new-password"
                    />
                  </div>
                  <button
                    type="button"
                    className={ADMIN_BTN_SECONDARY}
                    disabled={busy || passwordInput.length < 8}
                    onClick={() =>
                      void runAction({
                        userId: row.id,
                        action: "set-password",
                        password: passwordInput,
                      })
                    }
                  >
                    Set password
                  </button>
                </div>
              </section>

              <details className="rounded-xl border border-red-900/40 bg-red-950/20 p-3">
                <summary className={`${ADMIN_DETAILS_SUMMARY} text-red-600`}>
                  Danger zone
                </summary>
                <div className="mt-3 space-y-2">
                  <p className="text-xs text-zinc-600">
                    Type <span className="font-mono text-zinc-700">DELETE</span> to
                    permanently remove this account (wallets, watchlist, tokens).
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
                    className="rounded-xl border border-red-500/50 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-300 hover:bg-red-500/20 disabled:opacity-50"
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

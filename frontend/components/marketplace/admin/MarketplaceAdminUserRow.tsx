"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { AdminUserDetail, AdminUserSummary } from "@/lib/core";
import {
  formatAdminUserEmail,
  formatAuthProviderLabel,
  formatKycStatus,
} from "@/lib/core/api/marketplace-admin-users";
import {
  ADMIN_ARTICLE,
  ADMIN_BTN_DANGER_EMPHASIS_ALT,
  ADMIN_BTN_PRIMARY,
  ADMIN_BTN_SECONDARY,
  ADMIN_DETAILS_DANGER_SUMMARY,
  ADMIN_INPUT,
  ADMIN_INPUT_MONO,
  ADMIN_LABEL,
  ADMIN_LINK_SM,
  ADMIN_PANEL_DANGER_DARK_COMPACT,
  ADMIN_TEXT_META,
  ADMIN_TEXT_SECONDARY,
} from "./adminUi";

type ActionInput = {
  userId: string;
  action:
    | "force-verify"
    | "link-wallet"
    | "unlink-wallet"
    | "remove-watchlist"
    | "kyc";
  address?: string;
  collectionKey?: string;
  kycStatus?: AdminUserSummary["kycStatus"];
  kycReason?: string | null;
};

const PRIVY_USERS_DASHBOARD_URL = "https://dashboard.privy.io/apps?page=users";
const SUMSUB_APPLICANTS_URL = "https://cockpit.sumsub.com/checkus#/applicants";

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

function Meta({
  label,
  children,
  mono,
}: {
  label: string;
  children: ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className={ADMIN_TEXT_META}>{label}</dt>
      <dd
        className={`mt-0.5 break-all text-xs text-zinc-800 ${mono ? "font-mono" : ""}`}
      >
        {children}
      </dd>
    </div>
  );
}

/** Identity / KYC / wallets / delete — shown on user detail under the redesign hero. */
export function MarketplaceAdminUserManagePanel({
  detail,
  busy,
  onAction,
  onPatchName,
  onDelete,
}: {
  detail: AdminUserDetail;
  busy: boolean;
  onAction: (input: ActionInput) => Promise<void>;
  onPatchName: (userId: string, name: string) => Promise<void>;
  onDelete: (userId: string) => Promise<void>;
}) {
  const [nameInput, setNameInput] = useState(detail.name ?? "");
  const [walletInput, setWalletInput] = useState("");
  const [kycReason, setKycReason] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    setNameInput(detail.name ?? "");
    setActionError(null);
  }, [detail.id, detail.name]);

  const runAction = async (input: ActionInput) => {
    setActionError(null);
    try {
      await onAction(input);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed");
    }
  };

  return (
    <article className={ADMIN_ARTICLE}>
      <h2 className="text-sm font-semibold text-zinc-900">계정 관리</h2>
      <p className={`mt-1 text-xs ${ADMIN_TEXT_SECONDARY}`}>
        KYC override · 지갑 · 삭제 (레거시 도구)
      </p>

      <div className="mt-4 space-y-4 border-t border-zinc-200 pt-4">
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Identity
          </h3>
          <dl className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Meta label="User ID" mono>
              {detail.id}
            </Meta>
            <Meta label="Email">{formatAdminUserEmail(detail.email)}</Meta>
            <Meta label="Privy ID" mono>
              {detail.privyId ?? "—"}
              {detail.privyId ? (
                <>
                  {" "}
                  <a
                    href={PRIVY_USERS_DASHBOARD_URL}
                    target="_blank"
                    rel="noreferrer"
                    className={ADMIN_LINK_SM}
                  >
                    Privy
                  </a>
                </>
              ) : null}
            </Meta>
            <Meta label="Google ID" mono>
              {detail.googleId ?? "—"}
            </Meta>
            <Meta label="Email verified">
              {detail.emailVerified ? "yes" : "no"}
              {!detail.emailVerified ? (
                <>
                  {" "}
                  <button
                    type="button"
                    className={ADMIN_LINK_SM}
                    disabled={busy}
                    onClick={() =>
                      void runAction({
                        userId: detail.id,
                        action: "force-verify",
                      })
                    }
                  >
                    verify
                  </button>
                </>
              ) : null}
            </Meta>
            <Meta label="Password hash">
              {detail.hasPassword ? "yes" : "no"}
            </Meta>
            <Meta label="Privy sync">
              {detail.lastPrivySyncAt
                ? formatDate(detail.lastPrivySyncAt)
                : "—"}
            </Meta>
            <Meta label="Updated">{formatDate(detail.updatedAt)}</Meta>
          </dl>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <div className="min-w-[160px] flex-1">
              <label className={ADMIN_LABEL}>Name</label>
              <input
                className={ADMIN_INPUT}
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                disabled={busy}
              />
            </div>
            <button
              type="button"
              className={ADMIN_BTN_PRIMARY}
              disabled={busy}
              onClick={() => void onPatchName(detail.id, nameInput)}
            >
              Save
            </button>
          </div>
        </section>

        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            KYC / Sumsub
          </h3>
          <dl className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Meta label="Status">
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${kycBadgeClass(detail.kycStatus)}`}
              >
                {formatKycStatus(detail.kycStatus)}
              </span>
            </Meta>
            <Meta label="Provider">{detail.kycProvider ?? "—"}</Meta>
            <Meta label="Applicant" mono>
              {detail.kycExternalId ?? "—"}
              {detail.kycExternalId ? (
                <>
                  {" "}
                  <a
                    href={SUMSUB_APPLICANTS_URL}
                    target="_blank"
                    rel="noreferrer"
                    className={ADMIN_LINK_SM}
                  >
                    Sumsub
                  </a>
                </>
              ) : null}
            </Meta>
            <Meta label="Verified at">
              {detail.kycVerifiedAt ? formatDate(detail.kycVerifiedAt) : "—"}
            </Meta>
            <Meta label="Reject reason">
              {detail.kycRejectionReason ?? "—"}
            </Meta>
          </dl>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <button
              type="button"
              className={ADMIN_BTN_SECONDARY}
              disabled={busy || detail.kycStatus === "approved"}
              onClick={() =>
                void runAction({
                  userId: detail.id,
                  action: "kyc",
                  kycStatus: "approved",
                })
              }
            >
              Approve
            </button>
            <button
              type="button"
              className={ADMIN_BTN_SECONDARY}
              disabled={busy || detail.kycStatus === "pending"}
              onClick={() =>
                void runAction({
                  userId: detail.id,
                  action: "kyc",
                  kycStatus: "pending",
                })
              }
            >
              Pending
            </button>
            <button
              type="button"
              className={ADMIN_BTN_SECONDARY}
              disabled={busy || detail.kycStatus === "none"}
              onClick={() =>
                void runAction({
                  userId: detail.id,
                  action: "kyc",
                  kycStatus: "none",
                })
              }
            >
              Reset
            </button>
            <div className="min-w-[180px] flex-1">
              <label className={ADMIN_LABEL}>Reject reason</label>
              <input
                className={ADMIN_INPUT}
                value={kycReason}
                onChange={(e) => setKycReason(e.target.value)}
                disabled={busy}
                placeholder="required"
              />
            </div>
            <button
              type="button"
              className={ADMIN_BTN_SECONDARY}
              disabled={busy || !kycReason.trim()}
              onClick={() =>
                void runAction({
                  userId: detail.id,
                  action: "kyc",
                  kycStatus: "rejected",
                  kycReason: kycReason.trim(),
                })
              }
            >
              Reject
            </button>
          </div>
          {detail.kycEvents.length > 0 ? (
            <ul className="mt-3 max-h-40 space-y-1 overflow-y-auto rounded-md border border-zinc-200 bg-zinc-50 p-2">
              {detail.kycEvents.map((e) => (
                <li
                  key={e.id}
                  className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 font-mono text-[10px] text-zinc-700"
                >
                  <span className="text-zinc-500">{formatDate(e.createdAt)}</span>
                  <span className={kycBadgeClass(e.status)}>{e.status}</span>
                  <span>{e.provider}</span>
                  {e.source ? <span>·{e.source}</span> : null}
                  {e.externalId ? (
                    <span className="truncate">{e.externalId}</span>
                  ) : null}
                  {e.reason ? (
                    <span className="text-red-700">{e.reason}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className={`mt-2 text-xs ${ADMIN_TEXT_SECONDARY}`}>No KYC events</p>
          )}
        </section>

        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Auth providers ({detail.authProviders.length})
          </h3>
          {detail.authProviders.length === 0 ? (
            <p className={`mt-2 text-xs ${ADMIN_TEXT_SECONDARY}`}>—</p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {detail.authProviders.map((p) => (
                <li
                  key={p.id}
                  className="rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 font-mono text-[10px] text-zinc-700"
                >
                  <span className="font-sans text-xs font-semibold text-zinc-800">
                    {formatAuthProviderLabel(p.providerType)}
                  </span>
                  {p.isVerified ? " ✓" : " —"}
                  {" · "}
                  <span className="break-all">{p.providerSubject}</span>
                  {p.email ? ` · ${p.email}` : ""}
                  {p.phone ? ` · ${p.phone}` : ""}
                  {p.displayName ? ` · ${p.displayName}` : ""}
                  <span className="text-zinc-500">
                    {" "}
                    · {formatDate(p.linkedAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Wallets ({detail.wallets.length})
          </h3>
          {detail.wallets.length === 0 ? (
            <p className={`mt-2 text-xs ${ADMIN_TEXT_SECONDARY}`}>—</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {detail.wallets.map((w) => (
                <li
                  key={w.id}
                  className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2"
                >
                  <div className="min-w-0 font-mono text-[10px] text-zinc-700">
                    <p className="break-all text-xs text-zinc-900">
                      {w.walletAddress}
                      {w.isPrimary ? (
                        <span className="ml-1 font-sans text-[9px] uppercase text-amber-600">
                          primary
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-0.5 text-zinc-500">
                      {w.walletKind} · {w.source}
                      {w.walletClient ? ` · ${w.walletClient}` : ""}
                      {w.connectorType ? ` · ${w.connectorType}` : ""}
                      {` · ${w.chainType}`}
                      {w.privyWalletId ? ` · ${w.privyWalletId}` : ""}
                      {` · ${formatDate(w.linkedAt)}`}
                    </p>
                  </div>
                  <button
                    type="button"
                    className={ADMIN_BTN_SECONDARY}
                    disabled={busy}
                    onClick={() =>
                      void runAction({
                        userId: detail.id,
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
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              className={`${ADMIN_INPUT_MONO} min-w-[200px] flex-1`}
              placeholder="0x…"
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
                  userId: detail.id,
                  action: "link-wallet",
                  address: walletInput,
                })
              }
            >
              Link
            </button>
          </div>
        </section>

        {detail.watchlistKeys.length > 0 ? (
          <details className="rounded-lg border border-zinc-200 px-3 py-2">
            <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Watchlist ({detail.watchlistKeys.length})
            </summary>
            <ul className="mt-2 max-h-36 space-y-1 overflow-y-auto">
              {detail.watchlistKeys.map((key) => (
                <li
                  key={key}
                  className="flex items-center justify-between gap-2 rounded-md border border-zinc-200 px-2 py-1"
                >
                  <span className="truncate font-mono text-[10px] text-zinc-700">
                    {key}
                  </span>
                  <button
                    type="button"
                    className="shrink-0 text-xs font-semibold text-red-600"
                    disabled={busy}
                    onClick={() =>
                      void runAction({
                        userId: detail.id,
                        action: "remove-watchlist",
                        collectionKey: key,
                      })
                    }
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          </details>
        ) : null}

        <details className={ADMIN_PANEL_DANGER_DARK_COMPACT}>
          <summary className={ADMIN_DETAILS_DANGER_SUMMARY}>Delete</summary>
          <div className="mt-2 flex flex-wrap gap-2">
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
              onClick={() => void onDelete(detail.id)}
            >
              Confirm
            </button>
          </div>
        </details>

        {actionError ? (
          <p className="text-sm text-red-600" role="alert">
            {actionError}
          </p>
        ) : null}
      </div>
    </article>
  );
}

/** @deprecated Prefer MarketplaceAdminUserManagePanel on detail route */
export { MarketplaceAdminUserManagePanel as MarketplaceAdminUserRow };

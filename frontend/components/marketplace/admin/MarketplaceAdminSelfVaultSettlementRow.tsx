"use client";

import type { SelfVaultSettlement } from "@/lib/core";
import {
  ADMIN_ARTICLE,
  ADMIN_BTN_DANGER,
  ADMIN_BTN_PRIMARY,
  ADMIN_BTN_SECONDARY,
  ADMIN_TEXT_META,
  ADMIN_TEXT_MUTED,
} from "./adminUi";

function shortAddr(addr: string): string {
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function formatUsdcMicros(micros: string): string {
  try {
    const n = Number(BigInt(micros)) / 1e6;
    if (!Number.isFinite(n)) return micros;
    return n.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  } catch {
    return micros;
  }
}

function statusLabel(status: SelfVaultSettlement["status"]): string {
  switch (status) {
    case "pending_confirm":
      return "Pending confirm";
    case "confirmed":
      return "Ready to pay";
    case "paid":
      return "Paid";
    case "rejected":
      return "Rejected";
    default:
      return status;
  }
}

function statusClass(status: SelfVaultSettlement["status"]): string {
  switch (status) {
    case "pending_confirm":
      return "bg-amber-50 text-amber-800 ring-amber-200";
    case "confirmed":
      return "bg-sky-50 text-sky-800 ring-sky-200";
    case "paid":
      return "bg-emerald-50 text-emerald-800 ring-emerald-200";
    case "rejected":
      return "bg-red-50 text-red-700 ring-red-200";
    default:
      return "bg-zinc-50 text-zinc-700 ring-zinc-200";
  }
}

const AUTO_PAY_DELAY_MS = 5 * 60 * 1000;

function autoPayHint(row: SelfVaultSettlement): string | null {
  if (row.status !== "pending_confirm" && row.status !== "confirmed") {
    return null;
  }
  const created = new Date(row.createdAt).getTime();
  if (!Number.isFinite(created)) return null;
  const dueAt = created + AUTO_PAY_DELAY_MS;
  const remainingMs = dueAt - Date.now();
  if (remainingMs <= 0) {
    return "Auto-pay due (cron runs each minute)";
  }
  const mins = Math.ceil(remainingMs / 60_000);
  return `Auto-pay in ~${mins} min`;
}

export function MarketplaceAdminSelfVaultSettlementRow({
  row,
  saleIndex,
  busy,
  onConfirm,
  onReject,
  onExecutePayout,
}: {
  row: SelfVaultSettlement;
  /** When the same token has multiple open payouts (resale before settle). */
  saleIndex?: { index: number; total: number };
  busy: boolean;
  onConfirm: () => void;
  onReject: () => void;
  onExecutePayout: () => void;
}) {
  const canConfirm = row.status === "pending_confirm";
  /** Admin early pay — also works from pending_confirm (auto-confirms). */
  const canPay =
    row.status === "pending_confirm" || row.status === "confirmed";
  const canReject =
    row.status === "pending_confirm" || row.status === "confirmed";
  const payoutLabel = formatUsdcMicros(row.sellerPayoutUsdc);
  const autoHint = autoPayHint(row);
  const multiSale = saleIndex != null && saleIndex.total > 1;

  return (
    <article className={ADMIN_ARTICLE}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-base font-semibold text-zinc-900">
              Token #{row.tokenId}
            </p>
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${statusClass(row.status)}`}
            >
              {statusLabel(row.status)}
            </span>
            {multiSale ? (
              <span className="inline-flex items-center rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-800 ring-1 ring-inset ring-violet-200">
                Sale {saleIndex.index} of {saleIndex.total}
              </span>
            ) : null}
          </div>
          <p className={`text-sm ${ADMIN_TEXT_MUTED}`}>
            Gross ${formatUsdcMicros(row.grossUsdc)} → seller payout{" "}
            <span className="font-semibold text-zinc-900">
              ${formatUsdcMicros(row.sellerPayoutUsdc)}
            </span>
            {autoHint ? (
              <>
                {" "}
                · <span className="text-zinc-700">{autoHint}</span>
              </>
            ) : null}
          </p>
        </div>
        <p className={`text-xs ${ADMIN_TEXT_META}`}>
          {new Date(row.createdAt).toLocaleString()}
        </p>
      </div>

      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className={ADMIN_TEXT_META}>Seller</dt>
          <dd className="font-mono text-zinc-800">{shortAddr(row.sellerWallet)}</dd>
        </div>
        <div>
          <dt className={ADMIN_TEXT_META}>Buyer</dt>
          <dd className="font-mono text-zinc-800">{shortAddr(row.buyerWallet)}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className={ADMIN_TEXT_META}>Order</dt>
          <dd className="break-all font-mono text-xs text-zinc-700">
            {row.orderHash}
          </dd>
        </div>
        {row.fulfillTxHash ? (
          <div className="sm:col-span-2">
            <dt className={ADMIN_TEXT_META}>Fulfill tx</dt>
            <dd className="break-all font-mono text-xs text-zinc-700">
              {row.fulfillTxHash}
            </dd>
          </div>
        ) : null}
        {row.payoutTxHash ? (
          <div className="sm:col-span-2">
            <dt className={ADMIN_TEXT_META}>Payout tx</dt>
            <dd className="break-all font-mono text-xs text-zinc-700">
              {row.payoutTxHash}
            </dd>
          </div>
        ) : null}
      </dl>

      {canConfirm || canPay || canReject ? (
        <div className="mt-4 space-y-3 border-t border-zinc-100 pt-4">
          {canPay ? (
            <div className="space-y-2">
              <button
                type="button"
                className={ADMIN_BTN_PRIMARY}
                disabled={busy}
                onClick={onExecutePayout}
              >
                Pay seller ${payoutLabel} USDC
              </button>
              <p className={`text-xs ${ADMIN_TEXT_MUTED}`}>
                Sends from PLATFORM_FEE wallet now (confirms if still pending).
                Otherwise auto-pays ~5 minutes after this sale.
              </p>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {canConfirm ? (
              <button
                type="button"
                className={ADMIN_BTN_SECONDARY}
                disabled={busy}
                onClick={onConfirm}
              >
                Mark confirmed
              </button>
            ) : null}
            {canReject ? (
              <button
                type="button"
                className={ADMIN_BTN_DANGER}
                disabled={busy}
                onClick={onReject}
              >
                Reject
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </article>
  );
}

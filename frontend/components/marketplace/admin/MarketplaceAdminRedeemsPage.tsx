"use client";

import { useMemo, useState } from "react";
import type { AdminRedeemRow } from "@/lib/core";
import {
  useAdminRedeemActions,
  useMarketplaceAdminRedeems,
} from "@/hooks/marketplace-admin/useMarketplaceAdminRedeems";
import {
  ADMIN_BTN_DANGER,
  ADMIN_BTN_PRIMARY,
  ADMIN_BTN_SECONDARY,
  ADMIN_COUNT,
  ADMIN_LIST,
  ADMIN_SEGMENT_BTN,
  ADMIN_SEGMENT_BTN_ACTIVE,
  ADMIN_TEXT_ERROR,
  ADMIN_TEXT_META,
  ADMIN_TEXT_MUTED,
  ADMIN_ARTICLE,
} from "./adminUi";
import { MarketplaceAdminPageHeader } from "./MarketplaceAdminPageHeader";

type FilterId =
  | "all"
  | "ownership_verified"
  | "in_custody"
  | "burned"
  | "refunded";

const FILTERS: { id: FilterId; label: string }[] = [
  { id: "all", label: "All" },
  { id: "ownership_verified", label: "Awaiting custody" },
  { id: "in_custody", label: "In custody" },
  { id: "burned", label: "Burned" },
  { id: "refunded", label: "Refunded" },
];

function shortHash(h: string | null): string {
  if (!h) return "—";
  if (/^0x0+$/i.test(h.replace(/\s/g, ""))) return "synced (no tx recorded)";
  if (h.length < 14) return h;
  return `${h.slice(0, 8)}…${h.slice(-6)}`;
}

function formatUsdcMicros(micros: string | null): string {
  if (!micros) return "—";
  try {
    const n = Number(BigInt(micros)) / 1e6;
    if (!Number.isFinite(n)) return micros;
    return `$${n.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  } catch {
    return micros;
  }
}

function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function canRefund(row: AdminRedeemRow): boolean {
  if (row.trackingNumber?.trim()) return false;
  if (
    row.status === "burned" ||
    row.status === "vault_release_pending" ||
    row.status === "completed"
  ) {
    return false;
  }
  return row.refundStatus !== "fully_refunded";
}

function batchCanRefundUsdc(rows: AdminRedeemRow[]): boolean {
  return rows.some(
    (r) => canRefund(r) && r.refundStatus === "none" && Boolean(r.paymentBatchId),
  );
}

function summarizeStatuses(rows: AdminRedeemRow[]): string {
  const custody = new Set(rows.map((r) => r.custodyStatus));
  const shipping = new Set(rows.map((r) => r.shippingStatus));
  const refund = new Set(rows.map((r) => r.refundStatus));
  const payment = new Set(rows.map((r) => r.paymentStatus));
  const parts = [
    `payment=${[...payment].join("/")}`,
    `custody=${[...custody].join("/")}`,
    `shipping=${[...shipping].join("/")}`,
    `refund=${[...refund].join("/")}`,
  ];
  return parts.join(" · ");
}

function shipToLine(row: AdminRedeemRow): string {
  const s = row.shipTo;
  const street = [s.line1, s.line2].filter(Boolean).join(", ");
  const city = [s.city, s.region, s.postal].filter(Boolean).join(", ");
  return [s.name, street, city, s.country, s.phone].filter(Boolean).join(" · ");
}

function RedeemCardLine({
  row,
  busy,
  onReturnNft,
}: {
  row: AdminRedeemRow;
  busy: boolean;
  onReturnNft: () => void;
}) {
  const refundable = canRefund(row);
  const canReturnNft =
    refundable &&
    row.custodyStatus === "in_custody" &&
    row.refundStatus !== "nft_returned" &&
    row.refundStatus !== "fully_refunded";

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 py-2 first:border-t-0 first:pt-0">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-zinc-900">
          {row.displayName ?? `Token #${row.tokenId ?? "?"}`}
          {row.certNumber ? (
            <span className={`ml-2 text-xs font-normal ${ADMIN_TEXT_MUTED}`}>
              PSA #{row.certNumber}
            </span>
          ) : null}
          {row.tokenId ? (
            <span className={`ml-2 text-xs font-normal ${ADMIN_TEXT_META}`}>
              #{row.tokenId}
            </span>
          ) : null}
        </p>
        <p className={`text-xs ${ADMIN_TEXT_META}`}>
          {row.status} · custody {shortHash(row.custodyTxHash)}
          {row.custodyReturnTxHash
            ? ` · returned ${shortHash(row.custodyReturnTxHash)}`
            : ""}
        </p>
      </div>
      {canReturnNft ? (
        <button
          type="button"
          className={ADMIN_BTN_SECONDARY}
          disabled={busy}
          onClick={onReturnNft}
        >
          Return NFT
        </button>
      ) : null}
    </li>
  );
}

function groupRowsByShipment(rows: AdminRedeemRow[]): Array<{
  shipmentKey: string;
  vaultLabel: string;
  rows: AdminRedeemRow[];
}> {
  const map = new Map<string, AdminRedeemRow[]>();
  const labels = new Map<string, string>();
  for (const row of rows) {
    const key =
      row.shipmentKey?.trim() ||
      (row.settlementPolicy === "self_vault_hold"
        ? `partner:${row.vaultPartnerId ?? "unknown"}`
        : "psa_vault");
    const list = map.get(key) ?? [];
    list.push(row);
    map.set(key, list);
    if (!labels.has(key)) {
      labels.set(key, row.vaultLabel?.trim() || (key === "psa_vault" ? "PSA Vault" : "Partner vault"));
    }
  }
  return [...map.entries()].map(([shipmentKey, groupRows]) => ({
    shipmentKey,
    vaultLabel: labels.get(shipmentKey) ?? shipmentKey,
    rows: groupRows,
  }));
}

function ShipmentTrackingBlock({
  shipmentKey,
  vaultLabel,
  rows,
  index,
  total,
  busy,
  onSetTracking,
}: {
  shipmentKey: string;
  vaultLabel: string;
  rows: AdminRedeemRow[];
  index: number;
  total: number;
  busy: boolean;
  onSetTracking: (
    shipmentKey: string,
    trackingNumber: string,
    trackingCarrier?: string,
  ) => void;
}) {
  const tracked = rows.find((r) => r.trackingNumber?.trim());
  const allTracked = rows.every((r) => Boolean(r.trackingNumber?.trim()));
  const [tracking, setTracking] = useState(tracked?.trackingNumber ?? "");
  const [carrier, setCarrier] = useState(tracked?.trackingCarrier ?? "");

  return (
    <div className="rounded-md border border-zinc-200 bg-white px-3 py-2 space-y-2">
      <p className="text-xs font-semibold text-zinc-800">
        Shipment {index} · {vaultLabel} ({rows.length} card
        {rows.length === 1 ? "" : "s"})
        {total > 1 ? (
          <span className={`ml-2 font-normal ${ADMIN_TEXT_MUTED}`}>
            separate courier from other vaults
          </span>
        ) : null}
      </p>
      <ul className="space-y-1">
        {rows.map((row) => (
          <li key={row.id} className={`text-xs ${ADMIN_TEXT_META}`}>
            {row.displayName ?? `Token #${row.tokenId ?? "?"}`}
            {row.certNumber ? ` · PSA #${row.certNumber}` : ""}
            {row.trackingNumber?.trim()
              ? ` · tracked ${row.trackingNumber}`
              : " · no tracking"}
          </li>
        ))}
      </ul>
      {!allTracked ? (
        <div className="grid gap-1 sm:grid-cols-2">
          <input
            className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900"
            value={tracking}
            onChange={(e) => setTracking(e.target.value)}
            placeholder="Tracking #"
          />
          <input
            className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900"
            value={carrier}
            onChange={(e) => setCarrier(e.target.value)}
            placeholder="Carrier (FedEx, UPS, USPS…)"
          />
          <button
            type="button"
            className={`${ADMIN_BTN_PRIMARY} sm:col-span-2`}
            disabled={busy || !tracking.trim()}
            onClick={() =>
              onSetTracking(
                shipmentKey,
                tracking.trim(),
                carrier.trim() || undefined,
              )
            }
          >
            Set tracking for this vault (locks refunds)
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className={`text-xs ${ADMIN_TEXT_MUTED}`}>
            Tracking locked ·{" "}
            <span className="tkl-mono">{tracked?.trackingNumber}</span> ·{" "}
            {formatWhen(tracked?.trackingSetAt ?? null)}
          </p>
          <div className="grid gap-1 sm:grid-cols-[1fr_auto]">
            <input
              className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900"
              value={carrier}
              onChange={(e) => setCarrier(e.target.value)}
              placeholder="Carrier (FedEx, UPS, USPS…)"
            />
            <button
              type="button"
              className={ADMIN_BTN_PRIMARY}
              disabled={busy || !carrier.trim()}
              onClick={() =>
                onSetTracking(
                  shipmentKey,
                  (tracked?.trackingNumber ?? tracking).trim(),
                  carrier.trim(),
                )
              }
            >
              Save carrier
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** One payment batch = one order; tracking is per vault shipment. */
function RedeemOrderCard({
  rows,
  busy,
  onSaveMemo,
  onSetShipmentTracking,
  onRefundUsdc,
  onRefundFull,
  onReturnNft,
}: {
  rows: AdminRedeemRow[];
  busy: boolean;
  onSaveMemo: (memo: string) => void;
  onSetShipmentTracking: (
    shipmentKey: string,
    trackingNumber: string,
    trackingCarrier?: string,
  ) => void;
  onRefundUsdc: () => void;
  onRefundFull: () => void;
  onReturnNft: (id: string) => void;
}) {
  const head = rows[0];
  if (!head) return null;

  const [memo, setMemo] = useState(head.adminMemo ?? "");
  const showRefund = batchCanRefundUsdc(rows);
  const multi = rows.length > 1;
  const shipments = useMemo(() => groupRowsByShipment(rows), [rows]);

  return (
    <article className={ADMIN_ARTICLE}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-base font-semibold text-zinc-900">
            {multi ? `Order · ${rows.length} cards` : "Order · 1 card"}
            {shipments.length > 1 ? (
              <span className={`ml-2 text-sm font-normal ${ADMIN_TEXT_MUTED}`}>
                · {shipments.length} vault shipments
              </span>
            ) : null}
            <span className="ml-2 text-sm font-semibold text-zinc-700">
              {formatUsdcMicros(head.paymentReceivedUsdcMicros)}
            </span>
          </p>
          <p className={`text-sm ${ADMIN_TEXT_MUTED}`}>
            {summarizeStatuses(rows)}
          </p>
          <p className={`text-xs ${ADMIN_TEXT_META}`}>
            {head.userEmail ? `${head.userEmail} · ` : ""}
            {head.ownerWalletAddress} · requested {formatWhen(head.requestedAt)}
          </p>
          {shipToLine(head) ? (
            <p className={`text-xs ${ADMIN_TEXT_META}`}>Ship to {shipToLine(head)}</p>
          ) : null}
        </div>
        <div className={`text-right text-xs ${ADMIN_TEXT_META}`}>
          <p>pay {shortHash(head.paymentTxHash)}</p>
          {head.paymentBatchId ? <p className="break-all">batch {head.paymentBatchId}</p> : null}
          {head.refundedUsdcMicros ? (
            <p>refunded {formatUsdcMicros(head.refundedUsdcMicros)}</p>
          ) : null}
        </div>
      </div>

      <ul className="mt-3 rounded-md border border-zinc-200 bg-zinc-50/80 px-3 py-2">
        {rows.map((row) => (
          <RedeemCardLine
            key={row.id}
            row={row}
            busy={busy}
            onReturnNft={() => onReturnNft(row.id)}
          />
        ))}
      </ul>

      <div className="mt-3 space-y-2">
        <p className={`text-xs font-medium ${ADMIN_TEXT_MUTED}`}>
          Tracking by vault (PSA and each Partner ship separately)
        </p>
        {shipments.map((sh, i) => (
          <ShipmentTrackingBlock
            key={sh.shipmentKey}
            shipmentKey={sh.shipmentKey}
            vaultLabel={sh.vaultLabel}
            rows={sh.rows}
            index={i + 1}
            total={shipments.length}
            busy={busy}
            onSetTracking={onSetShipmentTracking}
          />
        ))}
      </div>

      <div className="mt-3">
        <label className="block text-xs text-zinc-600">
          Admin memo{multi ? " (whole order)" : ""}
          <textarea
            className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900"
            rows={2}
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
          />
          <button
            type="button"
            className={`${ADMIN_BTN_SECONDARY} mt-1`}
            disabled={busy}
            onClick={() => onSaveMemo(memo)}
          >
            Save memo
          </button>
        </label>
      </div>

      {showRefund ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className={ADMIN_BTN_DANGER}
            disabled={busy}
            onClick={onRefundUsdc}
          >
            Refund USDC (order once)
          </button>
          <button
            type="button"
            className={ADMIN_BTN_DANGER}
            disabled={busy}
            onClick={onRefundFull}
          >
            Full refund (USDC + all NFTs)
          </button>
        </div>
      ) : null}
    </article>
  );
}

export function MarketplaceAdminRedeemsPage() {
  const [filter, setFilter] = useState<FilterId>("all");
  const apiStatus = filter === "all" ? undefined : filter;
  const query = useMarketplaceAdminRedeems(apiStatus);
  const actions = useAdminRedeemActions();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");

  const items = query.data?.items ?? [];

  const orders = useMemo(() => {
    const map = new Map<string, AdminRedeemRow[]>();
    for (const row of items) {
      const key = row.paymentBatchId ?? `solo:${row.id}`;
      const list = map.get(key) ?? [];
      list.push(row);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [items]);

  async function run(key: string, fn: () => Promise<unknown>) {
    setActionError("");
    setBusyKey(key);
    try {
      await fn();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <>
      <MarketplaceAdminPageHeader
        title="Redeems"
        subtitle="Each payment batch is one order. Tracking is per vault shipment (PSA / each Partner). Memo and USDC refund are order-level. Return NFT is per card. Any tracking locks refunds."
      />

      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            className={
              filter === f.id ? ADMIN_SEGMENT_BTN_ACTIVE : ADMIN_SEGMENT_BTN
            }
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
        <span className={`ml-auto ${ADMIN_COUNT}`}>
          {orders.length} order{orders.length === 1 ? "" : "s"} · {items.length}{" "}
          card{items.length === 1 ? "" : "s"}
        </span>
      </div>

      {actionError ? (
        <p className={`mb-3 ${ADMIN_TEXT_ERROR}`} role="alert">
          {actionError}
        </p>
      ) : null}

      {query.isLoading ? (
        <p className="text-base text-zinc-700">Loading redeems…</p>
      ) : query.isError ? (
        <p className={ADMIN_TEXT_ERROR} role="alert">
          {query.error instanceof Error
            ? query.error.message
            : "Failed to load redeems"}
        </p>
      ) : items.length === 0 ? (
        <p className={`text-base ${ADMIN_TEXT_MUTED}`}>No redeems found.</p>
      ) : (
        <ul className={ADMIN_LIST}>
          {orders.map(([orderKey, rows]) => {
            const batchId = rows[0]?.paymentBatchId ?? null;
            const soloId = rows[0]?.id ?? orderKey;
            const orderBusyKey = batchId ?? soloId;
            const busy = busyKey === orderBusyKey || rows.some((r) => r.id === busyKey);
            return (
              <li key={orderKey}>
                <RedeemOrderCard
                  rows={rows}
                  busy={busy}
                  onSaveMemo={(memo) => {
                    if (batchId) {
                      void run(batchId, () =>
                        actions.updateMemoBatch.mutateAsync({ batchId, memo }),
                      );
                      return;
                    }
                    void run(soloId, () =>
                      actions.updateMemo.mutateAsync({ id: soloId, memo }),
                    );
                  }}
                  onSetShipmentTracking={(shipmentKey, trackingNumber, trackingCarrier) => {
                    if (batchId) {
                      void run(batchId, () =>
                        actions.updateTrackingBatch.mutateAsync({
                          batchId,
                          shipmentKey,
                          trackingNumber,
                          trackingCarrier,
                        }),
                      );
                      return;
                    }
                    void run(soloId, () =>
                      actions.updateTracking.mutateAsync({
                        id: soloId,
                        trackingNumber,
                        trackingCarrier,
                      }),
                    );
                  }}
                  onRefundUsdc={() => {
                    if (!batchId) return;
                    void run(batchId, () =>
                      actions.refundUsdc.mutateAsync(batchId),
                    );
                  }}
                  onRefundFull={() => {
                    if (!batchId) return;
                    void run(batchId, () =>
                      actions.refundFull.mutateAsync(batchId),
                    );
                  }}
                  onReturnNft={(id) =>
                    void run(id, () => actions.returnNft.mutateAsync(id))
                  }
                />
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

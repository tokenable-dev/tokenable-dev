"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { adminListP2pOrders, adminRefundP2pOrder } from "@/lib/core/api/p2p";
import { TkButton } from "@/components/ds";

export default function AdminP2pPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["admin", "p2p", "orders", status],
    queryFn: () => adminListP2pOrders(status || undefined),
  });

  async function onRefund(id: string) {
    if (!confirm("Arbiter refund buyer USDC and burn custody NFT?")) return;
    setBusyId(id);
    setError(null);
    try {
      await adminRefundP2pOrder(id);
      await qc.invalidateQueries({ queryKey: ["admin", "p2p", "orders"] });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold">P2P escrow orders</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Arbiter refund for no-ship / accepted disputes. Auto jobs also run on the backend.
      </p>
      <div className="mt-4 flex gap-2">
        <select
          className="border border-[var(--border)] px-3 py-2 text-sm"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">All</option>
          <option value="SOLD">SOLD</option>
          <option value="CLOSED">CLOSED</option>
          <option value="REFUNDED">REFUNDED</option>
          <option value="BURNED">BURNED</option>
        </select>
      </div>
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-[var(--muted)]">
              <th className="py-2 pr-3">Order</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2 pr-3">Token</th>
              <th className="py-2 pr-3">Ship by</th>
              <th className="py-2 pr-3">Tracking</th>
              <th className="py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(q.data ?? []).map((o) => (
              <tr key={o.id} className="border-b border-[var(--border)]">
                <td className="py-2 pr-3 font-mono text-xs">{o.id.slice(0, 8)}…</td>
                <td className="py-2 pr-3">{o.status}</td>
                <td className="py-2 pr-3">#{o.tokenId}</td>
                <td className="py-2 pr-3">{new Date(o.shipByAt).toLocaleDateString()}</td>
                <td className="py-2 pr-3">
                  {o.trackingNumber ? `${o.carrier} ${o.trackingNumber}` : "—"}
                </td>
                <td className="py-2">
                  {o.status === "SOLD" ? (
                    <TkButton
                      type="button"
                      variant="danger"
                      disabled={busyId === o.id}
                      onClick={() => onRefund(o.id)}
                    >
                      Refund
                    </TkButton>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!q.isPending && !(q.data ?? []).length ? (
          <p className="mt-4 text-sm text-[var(--muted)]">No orders</p>
        ) : null}
      </div>
    </div>
  );
}

"use client";

import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { usePublicClient, useWriteContract } from "wagmi";
import {
  getP2pOrder,
  recordP2pSettlement,
  setP2pTracking,
} from "@/lib/core/api/p2p";
import { PAYMENT_ESCROW_ABI } from "@/lib/p2p/escrowAbi";
import { useAuthStore } from "@/store/authStore";
import { TkButton, TkField, TkInput, TkSelect } from "@/components/ds";
import { useAppChain } from "@/providers/AppChainProvider";

export default function P2pOrderPage() {
  const { id } = useParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);
  const { chainId: appChainId } = useAppChain();
  const { writeContractAsync } = useWriteContract();
  const qc = useQueryClient();

  const orderQ = useQuery({
    queryKey: ["p2p", "order", id],
    queryFn: () => getP2pOrder(id),
    enabled: Boolean(id),
  });
  const orderChainId = orderQ.data?.chainId ?? appChainId;
  const publicClient = usePublicClient({ chainId: orderChainId });

  const [carrier, setCarrier] = useState<"FedEx" | "DHL" | "UPS">("FedEx");
  const [tracking, setTracking] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const order = orderQ.data;
  const isBuyer = Boolean(user?.id && order?.buyerUserId === user.id);
  const isSeller = Boolean(user?.id && order?.sellerUserId === user.id);

  async function onConfirm() {
    if (!order || !publicClient) return;
    const escrowAddress = (order as { escrowAddress?: string | null }).escrowAddress;
    if (!escrowAddress) {
      setError("Escrow address missing on order — redeposit or contact support");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const hash = await writeContractAsync({
        chainId: orderChainId,
        address: escrowAddress as `0x${string}`,
        abi: PAYMENT_ESCROW_ABI,
        functionName: "confirmReceipt",
        args: [order.escrowOrderId as `0x${string}`],
      });
      await publicClient.waitForTransactionReceipt({ hash });
      await recordP2pSettlement(order.id, {
        releaseTxHash: hash,
        source: "confirm",
      });
      await qc.invalidateQueries({ queryKey: ["p2p", "order", id] });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function onTracking() {
    if (!order) return;
    setBusy(true);
    setError(null);
    try {
      await setP2pTracking(order.id, {
        carrier,
        trackingNumber: tracking.trim(),
      });
      await qc.invalidateQueries({ queryKey: ["p2p", "order", id] });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  if (orderQ.isPending) {
    return (
      <div className="tkl-wrap mx-auto max-w-xl px-4 py-8 text-[var(--t2)] sm:py-10">
        Loading…
      </div>
    );
  }
  if (!order) {
    return (
      <div className="tkl-wrap mx-auto max-w-xl px-4 py-8 sm:py-10">Order not found</div>
    );
  }

  return (
    <div className="tkl-wrap mx-auto max-w-xl px-4 py-8 sm:py-10">
      <h1 className="text-2xl font-semibold text-[#fff]">P2P order</h1>
      <p className="mt-2 text-sm text-[var(--t2)]">
        Status: {order.status} · Token #{order.tokenId}
      </p>
      <ul className="mt-4 space-y-1 break-words text-sm text-[var(--t2)]">
        <li>Ship by: {new Date(order.shipByAt).toLocaleString()}</li>
        <li>Auto-release: {new Date(order.autoReleaseAt).toLocaleString()}</li>
        {order.trackingNumber ? (
          <li>
            Tracking: {order.carrier} {order.trackingNumber}
          </li>
        ) : null}
        {order.shipToLine1 ? (
          <li>
            Ship to: {order.shipToLine1}, {order.shipToCity} {order.shipToPostal}{" "}
            {order.shipToCountry}
          </li>
        ) : null}
      </ul>

      {isSeller && order.status === "SOLD" && !order.trackingNumber ? (
        <div className="mt-8 space-y-3 rounded-xl border border-white/10 bg-[#191919] p-4">
          <h2 className="text-sm font-semibold text-[#fff]">Add tracking</h2>
          <TkField label="Carrier" htmlFor="p2p-order-carrier">
            <TkSelect
              id="p2p-order-carrier"
              value={carrier}
              onChange={(e) => setCarrier(e.target.value as typeof carrier)}
            >
              <option value="FedEx">FedEx</option>
              <option value="DHL">DHL</option>
              <option value="UPS">UPS</option>
            </TkSelect>
          </TkField>
          <TkField label="Tracking number" htmlFor="p2p-order-tracking">
            <TkInput
              id="p2p-order-tracking"
              placeholder="Tracking number"
              value={tracking}
              onChange={(e) => setTracking(e.target.value)}
            />
          </TkField>
          <TkButton
            type="button"
            variant="primary"
            className="w-full min-h-11"
            disabled={busy}
            onClick={onTracking}
          >
            Save tracking
          </TkButton>
        </div>
      ) : null}

      {isBuyer && order.status === "SOLD" ? (
        <div className="mt-8">
          <TkButton
            type="button"
            variant="primary"
            className="w-full min-h-11"
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? "Confirming…" : "Confirm receipt"}
          </TkButton>
        </div>
      ) : null}

      {error ? <p className="mt-4 text-sm text-[var(--neg)]">{error}</p> : null}
    </div>
  );
}

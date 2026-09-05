"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { maxUint256 } from "viem";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import {
  getP2pListing,
  prepareP2pBuy,
  recordP2pDeposit,
  cancelP2pListing,
} from "@/lib/core/api/p2p";
import { ERC20_APPROVE_ABI, PAYMENT_ESCROW_ABI } from "@/lib/p2p/escrowAbi";
import { useAuthStore } from "@/store/authStore";
import { TkButton, TkField, TkInput } from "@/components/ds";
import { useAppChain } from "@/providers/AppChainProvider";
import { waitForUserTxReceipt } from "@/lib/network";

function formatUsdc(atomic: string): string {
  const n = Number(atomic) / 1e6;
  return Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: 2 }) : atomic;
}

export default function P2pListingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { address } = useAccount();
  const { chainId: appChainId } = useAppChain();
  const listingQ = useQuery({
    queryKey: ["p2p", "listing", id],
    queryFn: () => getP2pListing(id),
    enabled: Boolean(id),
  });
  const listingChainId = listingQ.data?.chainId ?? appChainId;
  const publicClient = usePublicClient({ chainId: listingChainId });
  const { writeContractAsync } = useWriteContract();

  const [shipToLine1, setShipToLine1] = useState("");
  const [shipToCity, setShipToCity] = useState("");
  const [shipToPostal, setShipToPostal] = useState("");
  const [shipToCountry, setShipToCountry] = useState("US");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const listing = listingQ.data;

  async function onBuy() {
    setError(null);
    if (!address || !publicClient || !listing) {
      setError("Connect wallet first");
      return;
    }
    if (!shipToLine1.trim() || !shipToCity.trim() || !shipToPostal.trim()) {
      setError("Shipping address required");
      return;
    }
    setBusy(true);
    try {
      const prep = await prepareP2pBuy(listing.id);
      const amount = BigInt(prep.priceUsdc);

      if (prep.alreadyFunded) {
        if (prep.fundedBy?.toLowerCase() !== address.toLowerCase()) {
          throw new Error(
            "Another wallet already deposited USDC for this listing. Wait for that purchase to complete or for a refund.",
          );
        }
        const order = await recordP2pDeposit(listing.id, {
          buyerWallet: address,
          shipToLine1: shipToLine1.trim(),
          shipToCity: shipToCity.trim(),
          shipToPostal: shipToPostal.trim(),
          shipToCountry: shipToCountry.trim(),
        });
        router.push(`/p2p/orders/${order.id}`);
        return;
      }

      const allowance = (await publicClient.readContract({
        address: prep.usdcAddress as `0x${string}`,
        abi: ERC20_APPROVE_ABI,
        functionName: "allowance",
        args: [address, prep.escrowAddress as `0x${string}`],
      })) as bigint;
      if (allowance < amount) {
        const approveHash = await writeContractAsync({
          chainId: listingChainId,
          address: prep.usdcAddress as `0x${string}`,
          abi: ERC20_APPROVE_ABI,
          functionName: "approve",
          args: [prep.escrowAddress as `0x${string}`, maxUint256],
        });
        await waitForUserTxReceipt(publicClient, approveHash);
      }
      const depositHash = await writeContractAsync({
        chainId: listingChainId,
        address: prep.escrowAddress as `0x${string}`,
        abi: PAYMENT_ESCROW_ABI,
        functionName: "createAndDeposit",
        args: [
          prep.escrowOrderId as `0x${string}`,
          prep.sellerWallet as `0x${string}`,
          amount,
          BigInt(prep.autoReleaseAt),
        ],
      });
      await waitForUserTxReceipt(publicClient, depositHash);

      const order = await recordP2pDeposit(listing.id, {
        buyerWallet: address,
        depositTxHash: depositHash,
        shipToLine1: shipToLine1.trim(),
        shipToCity: shipToCity.trim(),
        shipToPostal: shipToPostal.trim(),
        shipToCountry: shipToCountry.trim(),
      });
      router.push(`/p2p/orders/${order.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function onCancel() {
    if (!listing) return;
    setBusy(true);
    setError(null);
    try {
      await cancelP2pListing(listing.id);
      router.push("/markets");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  if (listingQ.isPending) {
    return (
      <div className="tkl-wrap mx-auto max-w-xl px-4 py-8 text-[var(--t2)] sm:py-10">
        Loading…
      </div>
    );
  }
  if (!listing) {
    return (
      <div className="tkl-wrap mx-auto max-w-xl px-4 py-8 sm:py-10">Listing not found</div>
    );
  }

  const isSeller = user?.id && listing.sellerUserId === user.id;
  const canBuy = listing.status === "P2P_LISTED" && !isSeller;

  return (
    <div className="tkl-wrap mx-auto max-w-xl px-4 py-8 sm:py-10">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--azure)]">
        P2P · Physical delivery
      </div>
      <h1 className="text-2xl font-semibold text-[#fff]">
        {listing.displayName || `PSA #${listing.certNumber}`}
      </h1>
      <p className="mt-2 text-sm text-[var(--t2)]">
        Cert {listing.certNumber} · Token #{listing.tokenId} · {listing.status}
      </p>
      <p className="mt-4 text-xl font-semibold text-[#fff]">
        ${formatUsdc(listing.priceUsdc)} USDC
      </p>
      <p className="mt-2 text-sm text-[var(--t2)]">
        Payment is locked in the escrow contract until you confirm receipt of the physical card.
      </p>

      {canBuy ? (
        <div className="mt-8 space-y-3 rounded-xl border border-white/10 bg-[#191919] p-4">
          <h2 className="text-sm font-semibold text-[#fff]">Ship-to address</h2>
          <TkField label="Address line 1" htmlFor="p2p-ship-line1">
            <TkInput
              id="p2p-ship-line1"
              placeholder="Address line 1"
              value={shipToLine1}
              onChange={(e) => setShipToLine1(e.target.value)}
            />
          </TkField>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <TkField className="min-w-0 flex-1" label="City" htmlFor="p2p-ship-city">
              <TkInput
                id="p2p-ship-city"
                placeholder="City"
                value={shipToCity}
                onChange={(e) => setShipToCity(e.target.value)}
              />
            </TkField>
            <TkField className="min-w-0 flex-1 sm:max-w-[8rem]" label="Postal" htmlFor="p2p-ship-postal">
              <TkInput
                id="p2p-ship-postal"
                className="w-full"
                placeholder="Postal"
                value={shipToPostal}
                onChange={(e) => setShipToPostal(e.target.value)}
              />
            </TkField>
            <TkField className="min-w-0 flex-1 sm:max-w-[6rem]" label="Country" htmlFor="p2p-ship-country">
              <TkInput
                id="p2p-ship-country"
                className="w-full"
                placeholder="Country"
                value={shipToCountry}
                onChange={(e) => setShipToCountry(e.target.value)}
              />
            </TkField>
          </div>
          <TkButton
            type="button"
            variant="primary"
            className="w-full min-h-11"
            disabled={busy}
            onClick={onBuy}
          >
            {busy ? "Processing…" : "Buy · deposit USDC"}
          </TkButton>
        </div>
      ) : null}

      {isSeller && listing.status === "P2P_LISTED" ? (
        <div className="mt-6">
          <TkButton
            type="button"
            variant="danger"
            className="w-full min-h-11 sm:w-auto"
            disabled={busy}
            onClick={onCancel}
          >
            Cancel listing
          </TkButton>
        </div>
      ) : null}

      {error ? <p className="mt-4 text-sm text-[var(--neg)]">{error}</p> : null}
    </div>
  );
}

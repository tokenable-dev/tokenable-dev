"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createP2pListing } from "@/lib/core/api/p2p";
import { useAccountWalletSession } from "@/hooks/auth/useAccountWalletSession";
import { useAppChain } from "@/providers/AppChainProvider";
import { useAuthStore } from "@/store/authStore";
import { TkButton } from "@/components/ds";

/**
 * Minimal P2P list flow: assumes tokenURI already uploaded via /rwa/upload (or paste).
 * Full PSA certify UI can reuse vault mint form later.
 */
export default function SellP2pPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { primaryAddress } = useAccountWalletSession();
  const { chainId } = useAppChain();
  const [certNumber, setCertNumber] = useState("");
  const [tokenURI, setTokenURI] = useState("");
  const [priceUsd, setPriceUsd] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!user) {
      setError("Sign in required");
      return;
    }
    if (!primaryAddress) {
      setError("Link a wallet first");
      return;
    }
    if (!accepted) {
      setError("Accept authenticity responsibility");
      return;
    }
    const dollars = Number(priceUsd);
    if (!Number.isFinite(dollars) || dollars <= 0) {
      setError("Enter a valid USD price");
      return;
    }
    const priceUsdc = String(Math.round(dollars * 1e6));
    setBusy(true);
    try {
      const { listing } = await createP2pListing(
        {
          certNumber: certNumber.trim(),
          tokenURI: tokenURI.trim(),
          priceUsdc,
          sellerWallet: primaryAddress,
          authenticityAccepted: true,
        },
        chainId,
      );
      router.push(`/p2p/listings/${listing.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="tkl-wrap mx-auto max-w-lg py-10">
      <h1 className="text-2xl font-semibold text-[var(--ink)]">List for P2P sale</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        We mint the RWA into platform custody (escrow). You keep the physical card and ship to the
        buyer after sale. USDC is held on-chain until they confirm receipt.
      </p>
      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <label className="block text-sm">
          <span className="text-[var(--muted)]">PSA cert number</span>
          <input
            className="mt-1 w-full border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
            value={certNumber}
            onChange={(e) => setCertNumber(e.target.value)}
            required
          />
        </label>
        <label className="block text-sm">
          <span className="text-[var(--muted)]">tokenURI (from IPFS upload)</span>
          <input
            className="mt-1 w-full border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
            value={tokenURI}
            onChange={(e) => setTokenURI(e.target.value)}
            placeholder="ipfs://…"
            required
          />
        </label>
        <label className="block text-sm">
          <span className="text-[var(--muted)]">Listing price (USD)</span>
          <input
            type="number"
            min="0"
            step="0.01"
            className="mt-1 w-full border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
            value={priceUsd}
            onChange={(e) => setPriceUsd(e.target.value)}
            required
          />
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            className="mt-1"
          />
          <span>
            I accept full responsibility for the authenticity of the card I am listing.
          </span>
        </label>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <TkButton type="submit" variant="primary" disabled={busy}>
          {busy ? "Minting & listing…" : "Mint & list"}
        </TkButton>
      </form>
    </div>
  );
}

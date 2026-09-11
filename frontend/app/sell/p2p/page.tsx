"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createP2pListing } from "@/lib/core/api/p2p";
import { useAccountWalletSession } from "@/hooks/auth/useAccountWalletSession";
import { useAppChain } from "@/providers/AppChainProvider";
import { useAuthStore } from "@/store/authStore";
import { TkButton, TkCheckbox, TkField, TkInput } from "@/components/ds";

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
    <div className="tkl-wrap mx-auto max-w-lg px-4 py-8 sm:py-10">
      <h1 className="text-2xl font-semibold text-[#fff]">List for P2P sale</h1>
      <p className="mt-2 text-sm text-[var(--t2)]">
        We mint the RWA into platform custody (escrow). You keep the physical card and ship to the
        buyer after sale. USDC is held on-chain until they confirm receipt.
      </p>
      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <TkField label="PSA cert number" htmlFor="p2p-cert">
          <TkInput
            id="p2p-cert"
            value={certNumber}
            onChange={(e) => setCertNumber(e.target.value)}
            required
          />
        </TkField>
        <TkField label="tokenURI (from IPFS upload)" htmlFor="p2p-token-uri">
          <TkInput
            id="p2p-token-uri"
            value={tokenURI}
            onChange={(e) => setTokenURI(e.target.value)}
            placeholder="ipfs://…"
            required
          />
        </TkField>
        <TkField label="Listing price (USD)" htmlFor="p2p-price">
          <TkInput
            id="p2p-price"
            type="number"
            min="0"
            step="0.01"
            value={priceUsd}
            onChange={(e) => setPriceUsd(e.target.value)}
            required
          />
        </TkField>
        <TkCheckbox
          label="I accept full responsibility for the authenticity of the card I am listing."
          checked={accepted}
          onChange={(e) => setAccepted(e.target.checked)}
        />
        {error ? <p className="text-sm text-[var(--neg)]">{error}</p> : null}
        <TkButton type="submit" variant="primary" className="w-full min-h-11" disabled={busy}>
          {busy ? "Minting and listing…" : "Mint and list"}
        </TkButton>
      </form>
    </div>
  );
}

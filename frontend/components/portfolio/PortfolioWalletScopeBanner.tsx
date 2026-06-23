"use client";

import { useAuthUiStore } from "@/store/authUiStore";

function shortenAddress(address: string): string {
  if (address.length < 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function PortfolioWalletScopeBanner({
  portfolioAddress,
  connectedAddress,
  walletMismatch,
}: {
  portfolioAddress: string | undefined;
  connectedAddress: string | undefined;
  walletMismatch: boolean;
}) {
  const openWalletMismatch = useAuthUiStore((s) => s.openWalletMismatch);

  if (!portfolioAddress) return null;

  if (walletMismatch && connectedAddress) {
    return (
      <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
        <p className="font-medium text-amber-100">Different wallet in MetaMask</p>
        <p className="mt-1 text-xs leading-relaxed text-amber-200/85">
          MetaMask is on{" "}
          <span className="font-mono text-amber-100">{shortenAddress(connectedAddress)}</span>,
          which is not linked to your account. Showing holdings for your linked wallet{" "}
          <span className="font-mono text-amber-100">{shortenAddress(portfolioAddress)}</span>.
        </p>
        <button
          type="button"
          onClick={() => openWalletMismatch({ returnTo: "/portfolio" })}
          className="mt-2 text-xs font-semibold text-mint hover:text-mint/80"
        >
          Link this wallet
        </button>
      </div>
    );
  }

  return (
    <p className="mb-4 text-xs text-gray-500">
      Portfolio for{" "}
      <span className="font-mono text-gray-400">{shortenAddress(portfolioAddress)}</span>
    </p>
  );
}

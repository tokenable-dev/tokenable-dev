"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { CollectionGridCard } from "@/components/markets/CollectionGridCard";
import { useWatchlistMarketSnapshots } from "@/hooks/watchlist/useWatchlistMarketSnapshots";
import { useAuthUiStore } from "@/store/authUiStore";
import { useAuthStore } from "@/store/authStore";
import { userHasLinkedWallet } from "@/lib/auth/wallets";

function WatchlistStarIcon({ filled = false }: { filled?: boolean }) {
  return (
    <svg
      className={`h-7 w-7 ${filled ? "fill-mint/20 text-mint" : "text-gray-600"}`}
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
      fill={filled ? "currentColor" : "none"}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
      />
    </svg>
  );
}

function WatchlistEmpty({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <WatchlistStarIcon />
      {children}
    </div>
  );
}

export function PortfolioWatchlistSection() {
  const user = useAuthStore((s) => s.user);
  const openSignIn = useAuthUiStore((s) => s.openSignIn);
  const openConnectWallet = useAuthUiStore((s) => s.openConnectWallet);
  const { items, isLoading, snapshotByKey } = useWatchlistMarketSnapshots();

  if (!user) {
    return (
      <WatchlistEmpty>
        <button
          type="button"
          onClick={() => openSignIn({ returnTo: "/portfolio?tab=watchlist" })}
          className="mt-4 rounded-lg bg-mint-dim px-5 py-2 text-sm font-semibold text-mint-ink hover:brightness-110"
        >
          Sign in
        </button>
      </WatchlistEmpty>
    );
  }

  if (!userHasLinkedWallet(user)) {
    return (
      <WatchlistEmpty>
        <button
          type="button"
          onClick={() => openConnectWallet({ returnTo: "/portfolio?tab=watchlist" })}
          className="mt-4 rounded-lg bg-mint-dim px-5 py-2 text-sm font-semibold text-mint-ink hover:brightness-110"
        >
          Connect wallet
        </button>
      </WatchlistEmpty>
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-mint/30 border-t-mint" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <WatchlistEmpty>
        <p className="mt-2 text-sm text-gray-500">Tap ★ on Markets</p>
        <Link
          href="/markets"
          className="mt-3 text-sm font-medium text-mint hover:text-mint/80"
        >
          Markets →
        </Link>
      </WatchlistEmpty>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
      {items.map((collection) => (
        <CollectionGridCard
          key={collection.collectionKey}
          collection={collection}
          snapshot={snapshotByKey.get(collection.collectionKey.toLowerCase())}
          listingCount={collection.activeListingCount ?? 0}
        />
      ))}
    </div>
  );
}

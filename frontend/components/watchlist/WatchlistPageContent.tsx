"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { MarketsFilterBar } from "@/components/markets/MarketsFilterBar";
import { TkButton } from "@/components/ds";
import { APP_MAIN_SHELL_CLASS } from "@/constants/layout";
import { useWatchlistMarketSnapshots } from "@/hooks/watchlist/useWatchlistMarketSnapshots";
import { useResolvedMediaUrlMap } from "@/hooks/media";
import { useAuthUiStore } from "@/store/authUiStore";
import { useAuthStore } from "@/store/authStore";
import { userHasLinkedWallet } from "@/lib/auth/wallets";
import {
  collectionMatchesCategoryFilters,
  type CollectionCategoryId,
} from "@/lib/market";
import {
  compareMarketsCollections,
  MARKETS_DEFAULT_SORT_ID,
  type MarketsSortId,
} from "@/lib/markets/marketsCollectionSort";
import {
  applyMarketsListingFilters,
  type MarketsGradeFilterId,
} from "@/lib/markets/marketsFilters";
import { pickCollectionSummaryDisplayImageUrl } from "@/lib/marketplace/collectionDisplayImage";
import { WatchlistCollectionGrid } from "./WatchlistCollectionGrid";
import { AppPageState } from "@/components/ui/AppPageState";

function WatchlistStarIcon({ filled = false }: { filled?: boolean }) {
  return (
    <svg
      className={`watchlist-empty__icon h-7 w-7 ${filled ? "fill-[var(--azure)]/20 text-[var(--azure)]" : ""}`}
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
    <div className="watchlist-empty">
      <WatchlistStarIcon />
      {children}
    </div>
  );
}

export function WatchlistPageContent({
  embedded = false,
  returnTo,
}: {
  /** Portfolio tab — omits page header and filter bar. */
  embedded?: boolean;
  returnTo?: string;
}) {
  const user = useAuthStore((s) => s.user);
  const openSignIn = useAuthUiStore((s) => s.openSignIn);
  const openConnectWallet = useAuthUiStore((s) => s.openConnectWallet);
  const authReturnTo = returnTo ?? (embedded ? "/watchlist" : "/watchlist");

  const [categoryFilters, setCategoryFilters] = useState<Set<CollectionCategoryId>>(
    new Set(),
  );
  const [sortId, setSortId] = useState<MarketsSortId>(MARKETS_DEFAULT_SORT_ID);
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [gradeFilters, setGradeFilters] = useState<Set<MarketsGradeFilterId>>(new Set());

  const { items, isLoading, isError, snapshotByKey } = useWatchlistMarketSnapshots();

  const coverRawUrls = useMemo(
    () => items.map((c) => pickCollectionSummaryDisplayImageUrl(c)),
    [items],
  );
  const { map: resolvedCoverMap } = useResolvedMediaUrlMap(coverRawUrls, {
    enabled: items.length > 0,
  });

  const sortedItems = useMemo(
    () =>
      [...items].sort((a, b) => compareMarketsCollections(a, b, sortId, snapshotByKey)),
    [items, sortId, snapshotByKey],
  );

  const filteredItems = useMemo(() => {
    const categoryFiltered = sortedItems.filter((c) =>
      collectionMatchesCategoryFilters(
        categoryFilters,
        c,
        snapshotByKey.get(c.collectionKey.trim().toLowerCase()),
      ),
    );
    return applyMarketsListingFilters(categoryFiltered, snapshotByKey, {
      priceMin,
      priceMax,
      gradeFilters,
    });
  }, [sortedItems, snapshotByKey, categoryFilters, priceMin, priceMax, gradeFilters]);

  if (!user) {
    return (
      <div className={`watchlist-page__shell ${APP_MAIN_SHELL_CLASS}`}>
        <WatchlistEmpty>
          <TkButton
            variant="primary"
            className="mt-4"
            onClick={() => openSignIn({ returnTo: authReturnTo })}
          >
            Sign in
          </TkButton>
        </WatchlistEmpty>
      </div>
    );
  }

  if (!userHasLinkedWallet(user)) {
    return (
      <div className={`watchlist-page__shell ${APP_MAIN_SHELL_CLASS}`}>
        <WatchlistEmpty>
          <TkButton
            variant="primary"
            className="mt-4"
            onClick={() => openConnectWallet({ returnTo: authReturnTo })}
          >
            Connect wallet
          </TkButton>
        </WatchlistEmpty>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={`watchlist-page__shell ${APP_MAIN_SHELL_CLASS} flex justify-center py-16`}>
        <span className="h-7 w-7 animate-spin rounded-full border-2 border-[var(--azure)]/30 border-t-[var(--azure)]" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className={`watchlist-page__shell ${APP_MAIN_SHELL_CLASS}`}>
        <AppPageState
          kind="watchlist_load_failed"
          primaryAction={{
            label: "Try again",
            onClick: () => window.location.reload(),
            variant: "primary",
          }}
        />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className={`watchlist-page__shell ${APP_MAIN_SHELL_CLASS}`}>
        <WatchlistEmpty>
          <p>Tap ★ on Markets to save collections here.</p>
          <Link href="/markets">Browse Markets →</Link>
        </WatchlistEmpty>
      </div>
    );
  }

  return (
    <>
      {!embedded ? (
        <MarketsFilterBar
          categoryFilters={categoryFilters}
          onCategoryToggle={(id) => {
            setCategoryFilters((prev) => {
              const next = new Set(prev);
              if (next.has(id)) next.delete(id);
              else next.add(id);
              return next;
            });
          }}
          onCategoryFiltersChange={setCategoryFilters}
          sortId={sortId}
          onSortChange={setSortId}
          priceMin={priceMin}
          priceMax={priceMax}
          onPriceRangeChange={(min, max) => {
            setPriceMin(min);
            setPriceMax(max);
          }}
          gradeFilters={gradeFilters}
          onGradeToggle={(grade) => {
            setGradeFilters((prev) => {
              const next = new Set(prev);
              if (next.has(grade)) next.delete(grade);
              else next.add(grade);
              return next;
            });
          }}
          onGradeFiltersChange={setGradeFilters}
        />
      ) : null}

      <div className={`watchlist-page__shell watchlist-results-section ${APP_MAIN_SHELL_CLASS}`}>
        {!embedded ? (
          <div className="watchlist-results-bar">
            <span className="watchlist-results-bar__count">
              <b>{filteredItems.length}</b> results
            </span>
            <span className="watchlist-results-bar__label">Your watchlist</span>
          </div>
        ) : null}

        {filteredItems.length === 0 ? (
          <p className="watchlist-empty">No watchlist items match these filters.</p>
        ) : (
          <WatchlistCollectionGrid
            collections={filteredItems}
            snapshotByKey={snapshotByKey}
            resolvedCoverMap={resolvedCoverMap}
          />
        )}
      </div>
    </>
  );
}

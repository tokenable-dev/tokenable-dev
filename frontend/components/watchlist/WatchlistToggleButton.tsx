"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/ds/cn";
import { useTradeAccessGate } from "@/hooks/auth/useTradeAccessGate";
import { useWatchlistToggle } from "@/hooks/watchlist/useWatchlist";

const HEART_PATH =
  "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z";

export function WatchlistToggleButton({
  collectionKey,
  className,
}: {
  collectionKey: string;
  className?: string;
  /** @deprecated Card fav uses fixed 32×32 DS shell — size prop ignored. */
  size?: "sm" | "md";
}) {
  const pathname = usePathname();
  const { runTradeAccessGate } = useTradeAccessGate(pathname || "/markets");
  const { isWatched, canToggle, pending, toggle } = useWatchlistToggle(collectionKey);

  return (
    <button
      type="button"
      aria-label={isWatched ? "Remove from watchlist" : "Add to watchlist"}
      aria-pressed={isWatched}
      disabled={pending}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!canToggle) {
          runTradeAccessGate();
          return;
        }
        toggle();
      }}
      className={cn("fav-btn", isWatched && "on", className)}
    >
      <svg width={16} height={16} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d={HEART_PATH} />
      </svg>
    </button>
  );
}

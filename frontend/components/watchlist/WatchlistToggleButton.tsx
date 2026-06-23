"use client";

import { usePathname } from "next/navigation";
import { useTradeAccessGate } from "@/hooks/auth/useTradeAccessGate";
import { useWatchlistToggle } from "@/hooks/watchlist/useWatchlist";

const SIZE_CLASS = {
  sm: {
    btn: "h-7 w-7 rounded-md border-gray-800/70 bg-black/60",
    icon: "h-3.5 w-3.5",
    stroke: 1.5,
  },
  md: {
    btn: "h-8 w-8 rounded-lg border-gray-700/70 bg-black/50",
    icon: "h-4 w-4",
    stroke: 1.5,
  },
} as const;

export function WatchlistToggleButton({
  collectionKey,
  className,
  size = "sm",
}: {
  collectionKey: string;
  className?: string;
  size?: keyof typeof SIZE_CLASS;
}) {
  const pathname = usePathname();
  const { runTradeAccessGate } = useTradeAccessGate(pathname || "/markets");
  const { isWatched, canToggle, pending, toggle } = useWatchlistToggle(collectionKey);
  const s = SIZE_CLASS[size];

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
      className={
        className ??
        `inline-flex items-center justify-center border text-gray-500 backdrop-blur-sm transition-colors hover:border-mint/35 hover:text-mint disabled:opacity-50 ${s.btn}`
      }
    >
      <svg
        className={`${s.icon} ${isWatched ? "fill-mint text-mint" : "fill-none"}`}
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={s.stroke}
        aria-hidden
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
        />
      </svg>
    </button>
  );
}

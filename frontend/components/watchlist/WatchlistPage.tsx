"use client";

import { WatchlistPageContent } from "./WatchlistPageContent";
import { WatchlistPageHeader } from "./WatchlistPageHeader";

export default function WatchlistPage() {
  return (
    <div className="watchlist-page min-h-screen min-w-0 overflow-x-clip text-white">
      <WatchlistPageHeader />
      <WatchlistPageContent />
    </div>
  );
}

"use client";

import { HomeTicker } from "@/components/home/HomeTicker";
import { WatchlistPageContent } from "./WatchlistPageContent";
import { WatchlistPageHeader } from "./WatchlistPageHeader";

export default function WatchlistPage() {
  return (
    <div className="watchlist-page min-h-screen min-w-0 overflow-x-clip text-white">
      <HomeTicker />
      <WatchlistPageHeader />
      <WatchlistPageContent />
    </div>
  );
}

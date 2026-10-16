import { MarketsPageHeader } from "@/components/markets/MarketsPageHeader";
import { MarketsGridSkeleton } from "@/components/markets/MarketsCollectionGrid";

/** Same grid skeleton as the client first-paint — no copy / progress bar. */
export default function MarketsLoading() {
  return (
    <div className="markets-page">
      <MarketsPageHeader />
      <div className="tkl-wrap markets-results-section">
        <div role="status" aria-live="polite" aria-busy="true">
          <span className="sr-only">Loading markets</span>
          <MarketsGridSkeleton />
        </div>
      </div>
    </div>
  );
}

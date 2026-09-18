"use client";

import { useEffect } from "react";
import { trackEvent } from "@/lib/analytics/googleAnalytics";

/**
 * Fires the `page_viewed` custom GA4 event once on component mount.
 *
 * Separate from the existing automatic `page_view` (handled by `AnalyticsPageViewTracker`).
 * `page_viewed` is the UX/UI-spec custom event with `page_name` and `referrer` properties.
 *
 * @param pageName  Human-readable page identifier (e.g. "markets", "collection_detail").
 *
 * @example
 * usePageViewedEvent("markets");
 * usePageViewedEvent("collection_detail");
 * usePageViewedEvent("portfolio");
 */
export function usePageViewedEvent(pageName: string): void {
  useEffect(() => {
    trackEvent("page_viewed", {
      page_name: pageName,
      referrer: document.referrer || undefined,
    });
    // Intentionally empty deps — fires once on mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

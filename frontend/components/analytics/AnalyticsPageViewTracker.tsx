"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { trackGoogleAnalyticsPageView } from "@/lib/analytics/googleAnalytics";

/**
 * Sends GA4 page_view on client-side route changes.
 * Initial load is handled by {@link GoogleAnalytics} from `@next/third-parties`.
 */
export function AnalyticsPageViewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isInitialLoad = useRef(true);

  useEffect(() => {
    const query = searchParams.toString();
    const pagePath = query ? `${pathname}?${query}` : pathname;

    if (isInitialLoad.current) {
      isInitialLoad.current = false;
      return;
    }

    trackGoogleAnalyticsPageView(pagePath);
  }, [pathname, searchParams]);

  return null;
}

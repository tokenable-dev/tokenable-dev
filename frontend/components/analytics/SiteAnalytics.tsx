import { Suspense } from "react";
import { GoogleAnalytics } from "@next/third-parties/google";
import { AnalyticsPageViewTracker } from "./AnalyticsPageViewTracker";
import {
  GA_MEASUREMENT_ID,
  isGoogleAnalyticsEnabled,
} from "@/lib/analytics/googleAnalytics";

/** GA4 — disabled when `NEXT_PUBLIC_GA_MEASUREMENT_ID` is unset or invalid. */
export function SiteAnalytics() {
  if (!isGoogleAnalyticsEnabled()) return null;

  return (
    <>
      <GoogleAnalytics gaId={GA_MEASUREMENT_ID} />
      <Suspense fallback={null}>
        <AnalyticsPageViewTracker />
      </Suspense>
    </>
  );
}

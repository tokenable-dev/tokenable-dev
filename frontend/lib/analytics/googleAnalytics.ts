import type { EventName, AnalyticsProperties } from "./events";

/** GA4 measurement ID (`G-XXXXXXXXXX`). Empty ⇒ analytics disabled. */
export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() ?? "";

const GA_ID_PATTERN = /^G-[A-Z0-9]+$/i;

export function isGoogleAnalyticsEnabled(): boolean {
  return GA_ID_PATTERN.test(GA_MEASUREMENT_ID);
}

/** Client-side page_view for App Router navigations (after initial load). */
export function trackGoogleAnalyticsPageView(pagePath: string): void {
  if (typeof window === "undefined" || !isGoogleAnalyticsEnabled()) return;
  if (typeof window.gtag !== "function") return;

  window.gtag("event", "page_view", {
    page_path: pagePath,
    page_location: window.location.href,
    page_title: document.title,
  });
}

// ---------------------------------------------------------------------------
// Custom event tracking
// ---------------------------------------------------------------------------

/**
 * Send a custom GA4 event.
 *
 * Guards:
 *  - SSR / non-browser → no-op
 *  - GA disabled (NEXT_PUBLIC_GA_MEASUREMENT_ID unset/invalid) → no-op
 *  - gtag script not loaded yet → no-op
 *
 * Development: logs a console.info line so you can verify events without
 * opening the GA4 DebugView.
 *
 * @example
 * trackEvent("buy_now_clicked", { card_id: "abc-123", price: 100 });
 * trackEvent("bid_placed",      { card_id: "abc-123", bid_price: 90, collection_id: "pokemon" });
 * trackEvent("kyc_gate_hit");
 * trackEvent("filter_applied",  { filter_key: "category", filter_value: "Pokemon" });
 */
export function trackEvent(
  eventName: EventName,
  properties?: AnalyticsProperties,
): void {
  if (typeof window === "undefined") return;
  if (!isGoogleAnalyticsEnabled()) return;
  if (typeof window.gtag !== "function") return;

  window.gtag("event", eventName, properties ?? {});

  if (process.env.NODE_ENV === "development") {
    // eslint-disable-next-line no-console
    console.info("[Analytics]", eventName, properties ?? {});
  }
}

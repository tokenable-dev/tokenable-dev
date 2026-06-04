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

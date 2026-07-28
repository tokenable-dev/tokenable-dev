import type { TkButtonVariant } from "@/components/ds";

export type AppPageStateKind =
  | "not_found"
  | "collection_not_created"
  | "collection_invalid"
  | "collection_load_failed"
  | "asset_not_found"
  | "asset_invalid"
  | "markets_load_failed"
  | "section_load_failed"
  | "watchlist_load_failed"
  | "top100_invalid_card"
  | "top100_load_failed"
  | "portfolio_crash"
  | "markets_crash"
  | "app_crash"
  | "unauthorized"
  | "vault_coming_soon"
  | "generic";

export type AppPageStateIcon = "search" | "hourglass" | "warning" | "offline" | "lock" | "crash";

export type AppPageStateAction = {
  label: string;
  href?: string;
  onClick?: () => void;
  variant?: TkButtonVariant;
};

export type AppPageStateDefinition = {
  icon: AppPageStateIcon;
  title: string;
  message: string;
  primaryAction?: AppPageStateAction;
  secondaryAction?: AppPageStateAction;
};

export const PAGE_STATE_CATALOG: Record<AppPageStateKind, AppPageStateDefinition> = {
  not_found: {
    icon: "search",
    title: "Page not found",
    message: "The page you requested does not exist or may have moved.",
    primaryAction: { label: "Go to Markets", href: "/markets", variant: "primary" },
    secondaryAction: { label: "Portfolio", href: "/portfolio", variant: "neutral" },
  },
  collection_not_created: {
    icon: "hourglass",
    title: "Market not live yet",
    message:
      "This collection page opens after the first card in this bucket is listed for sale. List your card from Portfolio to create the market.",
    primaryAction: { label: "Go to Portfolio", href: "/portfolio", variant: "primary" },
    secondaryAction: { label: "Browse Markets", href: "/markets", variant: "neutral" },
  },
  collection_invalid: {
    icon: "warning",
    title: "Invalid collection link",
    message: "The collection URL is missing or malformed. Open the collection from Markets or Portfolio.",
    primaryAction: { label: "Browse Markets", href: "/markets", variant: "primary" },
  },
  collection_load_failed: {
    icon: "offline",
    title: "Could not load collection",
    message:
      "We could not reach the marketplace API. Check your connection and try again, or come back in a moment.",
    primaryAction: { label: "Browse Markets", href: "/markets", variant: "primary" },
    secondaryAction: { label: "Try again", variant: "neutral" },
  },
  asset_not_found: {
    icon: "search",
    title: "Asset not found",
    message: "This token ID does not exist on the current contract.",
    primaryAction: { label: "Browse Markets", href: "/markets", variant: "primary" },
  },
  asset_invalid: {
    icon: "warning",
    title: "Invalid token",
    message: "The URL token ID is not valid.",
    primaryAction: { label: "Browse Markets", href: "/markets", variant: "primary" },
  },
  markets_load_failed: {
    icon: "offline",
    title: "Markets unavailable",
    message:
      "Could not load marketplace data. Confirm the backend is running and Postgres is up, then try again.",
    primaryAction: { label: "Try again", variant: "primary" },
    secondaryAction: { label: "Portfolio", href: "/portfolio", variant: "neutral" },
  },
  section_load_failed: {
    icon: "offline",
    title: "Could not load this section",
    message: "Something went wrong while loading this data. Try refreshing the page.",
    primaryAction: { label: "Refresh page", variant: "neutral" },
  },
  watchlist_load_failed: {
    icon: "offline",
    title: "Could not load watchlist",
    message: "We could not load your saved collections. Check your connection and try again.",
    primaryAction: { label: "Browse Markets", href: "/markets", variant: "primary" },
    secondaryAction: { label: "Try again", variant: "neutral" },
  },
  top100_invalid_card: {
    icon: "warning",
    title: "Invalid card",
    message: "The card ID in this URL is not valid.",
    primaryAction: { label: "Back to Markets", href: "/markets", variant: "primary" },
  },
  top100_load_failed: {
    icon: "offline",
    title: "Could not load card data",
    message: "We could not load pricing and chart data for this card. Try again in a moment.",
    primaryAction: { label: "Back to Markets", href: "/markets", variant: "primary" },
    secondaryAction: { label: "Try again", variant: "neutral" },
  },
  portfolio_crash: {
    icon: "crash",
    title: "Portfolio failed to load",
    message: "Something went wrong while rendering your portfolio. You can try again or return to Markets.",
    primaryAction: { label: "Try again", variant: "primary" },
    secondaryAction: { label: "Markets", href: "/markets", variant: "neutral" },
  },
  markets_crash: {
    icon: "crash",
    title: "Markets failed to load",
    message: "Something went wrong while rendering Markets. You can try again or open Portfolio.",
    primaryAction: { label: "Try again", variant: "primary" },
    secondaryAction: { label: "Portfolio", href: "/portfolio", variant: "neutral" },
  },
  app_crash: {
    icon: "crash",
    title: "Something went wrong",
    message: "An unexpected error occurred. Try again or return to Markets.",
    primaryAction: { label: "Try again", variant: "primary" },
    secondaryAction: { label: "Markets", href: "/markets", variant: "neutral" },
  },
  unauthorized: {
    icon: "lock",
    title: "Sign in required",
    message: "You need to sign in to view this page.",
    primaryAction: { label: "Markets", href: "/markets", variant: "neutral" },
  },
  vault_coming_soon: {
    icon: "hourglass",
    title: "Coming soon",
    message: "This Sell feature is not available yet. We're preparing it for launch.",
    primaryAction: { label: "Browse Markets", href: "/markets", variant: "primary" },
    secondaryAction: { label: "Portfolio", href: "/portfolio", variant: "neutral" },
  },
  generic: {
    icon: "warning",
    title: "Something went wrong",
    message: "An error occurred. Please try again.",
    primaryAction: { label: "Try again", variant: "primary" },
  },
};

export function getPageStateDefinition(kind: AppPageStateKind): AppPageStateDefinition {
  return PAGE_STATE_CATALOG[kind];
}

/** SHA-256 bucket keys are 64 lowercase hex chars. */
export function looksLikeCollectionKey(raw: string): boolean {
  const k = raw.trim().toLowerCase();
  return /^[a-f0-9]{64}$/.test(k);
}

export function formatErrorDetails(error: unknown): string {
  if (error instanceof Error) {
    const parts = [error.message];
    if (error.stack) parts.push("", error.stack);
    if ("digest" in error && typeof (error as { digest?: string }).digest === "string") {
      parts.push("", `digest: ${(error as { digest: string }).digest}`);
    }
    return parts.join("\n");
  }
  return String(error ?? "Unknown error");
}

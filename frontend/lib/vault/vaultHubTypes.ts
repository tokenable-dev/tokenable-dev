/**
 * Sell hub row — Vault-Dashboard-Active.html (design system-22) per-card card.
 */

export type VaultHubVState = "transit" | "verify" | "vaulted" | "reject";

export type VaultHubReject = {
  label: string;
  exp: string;
  actionLabel: string;
  actionHref: string;
};

export type VaultHubRow = {
  id: string;
  vstate: VaultHubVState;
  name: string;
  grade: string;
  cert: string;
  imageUrl: string;
  eta?: string;
  trackingUrl?: string;
  /** Pre-ship: existing Add tracking flow. */
  addTrackingHref?: string;
  reject?: VaultHubReject;
};

/** @deprecated Prefer VaultHubRow — kept for older imports. */
export type VaultInProgressItem = VaultHubRow;

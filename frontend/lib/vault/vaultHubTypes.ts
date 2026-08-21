/**
 * Sell hub row — Vault-Dashboard-Active.html `data-vstate` + ip-card.
 */

export type VaultHubVState = "self" | "progress" | "done" | "rejected";

export type VaultIpStatusKind =
  | "token-sent"
  | "in-transit"
  | "reviewing"
  | "minting"
  | "action-needed"
  | "registered"
  | "rejected";

export type VaultHubRow = {
  id: string;
  vstate: VaultHubVState;
  /** First-registered card title (package representative). */
  name: string;
  grade: string;
  gradeRejected?: boolean;
  /** First-registered card image. */
  imageUrl: string;
  /** Total cards in the package (≥ 1). */
  cardCount: number;
  statusKind: VaultIpStatusKind;
  statusLabel: string;
  detail?: string;
  trackingUrl?: string;
  hint?: string;
  actionNeeded?: boolean;
  cta: { label: string; href: string; primary?: boolean };
};

/** @deprecated Prefer VaultHubRow — kept for older imports. */
export type VaultInProgressItem = VaultHubRow;

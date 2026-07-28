/**
 * Hub “In Progress” row shape — live sell shipment maps into this.
 * (Former vaultMockData inventory / FAQ / carrier copy removed.)
 */

export type VaultIpStatusKind =
  | "token-sent"
  | "in-transit"
  | "reviewing"
  | "minting"
  | "action-needed";

export type VaultInProgressItem = {
  id: string;
  /** First-registered card title (package representative). */
  name: string;
  grade: string;
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

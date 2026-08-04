import type { VaultSubmissionApi } from "@/lib/core/api/vault-submissions";

const BLOCKED_ITEM = new Set([
  "in_transit",
  "reviewing",
  "approved",
  "minting",
]);

const BLOCKED_SUBMISSION = new Set(["in_transit", "psa_reviewing"]);

/** Mirror of backend VaultSubmissionService.isBlockedForSelfVault. */
export function isPsaShipmentBlockedForSelfVault(params: {
  submissionStatus: string;
  itemStatus: string;
}): boolean {
  const item = params.itemStatus;
  if (item === "rejected" || item === "failed" || item === "completed") {
    return false;
  }
  if (BLOCKED_ITEM.has(item)) return true;
  return BLOCKED_SUBMISSION.has(params.submissionStatus);
}

export function findSelfVaultBlockedCert(
  submissions: VaultSubmissionApi[],
  cert: string,
): { cert: string; publicId: string; statusLabel: string } | null {
  const normalized = cert.trim().toUpperCase();
  if (!normalized) return null;

  for (const sub of submissions) {
    if (sub.status === "cancelled") continue;
    for (const item of sub.items) {
      const itemCert = item.cert.trim().toUpperCase();
      if (itemCert !== normalized) continue;
      if (
        !isPsaShipmentBlockedForSelfVault({
          submissionStatus: sub.status,
          itemStatus: item.status,
        })
      ) {
        continue;
      }
      return {
        cert: normalized,
        publicId: sub.publicId,
        statusLabel: `${sub.status}/${item.status}`,
      };
    }
  }
  return null;
}

export function selfVaultBlockedMessage(hit: {
  cert: string;
  publicId: string;
}): string {
  return (
    `PSA cert #${hit.cert} is already in PSA vault shipment ${hit.publicId}. ` +
    `Self vault mint is not allowed while the card is in transit or at PSA.`
  );
}

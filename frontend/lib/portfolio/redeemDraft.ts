import type { SupportedChainId } from "@/lib/chains/types";
import type { RedeemShipTo } from "@/lib/core/api/rwa-redeem";
import type { RwaMetadata } from "@/lib/core";

const STORAGE_KEY = "tk_redeem_draft_v1";
const ADDRESS_KEY = "tk_redeem_ship_to_v1";
export const REDEEM_BATCH_MAX = 50;

export type RedeemDraftCard = {
  tokenId: number;
  name: string;
  imageUrl: string | null;
  grade: string | null;
  certNumber: string | null;
  vaultLabel: string;
};

export type RedeemDraft = {
  chainId: SupportedChainId;
  cards: RedeemDraftCard[];
  savedAt: number;
};

export type RedeemAddressForm = RedeemShipTo & { saveAddress: boolean };

export const EMPTY_REDEEM_ADDRESS_FORM: RedeemAddressForm = {
  name: "",
  line1: "",
  line2: "",
  city: "",
  region: "",
  postal: "",
  country: "us",
  phone: "",
  saveAddress: true,
};

export function readRedeemDraft(): RedeemDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RedeemDraft;
    if (
      !parsed ||
      !Array.isArray(parsed.cards) ||
      parsed.cards.length === 0 ||
      typeof parsed.chainId !== "number"
    ) {
      return null;
    }
    return {
      ...parsed,
      cards: parsed.cards.map((c) => ({
        ...c,
        certNumber: c.certNumber ?? null,
        vaultLabel: c.vaultLabel ?? "PSA Vault",
      })),
    };
  } catch {
    return null;
  }
}

export function writeRedeemDraft(draft: RedeemDraft): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
}

export function clearRedeemDraft(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(STORAGE_KEY);
}

export function readSavedRedeemAddress(): RedeemAddressForm | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(ADDRESS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RedeemShipTo;
    if (!parsed?.name || !parsed?.line1 || !parsed?.city || !parsed?.postal) {
      return null;
    }
    return {
      ...EMPTY_REDEEM_ADDRESS_FORM,
      ...parsed,
      country: parsed.country === "ca" || parsed.country === "intl" ? parsed.country : "us",
      saveAddress: true,
    };
  } catch {
    return null;
  }
}

export function writeSavedRedeemAddress(shipTo: RedeemShipTo): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(ADDRESS_KEY, JSON.stringify(shipTo));
}

export function clearSavedRedeemAddress(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(ADDRESS_KEY);
}

export function certNumberFromMetadata(meta: RwaMetadata | null | undefined): string | null {
  if (!meta?.attributes?.length) return null;
  for (const attr of meta.attributes) {
    const trait = String(attr.trait_type ?? "").toLowerCase();
    if (trait.includes("cert")) {
      const v = String(attr.value ?? "").trim();
      if (v) return v;
    }
  }
  return null;
}

export function isRedeemEligible(row: {
  listPriceUsd: number | null;
  activeListingOrderHash: string | null;
  redeemStatus?: string | null;
}): boolean {
  const listed =
    row.listPriceUsd != null && row.activeListingOrderHash != null;
  if (listed) return false;
  if (isRedeemInFlight(row.redeemStatus)) return false;
  if (row.redeemStatus === "completed") return false;
  return true;
}

/** Blocks list / set-price while a redemption is open. */
export function isRedeemInFlight(status?: string | null): boolean {
  return (
    status === "ownership_verified" ||
    status === "pending" ||
    status === "burned" ||
    status === "vault_release_pending"
  );
}

export function redeemSurfaceBadge(
  status?: string | null,
): { label: string; tone: "redeeming" | "transit" | "possession" } | null {
  if (!status) return null;
  if (status === "completed") {
    return { label: "In your possession", tone: "possession" };
  }
  if (status === "burned" || status === "vault_release_pending") {
    return { label: "On the way", tone: "transit" };
  }
  if (status === "ownership_verified" || status === "pending") {
    return { label: "Redeeming", tone: "redeeming" };
  }
  return null;
}

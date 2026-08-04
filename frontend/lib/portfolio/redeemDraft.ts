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

type StoredRedeemAddress = RedeemShipTo & { ownerUserId?: string };

export function readSavedRedeemAddress(forUserId?: string): RedeemAddressForm | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(ADDRESS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredRedeemAddress;
    if (!parsed?.name || !parsed?.line1 || !parsed?.city || !parsed?.postal) {
      return null;
    }
    // Require an owner tag when scoped — unscoped legacy payloads are untrusted
    // on shared browsers (could belong to a previous account).
    if (forUserId && parsed.ownerUserId !== forUserId) {
      return null;
    }
    return {
      ...EMPTY_REDEEM_ADDRESS_FORM,
      name: parsed.name,
      line1: parsed.line1,
      line2: parsed.line2,
      city: parsed.city,
      region: parsed.region,
      postal: parsed.postal,
      country: parsed.country === "ca" || parsed.country === "intl" ? parsed.country : "us",
      phone: parsed.phone,
      saveAddress: true,
    };
  } catch {
    return null;
  }
}

export function writeSavedRedeemAddress(
  shipTo: RedeemShipTo,
  ownerUserId?: string,
): void {
  if (typeof window === "undefined") return;
  const payload: StoredRedeemAddress = ownerUserId
    ? { ...shipTo, ownerUserId }
    : shipTo;
  localStorage.setItem(ADDRESS_KEY, JSON.stringify(payload));
}

export function clearSavedRedeemAddress(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(ADDRESS_KEY);
}

/** One-shot flag: Settings migrated legacy redeem ship-to into the server address book. */
export function hasMigratedRedeemAddress(userId: string): boolean {
  if (typeof window === "undefined" || !userId) return true;
  try {
    return localStorage.getItem(`tk_ship_addr_migrated_v1:${userId}`) === "1";
  } catch {
    return true;
  }
}

export function markRedeemAddressMigrated(userId: string): void {
  if (typeof window === "undefined" || !userId) return;
  try {
    localStorage.setItem(`tk_ship_addr_migrated_v1:${userId}`, "1");
  } catch {
    /* ignore */
  }
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

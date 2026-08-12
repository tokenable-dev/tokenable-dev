import type { SupportedChainId } from "@/lib/chains/types";
import type { RedeemShipTo } from "@/lib/core/api/rwa-redeem";
import type { RwaMetadata } from "@/lib/core";
import { PHONE_DIAL_CODE_VALUES } from "@/lib/shipping/phoneDialOptions";
import { splitShipToPhone } from "@/lib/shipping/shipToValidation";

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

export type RedeemAddressForm = RedeemShipTo & {
  saveAddress: boolean;
  /** Country dial for national `phone` (composed into RedeemShipTo.phone on submit). */
  phoneDial: string;
};

export const EMPTY_REDEEM_ADDRESS_FORM: RedeemAddressForm = {
  name: "",
  line1: "",
  line2: "",
  city: "",
  region: "",
  postal: "",
  country: "us",
  phone: "",
  phoneDial: "+1",
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
    const { phoneDial, phoneNational } = splitShipToPhone(
      parsed.phone ?? "",
      PHONE_DIAL_CODE_VALUES,
    );
    return {
      ...EMPTY_REDEEM_ADDRESS_FORM,
      name: parsed.name,
      line1: parsed.line1,
      line2: parsed.line2,
      city: parsed.city,
      region: parsed.region,
      postal: parsed.postal,
      country: parsed.country === "ca" || parsed.country === "intl" ? parsed.country : "us",
      phone: phoneNational,
      phoneDial,
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
    status === "in_custody" ||
    status === "burned" ||
    status === "vault_release_pending"
  );
}

/** Preparing = custody held, shipment not yet ticketed. */
export function isRedeemPreparingPhase(
  status?: string | null,
  trackingNumber?: string | null,
): boolean {
  return status === "in_custody" && !trackingNumber?.trim();
}

/** In transit = tracking set (and/or burn/release) while still open. */
export function isRedeemTransitPhase(
  status?: string | null,
  trackingNumber?: string | null,
): boolean {
  if (status === "burned" || status === "vault_release_pending") return true;
  return status === "in_custody" && Boolean(trackingNumber?.trim());
}

export type RedeemSurfaceBadge = {
  label: string;
  tone: "redeeming" | "transit" | "possession";
  kind: "custody_pending" | "preparing" | "transit" | "possession";
  /** Deep-link into redeem status / resume screens (null for possession). */
  statusHref: string | null;
};

export function redeemSurfaceBadge(
  status?: string | null,
  trackingNumber?: string | null,
): RedeemSurfaceBadge | null {
  if (!status) return null;
  if (status === "completed") {
    return {
      label: "In your possession",
      tone: "possession",
      kind: "possession",
      statusHref: "/portfolio/redeem?view=done",
    };
  }
  const tracked = Boolean(trackingNumber?.trim());
  if (
    status === "burned" ||
    status === "vault_release_pending" ||
    (status === "in_custody" && tracked)
  ) {
    return {
      label: "In transit",
      tone: "transit",
      kind: "transit",
      statusHref: "/portfolio/redeem?view=transit",
    };
  }
  if (status === "in_custody") {
    return {
      label: "Redeeming — preparing",
      tone: "redeeming",
      kind: "preparing",
      statusHref: "/portfolio/redeem?view=preparing",
    };
  }
  if (status === "ownership_verified" || status === "pending") {
    return {
      label: "Redeeming — finish transfer",
      tone: "redeeming",
      kind: "custody_pending",
      statusHref: "/portfolio/redeem?view=resume",
    };
  }
  return null;
}

/**
 * The manifest for one outbound shipment, so the owner can cross-check the
 * physical slabs against what we say shipped before confirming receipt.
 * A batch can hold up to `REDEEM_BATCH_MAX` cards, so this is a document
 * rather than an on-screen list.
 */
export async function downloadRedeemManifest(input: {
  idx: number;
  vaultLabel: string;
  cards: RedeemDraftCard[];
  trackingNumber: string | null;
  trackingCarrier: string | null;
}): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const marginX = 56;
  let y = 64;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("TOKENABLE — PACKING SLIP", marginX, y);
  y += 26;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(100);
  const count = input.cards.length;
  doc.text(
    `Shipment ${input.idx} · ${input.vaultLabel} · ${count} card${count === 1 ? "" : "s"}`,
    marginX,
    y,
  );
  y += 16;
  if (input.trackingNumber) {
    doc.text(
      `Tracking ${input.trackingNumber}${input.trackingCarrier ? ` · ${input.trackingCarrier}` : ""}`,
      marginX,
      y,
    );
    y += 16;
  }
  y += 12;

  doc.setTextColor(0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("CARDS IN THIS SHIPMENT", marginX, y);
  y += 18;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  for (const [i, c] of input.cards.entries()) {
    const parts = [
      `${i + 1}.`,
      c.certNumber ? `Cert #${c.certNumber}` : "Cert —",
      c.grade || "Ungraded",
      c.name,
    ];
    const wrapped = doc.splitTextToSize(parts.join("  |  "), 500);
    doc.text(wrapped, marginX, y);
    y += wrapped.length * 13 + 4;
    if (y > 720) {
      doc.addPage();
      y = 64;
    }
  }

  y += 20;
  doc.setDrawColor(200);
  doc.line(marginX, y, 556, y);
  y += 20;

  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(
    doc.splitTextToSize(
      "Check each slab against its cert number before confirming receipt.",
      500,
    ),
    marginX,
    y,
  );

  doc.save(`tokenable-packing-slip-shipment-${input.idx}.pdf`);
}

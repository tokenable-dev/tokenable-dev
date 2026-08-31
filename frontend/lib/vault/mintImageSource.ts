import type { PsaAnalyzeResult } from "@/lib/core";
import { ASSETS } from "@/constants/assets";
import { psaCertImageMatchesFormCert } from "@/lib/vault/mintFormPsa";

export type MintImageSource =
  | "psa_cert"
  | "user_upload"
  | "cardhedger_catalog"
  | "tokenable_placeholder";

const CARDHEDGER_PLACEHOLDER_PATH_RE =
  /(?:card[_-]?hedge(?:r)?[_-]?(?:logo|default|placeholder)|default[_-]?card|no[_-]?image|missing[_-]?image|placeholder[_-]?card)/i;

function normalizeImageUrl(url: string): string {
  const t = url.trim();
  return t.startsWith("//") ? `https:${t}` : t;
}

function isPsaCertSlabCloudfrontUrl(url: string): boolean {
  return url.includes("d1htnxwo4o0jhw.cloudfront.net/cert/");
}

/** Cardhedger branded generic card — not real catalog art. */
export function isCardhedgerBrandedPlaceholderUrl(
  url: string | null | undefined,
): boolean {
  if (!url?.trim()) return false;
  const t = normalizeImageUrl(url);
  try {
    const { pathname, hostname } = new URL(t);
    const path = decodeURIComponent(pathname).toLowerCase();
    const host = hostname.toLowerCase();
    if (CARDHEDGER_PLACEHOLDER_PATH_RE.test(path)) return true;
    if (host.includes("cardhedger") && /(?:logo|placeholder|default)/i.test(path)) {
      return true;
    }
    if (host.includes("cdn.bubble.io") && /card[_-]?hedge/i.test(path)) {
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

import { scoreCardhedgerCatalogCoverUrl } from "@/lib/marketplace/cardhedgerBubbleCoverImage";

export function isUsableCardhedgerMintImageUrl(
  url: string | null | undefined,
): boolean {
  if (!url?.trim()) return false;
  const t = normalizeImageUrl(url);
  if (!/^https?:\/\//i.test(t)) return false;
  if (isPsaCertSlabCloudfrontUrl(t)) return false;
  if (isCardhedgerBrandedPlaceholderUrl(t)) return false;
  if (scoreCardhedgerCatalogCoverUrl(t) < 55) return false;
  return true;
}

export function resolveCardhedgerMintImageUrl(
  imageUrl: string | null | undefined,
): string | null {
  const raw = imageUrl?.trim();
  if (!raw || !isUsableCardhedgerMintImageUrl(raw)) return null;
  return normalizeImageUrl(raw);
}

export function resolveSelfVaultMintImageSelection(input: {
  analyze: PsaAnalyzeResult | null;
  certNumber: string;
  userImage?: File | string | null;
}): {
  imageUrl?: string;
  useUserFile: boolean;
  source: MintImageSource;
  previewUrl: string;
} {
  const trustedPsaSlabUrl = psaCertImageMatchesFormCert(
    input.analyze,
    input.certNumber,
  )
    ? input.analyze?.psaCertImages?.front?.trim()
    : undefined;

  if (trustedPsaSlabUrl) {
    return {
      imageUrl: trustedPsaSlabUrl,
      useUserFile: false,
      source: "psa_cert",
      previewUrl: trustedPsaSlabUrl,
    };
  }

  if (input.userImage instanceof File) {
    return {
      useUserFile: true,
      source: "user_upload",
      previewUrl: "",
    };
  }

  if (typeof input.userImage === "string" && input.userImage.trim()) {
    const userUrl = input.userImage.trim();
    return {
      imageUrl: userUrl,
      useUserFile: false,
      source: "user_upload",
      previewUrl: userUrl,
    };
  }

  const cardhedgerUrl = resolveCardhedgerMintImageUrl(
    input.analyze?.cardhedgerMint?.imageUrl,
  );
  if (cardhedgerUrl) {
    return {
      imageUrl: cardhedgerUrl,
      useUserFile: false,
      source: "cardhedger_catalog",
      previewUrl: cardhedgerUrl,
    };
  }

  return {
    useUserFile: false,
    source: "tokenable_placeholder",
    previewUrl: ASSETS.icons.tokenableMintPlaceholder,
  };
}

export function mintImageSourceLabel(source: MintImageSource): string {
  switch (source) {
    case "psa_cert":
      return "PSA cert slab";
    case "user_upload":
      return "Your upload";
    case "cardhedger_catalog":
      return "Catalog representative";
    case "tokenable_placeholder":
      return "Tokenable default";
  }
}

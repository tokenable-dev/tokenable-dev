import type { CollectionPlatformTapeFill } from "@/lib/core";

/** Cardhedger comps are completed marketplace sales — no buy/sell aggressor in upstream data. */
export function externalTapeSideDisplay(row: CollectionPlatformTapeFill): {
  label: string;
  title: string;
} {
  const saleType = row.externalSaleType?.trim();
  if (!saleType) {
    return {
      label: "SALE",
      title:
        "Completed external marketplace sale. Cardhedger does not provide buy/sell aggressor.",
    };
  }
  const lower = saleType.toLowerCase();
  if (lower.includes("daily reference") || lower === "reference") {
    return {
      label: "REF",
      title:
        "Cardhedger daily reference close for this day (not an individual auction). Shown for history depth; excluded from Vol.",
    };
  }
  let label = "SALE";
  if (lower.includes("auction")) label = "AUCTION";
  else if (lower.includes("offer")) label = "OFFER";
  else if (lower.includes("buy it now") || lower === "bin") label = "BIN";
  else if (saleType.length <= 10) label = saleType.toUpperCase();

  return {
    label,
    title: `External marketplace sale (${saleType}). Buy/sell aggressor not provided by Cardhedger.`,
  };
}

function normalizeExternalSaleUrl(url: string | null | undefined): string | null {
  const raw = url?.trim();
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

/** Trades tape Source column — marketplace name as plain text. */
export type TapeSourceDisplay = {
  label: string;
  title?: string;
  href?: string | null;
};

export function tapeSourceDisplay(row: CollectionPlatformTapeFill): TapeSourceDisplay {
  if (row.source === "cardhedger") {
    const lower = row.externalSaleType?.trim().toLowerCase() ?? "";
    if (lower.includes("daily reference") || lower === "reference") {
      return {
        label: "—",
        title: "Cardhedger daily reference — not an individual marketplace sale.",
        href: null,
      };
    }
    const platform = row.externalSalePlatform?.trim();
    const href = normalizeExternalSaleUrl(row.externalSaleUrl);
    if (!platform) {
      return {
        label: "—",
        title: "Marketplace not identified (no sale URL from Cardhedger).",
        href: null,
      };
    }
    return {
      label: platform,
      title: href
        ? `Open sold listing on ${platform}`
        : `Inferred marketplace from Cardhedger (listing URL not available).`,
      href,
    };
  }

  return {
    label: "Tokenable",
    title: "On-platform Tokenable trade.",
    href: null,
  };
}

/** Popup sold-listing view — avoids navigating away from Tokenable. */
export function openExternalSaleListing(url: string): void {
  const normalized = normalizeExternalSaleUrl(url);
  if (!normalized) return;
  const w = Math.min(1024, Math.round(window.screen.availWidth * 0.9));
  const h = Math.min(800, Math.round(window.screen.availHeight * 0.85));
  const left = Math.max(0, Math.round((window.screen.availWidth - w) / 2));
  const top = Math.max(0, Math.round((window.screen.availHeight - h) / 2));
  const features = [
    `width=${w}`,
    `height=${h}`,
    `left=${left}`,
    `top=${top}`,
    "noopener",
    "noreferrer",
    "scrollbars=yes",
    "resizable=yes",
  ].join(",");
  const popup = window.open(normalized, "tokenable-external-sale", features);
  popup?.focus();
}

export function tapeSideDisplay(row: CollectionPlatformTapeFill): {
  label: string;
  title?: string;
  className: string;
} {
  if (row.source === "cardhedger") {
    const ext = externalTapeSideDisplay(row);
    return {
      label: ext.label,
      title: ext.title,
      className: "text-white",
    };
  }
  const isSell = row.tapeAggressor === "sell";
  return {
    label: isSell ? "SELL" : "BUY",
    className: "text-white",
  };
}

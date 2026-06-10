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

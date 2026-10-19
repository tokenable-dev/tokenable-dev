/**
 * Privy's sign modal prints Seaport `startAmount` as a raw uint256.
 * USDC uses 6 decimals, so 500 USDC appears as 500000000. The signed
 * payload stays in base units; this only rewrites the tree the modal shows.
 */

type SignTree = Record<string, unknown>;

const USDC_BASE = BigInt(1_000_000);

function formatUsdcUnits(raw: unknown): string | null {
  const text = typeof raw === "bigint" ? raw.toString() : String(raw ?? "").trim();
  if (!/^\d+$/.test(text)) return null;
  const units = BigInt(text);
  const whole = units / USDC_BASE;
  const frac = units % USDC_BASE;
  const wholeLabel = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  if (frac === BigInt(0)) return `${wholeLabel} USDC`;
  const fracLabel = frac.toString().padStart(6, "0").replace(/0+$/, "");
  return `${wholeLabel}.${fracLabel} USDC`;
}

function formatErc20Item(item: unknown): unknown {
  if (!item || typeof item !== "object") return item;
  const row = item as SignTree;
  if (Number(row.itemType) !== 1) return item;
  const next: SignTree = { ...row };
  for (const key of ["startAmount", "endAmount"] as const) {
    const formatted = formatUsdcUnits(row[key]);
    if (formatted) next[key] = formatted;
  }
  return next;
}

function formatItemList(value: unknown): unknown {
  if (!Array.isArray(value)) return value;
  return value.map(formatErc20Item);
}

/** Display clone of the Privy typed-data view (`domain` + `message`). */
export function formatSeaportSignDisplay(data: unknown): unknown {
  if (!data || typeof data !== "object") return data;
  const root = data as SignTree;
  const message = root.message;
  if (!message || typeof message !== "object") return data;
  const msg = message as SignTree;
  return {
    ...root,
    message: {
      ...msg,
      offer: formatItemList(msg.offer),
      consideration: formatItemList(msg.consideration),
    },
  };
}

function sumErc20Start(items: unknown): bigint {
  if (!Array.isArray(items)) return BigInt(0);
  let sum = BigInt(0);
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const row = item as SignTree;
    if (Number(row.itemType) !== 1) continue;
    const text = String(row.startAmount ?? "").trim();
    if (/^\d+$/.test(text)) sum += BigInt(text);
  }
  return sum;
}

/** Headline for the Privy sign modal, e.g. "Bid 500 USDC". */
export function seaportSignAmountLabel(
  message: Record<string, unknown>,
  side: "bid" | "list",
): string | null {
  const units = sumErc20Start(side === "bid" ? message.offer : message.consideration);
  if (units <= BigInt(0)) return null;
  const formatted = formatUsdcUnits(units);
  if (!formatted) return null;
  return side === "bid" ? `Bid ${formatted}` : `List for ${formatted}`;
}

export function installSeaportSignDisplay(): void {
  if (typeof window === "undefined") return;
  (
    window as Window & {
      __tkFormatSeaportSignDisplay?: (data: unknown) => unknown;
    }
  ).__tkFormatSeaportSignDisplay = formatSeaportSignDisplay;
}

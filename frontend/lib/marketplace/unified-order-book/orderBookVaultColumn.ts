import type { Order } from "@/lib/core";
import { listingVaultBadge } from "@/lib/marketplace/collectionListingModalHelpers";
import type { OrderBookDepthLevel } from "./orderBookMath";

function vaultShortLabel(label: string): string {
  const t = label.trim();
  if (!t || t === "—") return "—";
  if (/^psa(\s+vault)?$/i.test(t)) return "PSA";
  const noVault = t.replace(/\s+vault$/i, "").trim();
  if (/^[A-Z0-9]{2,8}$/i.test(noVault)) return noVault.toUpperCase();
  const first = noVault.split(/\s+/)[0] ?? noVault;
  return first.length <= 6 ? first.toUpperCase() : first.slice(0, 3).toUpperCase();
}

/** Card.html VAULT column — `PSA`, `PSA · TKB`, `PSA ×2 · TKB`. Bids use `—`. */
export function formatOrderBookVaultColumn(orders: Order[]): string {
  if (!orders.length) return "—";
  const counts = new Map<string, number>();
  for (const o of orders) {
    const short = vaultShortLabel(listingVaultBadge(o).label);
    counts.set(short, (counts.get(short) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name, n]) => (n > 1 ? `${name} ×${n}` : name))
    .join(" · ");
}

export function attachOrderBookVaultLabels(
  askLevels: OrderBookDepthLevel[],
): OrderBookDepthLevel[] {
  return askLevels.map((level) => ({
    ...level,
    vaultLabel: formatOrderBookVaultColumn(level.orders),
  }));
}

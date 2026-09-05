import type { OrderListItem } from "@/lib/core/api/orders";
import type { P2pOrder } from "@/lib/core/api/p2p";
import type { RwaMetadata } from "@/lib/core/api/rwa-types";
import type { RwaVaultInfo } from "@/lib/core/api/rwa-settlement";
import { displayAssetNameFromMetadata } from "@/lib/marketplace/rwaDisplayTitle";
import {
  formatPsaGradedByDisplay,
  psaGradePolicyInputFromGraded,
} from "@/lib/market/psaGradePolicy";
import type { VaultHubRow } from "@/lib/vault/vaultHubTypes";

type OwnedAssetLike = {
  tokenId: number;
  metadata: RwaMetadata | null;
  imageUrl: string | null;
};

function gradeFromMetadata(meta: RwaMetadata | null): string {
  if (!meta) return "—";
  const props = meta.properties as Record<string, unknown> | undefined;
  const graded = (props?.graded ?? null) as Record<string, unknown> | null;
  if (graded && typeof graded === "object") {
    try {
      return formatPsaGradedByDisplay(psaGradePolicyInputFromGraded(graded)) || "—";
    } catch {
      /* fall through */
    }
  }
  return "—";
}

function formatListPrice(micros: string): string {
  const n = Number(micros);
  if (!Number.isFinite(n) || n <= 0) return "";
  return `$${Math.round(n / 1_000_000).toLocaleString("en-US")}`;
}

function askPriceByToken(
  activeOrders: OrderListItem[],
  offerer: string,
): Map<number, string> {
  const out = new Map<number, string>();
  const wallet = offerer.toLowerCase();
  for (const o of activeOrders) {
    if (o.side !== "ask" || o.status !== "active") continue;
    if ((o.offerer ?? "").toLowerCase() !== wallet) continue;
    const tid = Number(o.tokenId);
    if (!Number.isFinite(tid) || out.has(tid)) continue;
    const label = formatListPrice(o.price);
    if (label) out.set(tid, label);
  }
  return out;
}

/**
 * Partner-vault holdings / P2P ship-to-buyer.
 * Hub (ds-22) does not list these — they go to Portfolio. Kept for reuse.
 */
export function buildPartnerVaultHubRows(input: {
  assets: OwnedAssetLike[];
  vaultInfo: RwaVaultInfo[];
  activeOrders: OrderListItem[];
  wallet: string;
  p2pSellerOrders: P2pOrder[];
}): VaultHubRow[] {
  const policyByToken = new Map(
    input.vaultInfo.map((v) => [Number(v.tokenId), v.settlementPolicy] as const),
  );
  const askByToken = askPriceByToken(input.activeOrders, input.wallet);
  const assetByToken = new Map(input.assets.map((a) => [a.tokenId, a]));

  const soldNeedShip = input.p2pSellerOrders.filter(
    (o) => o.status === "SOLD" && !o.trackingNumber?.trim(),
  );
  const soldTokenIds = new Set(
    soldNeedShip.map((o) => Number(o.tokenId)).filter((n) => Number.isFinite(n)),
  );

  const rows: VaultHubRow[] = [];

  for (const order of soldNeedShip) {
    const tid = Number(order.tokenId);
    const asset = Number.isFinite(tid) ? assetByToken.get(tid) : undefined;
    const name = asset
      ? displayAssetNameFromMetadata(asset.metadata, `Token #${tid}`)
      : `Token #${order.tokenId}`;
    rows.push({
      id: `p2p-sold:${order.id}`,
      vstate: "transit",
      name,
      grade: gradeFromMetadata(asset?.metadata ?? null),
      cert: String(order.tokenId),
      imageUrl: asset?.imageUrl ?? "",
      eta: "Ship within 3 business days",
      addTrackingHref: `/p2p/orders/${encodeURIComponent(order.id)}`,
    });
  }

  for (const asset of input.assets) {
    if (policyByToken.get(asset.tokenId) !== "self_vault_hold") continue;
    if (soldTokenIds.has(asset.tokenId)) continue;

    const listed = askByToken.get(asset.tokenId);
    rows.push({
      id: `self:${asset.tokenId}`,
      vstate: "vaulted",
      name: displayAssetNameFromMetadata(
        asset.metadata,
        `Token #${asset.tokenId}`,
      ),
      grade: gradeFromMetadata(asset.metadata),
      cert: String(asset.tokenId),
      imageUrl: asset.imageUrl ?? "",
      eta: listed ? `Listed at ${listed}` : "Set a price in your portfolio to go live",
    });
  }

  return rows;
}

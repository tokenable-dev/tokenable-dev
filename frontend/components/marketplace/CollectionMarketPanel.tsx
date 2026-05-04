"use client";

import type {
  CollectionMarketPreview,
  MarketPriceBand,
} from "@/lib/core";

function formatUsd(b: MarketPriceBand | null): string {
  if (!b) return "—";
  const a = b.avg;
  if (a != null && Number.isFinite(a)) {
    return `$${a.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (b.low != null && b.high != null) {
    return `$${b.low.toFixed(2)} – $${b.high.toFixed(2)}`;
  }
  return "—";
}

function slabTierEbayBand(
  c: NonNullable<CollectionMarketPreview["card"]>,
  historyTier: string,
): MarketPriceBand | null {
  const t = String(historyTier ?? "").trim();
  if (!t.startsWith("PSA_")) return null;
  const fromMap = c.ebayPsaTiers?.[t];
  if (fromMap) return fromMap;
  if (t === "PSA_10") return c.ebayPsa10 ?? null;
  if (t === "PSA_9") return c.ebayPsa9 ?? null;
  return null;
}

function BandRow({
  label,
  band,
}: {
  label: string;
  band: MarketPriceBand | null;
}) {
  if (!band) return null;
  const meta: string[] = [];
  if (band.saleCount != null) {
    meta.push(
      band.approxSaleCount ? `≈${band.saleCount} sales` : `${band.saleCount} sales`,
    );
  }
  if (band.lastUpdated) {
    meta.push(new Date(band.lastUpdated).toLocaleDateString("en-US"));
  }
  return (
    <div className="rounded-lg border border-zinc-800/80 bg-black/30 px-2.5 py-2">
      <dt className="text-[11px] font-medium text-zinc-500">{label}</dt>
      <dd className="mt-1 text-[15px] font-semibold tabular-nums text-zinc-100">
        {formatUsd(band)}
      </dd>
      {meta.length > 0 ? (
        <p className="mt-1 text-[10px] text-zinc-600 tabular-nums">{meta.join(" · ")}</p>
      ) : null}
    </div>
  );
}

export function CollectionMarketPanel({
  data,
  isLoading,
  error,
  historyTier = "PSA_10",
  tierLabel = "PSA 10",
  preferredImageUrl,
}: {
  data: CollectionMarketPreview | undefined;
  isLoading: boolean;
  error: Error | null;
  historyTier?: string;
  tierLabel?: string | null;
  preferredImageUrl?: string | null;
}) {
  if (isLoading) {
    return (
      <div className="w-full rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] px-3 py-3 animate-pulse">
        <div className="h-3 w-36 rounded bg-zinc-800/80" />
        <div className="mt-2 h-16 rounded-lg bg-zinc-800/50" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="w-full rounded-xl border border-amber-500/25 bg-amber-500/[0.06] px-3 py-2.5 text-[13px] text-amber-100/90">
        {error.message}
      </div>
    );
  }
  if (!data) return null;
  if (!data.enabled) {
    return (
      <div className="w-full rounded-xl border border-zinc-800/80 bg-zinc-950/50 px-3 py-3 text-[13px] text-zinc-500">
        Price data unavailable.
      </div>
    );
  }
  if (!data.matched || !data.card) {
    return (
      <div className="w-full rounded-xl border border-zinc-800/80 bg-zinc-950/50 px-3 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500 mb-1.5">
          Market reference
        </p>
        <p className="text-[13px] text-zinc-400 leading-snug">
          {data.message?.replace(/Cardhedger/gi, "External").trim() ||
            "Comparable market price isn’t available for this card yet. Pool listings still show liquidity on the marketplace."}
        </p>
      </div>
    );
  }
  const c = data.card;
  const displayImageUrl =
    typeof preferredImageUrl === "string" && preferredImageUrl.trim()
      ? preferredImageUrl.trim()
      : c.image;
  const tier = String(historyTier ?? "PSA_10").trim();
  const slabBand = tier.startsWith("PSA_") ? slabTierEbayBand(c, tier) : null;
  const tierHuman = (tierLabel ?? "PSA 10").trim() || "PSA 10";
  return (
    <div className="w-full rounded-xl border border-emerald-500/25 bg-gradient-to-b from-emerald-500/[0.06] to-black/20 px-3 py-3 shadow-[0_8px_32px_-16px_rgba(16,185,129,0.35)]">
      <div className="flex items-start gap-3">
        {displayImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={displayImageUrl}
            alt=""
            className="h-16 w-[46px] shrink-0 rounded-md border border-zinc-700/80 object-cover"
          />
        ) : (
          <div className="h-16 w-[46px] shrink-0 rounded-md border border-zinc-800 bg-zinc-900/80" />
        )}
        <div className="min-w-0 flex-1">
          <p className="mt-0.5 text-[14px] font-semibold text-white leading-snug line-clamp-2">{c.name}</p>
          <p className="text-[12px] text-zinc-500 mt-0.5">
            {c.setName}
            {c.cardNumber ? ` · ${c.cardNumber}` : ""}
            {c.setType ? ` · ${c.setType}` : null}
          </p>
        </div>
      </div>
      <dl className="mt-3 space-y-2">
        {slabBand ? <BandRow label={`eBay (${tierHuman})`} band={slabBand} /> : null}
      </dl>
    </div>
  );
}


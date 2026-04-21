"use client";

import type {
  CollectionPoketracePreview,
  PoketracePriceBand,
} from "@/lib/api";

function formatUsd(b: PoketracePriceBand | null): string {
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

function BandRow({
  label,
  band,
}: {
  label: string;
  band: PoketracePriceBand | null;
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

export function CollectionPoketracePanel({
  data,
  isLoading,
  error,
}: {
  data: CollectionPoketracePreview | undefined;
  isLoading: boolean;
  error: Error | null;
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
          PokeTrace reference (NM)
        </p>
        <p className="text-[13px] text-zinc-400 leading-snug">
          {data.message ??
            "Reference unavailable — catalog match not loaded. External market price uses PokeTrace when matched, otherwise JustTCG; listing-pool stats are liquidity only."}
        </p>
      </div>
    );
  }

  const c = data.card;
  const approx = data.matchConfidence === "approximate";

  return (
    <div className="w-full rounded-xl border border-emerald-500/25 bg-gradient-to-b from-emerald-500/[0.06] to-black/20 px-3 py-3 shadow-[0_8px_32px_-16px_rgba(16,185,129,0.35)]">
      {approx ? (
        <p className="mb-2 rounded-md border border-amber-500/30 bg-amber-500/[0.08] px-2 py-1.5 text-[11px] font-medium leading-snug text-amber-100/95">
          Approximate market data: catalog match is not fully verified for this card. Prices and
          trends are indicative only.
        </p>
      ) : null}
      <div className="flex items-start gap-3">
        {c.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={c.image}
            alt=""
            className="h-16 w-[46px] shrink-0 rounded-md border border-zinc-700/80 object-cover"
          />
        ) : (
          <div className="h-16 w-[46px] shrink-0 rounded-md border border-zinc-800 bg-zinc-900/80" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-400/90">
            PokeTrace reference (NM)
          </p>
          <p className="mt-0.5 text-[14px] font-semibold text-white leading-snug line-clamp-2">
            {c.name}
          </p>
          <p className="text-[12px] text-zinc-500 mt-0.5">
            {c.setName}
            {c.cardNumber ? ` · ${c.cardNumber}` : ""}
            {c.tcgplayerId ? (
              <span className="text-zinc-600"> · #{c.tcgplayerId}</span>
            ) : null}
          </p>
        </div>
      </div>

      <dl className="mt-3 space-y-2">
        <BandRow label="eBay" band={c.ebayNearMint} />
        <BandRow label="TCGPlayer" band={c.tcgplayerNearMint} />
      </dl>

      {c.topPrice != null && Number.isFinite(c.topPrice) ? (
        <p className="mt-3 text-[11px] text-zinc-500 tabular-nums">
          Top reference{" "}
          <span className="text-zinc-300">${c.topPrice.toFixed(2)}</span>
          {c.totalSaleCount != null ? (
            <span> · {c.totalSaleCount} sales</span>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}

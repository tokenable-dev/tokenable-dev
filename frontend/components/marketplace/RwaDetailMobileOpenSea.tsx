"use client";

import Link from "next/link";
import { type ReactNode } from "react";
import { MARKET_PRICE_CHANGE_PERIOD_SHORT } from "@/lib/market";

function shortenAddr(addr: string | undefined | null): string {
  if (!addr?.trim()) return "—";
  const a = addr.trim();
  if (a.length <= 10) return a;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function VerifiedGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M9 12.5 11 14.5 15.5 10 17 11.5 11 17.5 9 15.5 4.5 10 6 8.5 9 12.5Z" />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2Zm-1.2 14.9-3.5-3.5 1.4-1.4 2.1 2.1 5.6-5.6 1.4 1.4-7 7Z"
      />
    </svg>
  );
}

export type RwaDetailOpenSeaPurchaseCardProps = {
  /** "Buy for" when listed; "Market" when not listed / owner without list price */
  priceLabel: string;
  /** Top-right pill e.g. +5.2% 1mo */
  topBadge?: ReactNode;
  primaryPrice: ReactNode;
  secondaryPrice?: ReactNode;
  marketContext?: ReactNode;
  primaryAction: ReactNode;
  secondaryAction?: ReactNode;
  footerNote?: ReactNode;
};

/** OpenSea-style purchase block directly under the hero image. */
export function RwaDetailOpenSeaPurchaseCard({
  priceLabel,
  topBadge,
  primaryPrice,
  secondaryPrice,
  marketContext,
  primaryAction,
  secondaryAction,
  footerNote,
}: RwaDetailOpenSeaPurchaseCardProps) {
  return (
    <div className="rounded-2xl border border-zinc-800/90 bg-[#18181b] px-4 py-4 shadow-[0_12px_40px_-20px_rgba(0,0,0,0.85)]">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
          {priceLabel}
        </span>
        {topBadge != null ? (
          <span className="shrink-0 rounded-md border border-zinc-700/80 bg-zinc-900/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
            {topBadge}
          </span>
        ) : null}
      </div>

      <div className="mt-2.5 flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
        {primaryPrice}
        {secondaryPrice != null ? secondaryPrice : null}
      </div>

      {marketContext != null ? <div className="mt-3 min-w-0">{marketContext}</div> : null}

      <div
        className={`mt-4 grid min-w-0 gap-2.5 ${
          secondaryAction != null ? "grid-cols-2" : "grid-cols-1"
        }`}
      >
        <div className="min-w-0">{primaryAction}</div>
        {secondaryAction != null ? (
          <div className="min-w-0">{secondaryAction}</div>
        ) : null}
      </div>

      {footerNote != null ? <div className="mt-2.5 min-w-0">{footerNote}</div> : null}
    </div>
  );
}

export function RwaDetailOpenSeaMarketChangeBadge({
  pct,
}: {
  pct: number;
}) {
  const up = pct > 0;
  const down = pct < 0;
  return (
    <span
      className={
        up
          ? "text-mint"
          : down
            ? "text-rose-400"
            : "text-zinc-400"
      }
    >
      {pct > 0 ? "+" : ""}
      {pct.toFixed(1)}% {MARKET_PRICE_CHANGE_PERIOD_SHORT}
    </span>
  );
}

export type RwaDetailOpenSeaIdentityProps = {
  title: ReactNode;
  collectionLabel: string;
  collectionHref?: string | null;
  ownerAddress?: string | null;
  isOwner?: boolean;
  tags: { id: string; label: string }[];
  setHeadline?: string | null;
};

export function RwaDetailOpenSeaIdentity({
  title,
  collectionLabel,
  collectionHref,
  ownerAddress,
  isOwner = false,
  tags,
  setHeadline,
}: RwaDetailOpenSeaIdentityProps) {
  const ownerLine = isOwner
    ? "You"
    : ownerAddress
      ? shortenAddr(ownerAddress)
      : "—";

  return (
    <div className="min-w-0 space-y-3 pt-1">
      <h1 className="text-[1.625rem] font-bold leading-tight tracking-tight text-white">
        {title}
      </h1>

      <div className="flex min-w-0 items-center justify-between gap-3">
        {collectionHref ? (
          <Link
            href={collectionHref}
            className="flex min-w-0 items-center gap-2 text-inherit no-underline hover:opacity-90"
          >
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-zinc-600 to-zinc-800 text-[10px] font-bold text-white ring-1 ring-zinc-600/80"
              aria-hidden
            >
              {collectionLabel.slice(0, 1).toUpperCase()}
            </span>
            <span className="min-w-0 truncate text-[15px] font-semibold text-white">
              {collectionLabel}
            </span>
            <VerifiedGlyph className="h-[18px] w-[18px] shrink-0 text-sky-400" />
          </Link>
        ) : (
          <div className="flex min-w-0 items-center gap-2">
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-zinc-600 to-zinc-800 text-[10px] font-bold text-white ring-1 ring-zinc-600/80"
              aria-hidden
            >
              {collectionLabel.slice(0, 1).toUpperCase()}
            </span>
            <span className="min-w-0 truncate text-[15px] font-semibold text-white">
              {collectionLabel}
            </span>
          </div>
        )}

        <p className="shrink-0 text-[13px] text-zinc-500">
          <span className="text-zinc-500">Owned by </span>
          <span className="font-medium text-zinc-300">{ownerLine}</span>
        </p>
      </div>

      {setHeadline ? (
        <p className="text-[13px] font-medium leading-snug text-zinc-500">{setHeadline}</p>
      ) : null}

      {tags.length > 0 ? (
        <div className="flex min-w-0 flex-wrap gap-2">
          {tags.map((t) => (
            <span
              key={t.id}
              className="inline-flex items-center rounded-lg border border-zinc-700/90 bg-zinc-900/60 px-2.5 py-1 text-[11px] font-semibold text-zinc-300"
            >
              {t.label}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function RwaDetailOpenSeaTabs({
  detailsPanel,
  collectionHref,
}: {
  detailsPanel: ReactNode;
  collectionHref?: string | null;
}) {
  return (
    <div className="w-full min-w-0">
      <div
        className="flex w-full min-w-0 border-b border-zinc-800"
        role="tablist"
        aria-label="Asset information"
      >
        <div
          role="tab"
          aria-selected
          className="relative min-w-0 flex-1 px-2 pb-2.5 pt-1 text-center text-[14px] font-semibold text-white"
        >
          Details
          <span
            className="absolute bottom-0 left-0 right-0 h-[2px] bg-white"
            aria-hidden
          />
        </div>
        {collectionHref ? (
          <Link
            href={collectionHref}
            role="tab"
            aria-selected={false}
            className="relative min-w-0 flex-1 px-2 pb-2.5 pt-1 text-center text-[14px] font-semibold text-zinc-500 no-underline transition-colors hover:text-zinc-300"
          >
            Market
          </Link>
        ) : (
          <span className="relative min-w-0 flex-1 px-2 pb-2.5 pt-1 text-center text-[14px] font-semibold text-zinc-600">
            Market
          </span>
        )}
      </div>
      <div className="mt-3 w-full min-w-0" role="tabpanel" aria-label="Details">
        {detailsPanel}
      </div>
    </div>
  );
}

/** Compact market row inside purchase card (reference + 1mo change). */
export function RwaDetailOpenSeaMarketRow({
  externalRefUsd,
  marketChangePct,
  formatUsd,
}: {
  externalRefUsd: number | null;
  marketChangePct: number | null;
  formatUsd: (n: number) => string;
}) {
  if (externalRefUsd == null && marketChangePct == null) return null;
  return (
    <div className="flex min-w-0 flex-wrap gap-x-4 gap-y-1 text-[12px]">
      {externalRefUsd != null ? (
        <span className="text-zinc-500">
          Ref{" "}
          <span className="font-semibold tabular-nums text-zinc-300">
            {formatUsd(externalRefUsd)}
          </span>
        </span>
      ) : null}
      {marketChangePct != null && Number.isFinite(marketChangePct) ? (
        <span className="text-zinc-500">
          {MARKET_PRICE_CHANGE_PERIOD_SHORT}{" "}
          <span
            className={`font-semibold tabular-nums ${
              marketChangePct > 0
                ? "text-mint"
                : marketChangePct < 0
                  ? "text-rose-400"
                  : "text-zinc-300"
            }`}
          >
            {marketChangePct > 0 ? "+" : ""}
            {marketChangePct.toFixed(1)}%
          </span>
        </span>
      ) : null}
    </div>
  );
}

/** OpenSea-style pill buttons for purchase card actions. */
export function RwaDetailOpenSeaPrimaryButton({
  children,
  onClick,
  disabled,
  bright = false,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  bright?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex h-12 w-full min-w-0 items-center justify-center rounded-xl px-4 text-[15px] font-bold leading-none transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 ${
        bright
          ? "bg-mint text-[#030712] shadow-[0_8px_24px_-8px_rgba(16,211,51,0.55)] hover:brightness-110"
          : "bg-mint text-[#030712] hover:brightness-110"
      }`}
    >
      {children}
    </button>
  );
}

export function RwaDetailOpenSeaSecondaryButton({
  children,
  href,
  onClick,
  disabled,
}: {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const cls =
    "flex h-12 w-full min-w-0 items-center justify-center rounded-xl border border-zinc-500/80 bg-transparent px-4 text-[15px] font-bold leading-none text-white transition hover:border-zinc-400 hover:bg-white/[0.04] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50";
  if (href && !disabled) {
    return (
      <Link href={href} className={`${cls} no-underline`}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={cls}>
      {children}
    </button>
  );
}

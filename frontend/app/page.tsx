"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { MarketIndexes } from "@/components/landing/MarketIndexes";
import { ASSETS } from "@/constants/assets";

/**
 * Reference: teal “aurora” blobs — soft top-right / bottom-right wash.
 */
const AURORA_ORBS: Array<{
  top: string;
  left: string;
  size: number;
  blur: number;
  fill: string;
}> = [
  { top: "10%", left: "82%", size: 300, blur: 110, fill: "rgba(45, 212, 191, 0.16)" },
  { top: "76%", left: "78%", size: 420, blur: 128, fill: "rgba(20, 184, 166, 0.12)" },
  { top: "38%", left: "6%", size: 220, blur: 96, fill: "rgba(0, 255, 170, 0.09)" },
  { top: "52%", left: "48%", size: 160, blur: 88, fill: "rgba(148, 255, 212, 0.06)" },
];

function AmbientAurora() {
  return (
    <div className="pointer-events-none absolute inset-0 z-[1] overflow-hidden" aria-hidden>
      {AURORA_ORBS.map((o, i) => (
        <div
          key={i}
          className="absolute rounded-full -translate-x-1/2 -translate-y-1/2 will-change-transform"
          style={{
            top: o.top,
            left: o.left,
            width: o.size,
            height: o.size,
            background: o.fill,
            filter: `blur(${o.blur}px)`,
          }}
        />
      ))}
    </div>
  );
}

function FeeBadgeIcons() {
  return (
    <div className="flex items-center justify-center" aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={ASSETS.icons.lowestTransactionFee}
        alt=""
        width={78}
        height={78}
        className="h-11 w-11 object-contain sm:h-12 sm:w-12"
      />
    </div>
  );
}

/** Fast / instant settlement — provided mark */
function InstantSettlementIcons() {
  return (
    <div className="flex items-center justify-center" aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={ASSETS.icons.instantSettlement}
        alt=""
        width={72}
        height={72}
        className="h-11 w-11 object-contain sm:h-12 sm:w-12"
      />
    </div>
  );
}

function Psa10Mark() {
  return (
    <div
      className="flex items-end justify-center gap-1.5 select-none sm:gap-2"
      aria-label="PSA 10"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={ASSETS.icons.psaMark}
        alt=""
        width={104}
        height={40}
        className="h-10 w-auto max-w-[min(100%,7.25rem)] object-contain object-bottom sm:h-12"
      />
      <span className="text-4xl font-black leading-[0.85] tracking-tight text-white sm:text-5xl">
        10
      </span>
    </div>
  );
}

/** Shared height + bottom alignment so stat rows and captions line up across columns. */
function FeatureStat({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="flex w-full min-h-[3.5rem] shrink-0 items-end justify-center sm:min-h-[4rem]">
        {children}
      </div>
      <span className="mt-3 text-[11px] font-semibold uppercase leading-snug tracking-[0.14em] text-mint sm:text-xs">
        {label}
      </span>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#060708] text-white">
      <div className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-b from-[#07080c] via-[#060708] to-[#030304]" />

      <AmbientAurora />

      <div
        className="pointer-events-none absolute inset-0 z-[2] opacity-[0.035]"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(148,255,212,0.4) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      {/* Hero */}
      <section className="relative z-10 flex flex-col items-center px-6 pt-24 pb-16 sm:pt-32 sm:pb-20">
        <div className="mb-10 flex flex-col items-center gap-4 sm:mb-12 sm:flex-row sm:gap-5">
          <img
            src={ASSETS.icons.tokenable}
            alt=""
            width={52}
            height={52}
            className="h-[52px] w-[52px] object-contain"
          />
          <span className="text-2xl font-extrabold tracking-[0.12em] text-white sm:text-3xl">
            TOKENABLE
          </span>
        </div>

        <h1 className="mb-5 max-w-4xl text-center text-[1.65rem] font-bold leading-tight tracking-tight text-white sm:text-4xl md:text-5xl lg:text-[3.25rem] lg:leading-[1.12]">
          Tokenized Collectibles Exchange
        </h1>

        <p className="mb-11 max-w-xl text-center text-sm leading-relaxed text-gray-400 sm:text-base sm:leading-relaxed">
          Trade tokenized collectibles with instant settlement on-chain. All cards are graded gems PSA
          10 and vaulted and authenticated.
        </p>

        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-center sm:gap-4">
          <Link
            href="/exchange"
            className="inline-flex min-w-[200px] items-center justify-center rounded-full bg-mint px-8 py-3.5 text-center text-base font-bold text-[#030712] shadow-lg shadow-mint/15 transition hover:brightness-110 hover:shadow-mint/25 active:scale-[0.98] sm:min-w-[220px]"
          >
            Collectibles Markets
          </Link>
          <Link
            href="/vault"
            className="inline-flex min-w-[200px] items-center justify-center rounded-full border-2 border-mint/70 bg-transparent px-8 py-3.5 text-center text-base font-semibold text-white transition hover:border-mint hover:bg-mint/10 active:scale-[0.98] sm:min-w-[220px]"
          >
            Start Selling
          </Link>
        </div>
      </section>

      {/* Feature stats */}
      <section className="relative z-10 mx-auto max-w-5xl border-t border-white/[0.06] px-6 py-16 sm:py-20">
        <div className="grid grid-cols-2 items-start gap-x-8 gap-y-12 sm:gap-x-10 lg:grid-cols-4 lg:gap-x-8 lg:gap-y-0">
          <FeatureStat label="Collectibles Market">
            <span className="text-3xl font-extrabold tracking-tight text-white tabular-nums sm:text-4xl">
              $10B
            </span>
          </FeatureStat>

          <FeatureStat label="Lowest Transaction Fee">
            <FeeBadgeIcons />
          </FeatureStat>

          <FeatureStat label="PSA 10 Gem Only">
            <Psa10Mark />
          </FeatureStat>

          <FeatureStat label="Instant Settlement">
            <InstantSettlementIcons />
          </FeatureStat>
        </div>
      </section>

      <MarketIndexes />

      <footer className="relative z-10 border-t border-gray-800/60 py-8 text-center text-xs text-gray-600">
        &copy; {new Date().getFullYear()} Tokenable. All rights reserved.
      </footer>
    </div>
  );
}

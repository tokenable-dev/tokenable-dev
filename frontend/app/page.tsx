"use client";

import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { TrendingCollectionsCarousel } from "@/components/landing/TrendingCollectionsCarousel";
import { ASSETS } from "@/constants/assets";

/** Fixed visual row so icons + $10B align across the 2×2 / 4-col grid. */
const FEATURE_STAT_VISUAL_SLOT_CLASS =
  "flex w-full h-9 shrink-0 items-center justify-center sm:h-10";

/** Square landing stat icons (gems, fees) — slightly larger than PSA / $10B slot. */
const FEATURE_STAT_SQUARE_ICON_CLASS =
  "h-8 w-8 object-contain grayscale saturate-0 sm:h-9 sm:w-9";

/** Wide PSA wordmark — height capped to match square icons’ visual weight. */
const FEATURE_STAT_WIDE_ICON_CLASS =
  "max-h-[1.625rem] w-auto max-w-[4.25rem] object-contain sm:max-h-[1.875rem] sm:max-w-[4.75rem]";

function FeeBadgeIcons() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={ASSETS.icons.lowestFees}
      alt=""
      width={78}
      height={78}
      className={FEATURE_STAT_SQUARE_ICON_CLASS}
      aria-hidden
    />
  );
}

function GemsOnlyIcon() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={ASSETS.icons.gemsOnly}
      alt=""
      width={78}
      height={78}
      className={FEATURE_STAT_SQUARE_ICON_CLASS}
      aria-hidden
    />
  );
}

function VaultedAuthenticatedIcon() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={ASSETS.icons.vaultedAuthenticated}
      alt=""
      width={104}
      height={40}
      className={FEATURE_STAT_WIDE_ICON_CLASS}
      aria-hidden
    />
  );
}

function FeatureStat({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className={FEATURE_STAT_VISUAL_SLOT_CLASS}>
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
    <div className="relative min-h-screen overflow-x-clip bg-black text-white">
      <div
        className="landing-grid-drift pointer-events-none absolute inset-0 z-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(255,255,255,0.35) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      {/* Hero — mobile: natural height (avoid 100svh jumps when browser chrome shows/hides) */}
      <section className="relative z-10 flex flex-col max-sm:px-4 max-sm:pt-6 max-sm:pb-6 sm:items-center sm:px-6 sm:pt-28 sm:pb-20">
        <div className="flex w-full flex-col items-center max-sm:gap-3">
          <h1
            className="landing-enter mb-2 max-w-4xl text-center text-[1.48rem] font-bold leading-[1.18] tracking-tight text-white max-sm:px-1 sm:mb-5 sm:text-4xl sm:leading-tight md:text-5xl lg:text-[3.25rem] lg:leading-[1.12]"
            style={{ "--landing-enter-delay": "0s" } as CSSProperties}
          >
            Tokenized Collectibles Markets
          </h1>

          <p
            className="landing-enter mb-3 max-w-xl text-center text-[12px] leading-snug text-gray-400 sm:mb-8 sm:text-base sm:leading-relaxed"
            style={{ "--landing-enter-delay": "70ms" } as CSSProperties}
          >
            Trade Authenticated and Vaulted Gems with Instant Settlement.
          </p>

          <TrendingCollectionsCarousel
            variant="landing"
            className="max-sm:!my-2 max-sm:w-full sm:mx-auto sm:mt-0"
          />
        </div>

        <div
          className="landing-enter flex w-full max-w-xl shrink-0 flex-col items-stretch gap-2 pt-4 max-sm:pt-5 sm:mt-12 sm:flex-row sm:items-center sm:justify-center sm:gap-4 sm:pt-0"
          style={{ "--landing-enter-delay": "190ms" } as CSSProperties}
        >
          <Link
            href="/markets"
            className="inline-flex min-w-[200px] items-center justify-center rounded-full bg-mint px-7 py-2.5 text-center text-base font-bold text-[#030712] shadow-lg shadow-mint/15 transition hover:brightness-110 hover:shadow-mint/25 active:scale-[0.98] max-sm:w-full max-sm:min-h-[44px] sm:min-w-[220px] sm:py-3.5"
          >
            Markets
          </Link>
          <Link
            href="/vault"
            className="inline-flex min-w-[200px] items-center justify-center rounded-full border-2 border-mint/70 bg-transparent px-7 py-2.5 text-center text-base font-semibold text-white transition hover:border-mint hover:bg-mint/10 active:scale-[0.98] max-sm:w-full max-sm:min-h-[44px] sm:min-w-[220px] sm:py-3.5"
          >
            Start Selling
          </Link>
        </div>
      </section>

      {/* Feature stats */}
      <section className="landing-stats-stagger relative z-10 mx-auto max-w-5xl border-t border-white/[0.06] px-6 py-16 sm:py-20">
        <div className="grid grid-cols-2 items-start gap-x-8 gap-y-12 sm:gap-x-10 lg:grid-cols-4 lg:gap-x-8 lg:gap-y-0">
          <FeatureStat label="100% Vaulted & Authenticated">
            <VaultedAuthenticatedIcon />
          </FeatureStat>

          <FeatureStat label="PSA, TAG, BGS Gems Only">
            <GemsOnlyIcon />
          </FeatureStat>

          <FeatureStat label="Lowest Fees">
            <FeeBadgeIcons />
          </FeatureStat>

          <FeatureStat label="Collectibles Market">
            <span className="text-[1.625rem] font-extrabold leading-none tracking-tight text-white tabular-nums sm:text-[1.875rem]">
              $10B
            </span>
          </FeatureStat>
        </div>
      </section>

      <footer
        className="landing-enter relative z-10 border-t border-gray-800/60 py-8 text-center text-xs text-gray-600"
        style={{ "--landing-enter-delay": "340ms" } as CSSProperties}
      >
        &copy; {new Date().getFullYear()} Tokenable. All rights reserved.
      </footer>
    </div>
  );
}

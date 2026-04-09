"use client";

import Link from "next/link";
import { ASSETS } from "@/constants/assets";
import { MarketIndexes } from "@/components/landing/MarketIndexes";

const STATS = [
  { value: "$ 10 T", label: "RWA Market by 2030" },
  { value: "5 %", label: "Transaction Fee" },
  { value: "24/7", label: "Order-Book Trading" },
  { value: "$ 100 M", label: "AUM Target 2026" },
];

/**
 * Reference: sparse teal “aurora” blobs — solid fills + heavy `filter:blur(80–140px)`.
 * Blob size must be large enough vs blur radius or the glow vanishes.
 */
const AURORA_ORBS: Array<{
  top: string;
  left: string;
  size: number;
  blur: number;
  fill: string;
}> = [
  /* small accent — top left */
  { top: "9%", left: "11%", size: 140, blur: 74, fill: "rgba(0, 255, 170, 0.24)" },
  /* medium — top right */
  { top: "11%", left: "86%", size: 220, blur: 94, fill: "rgba(45, 212, 191, 0.17)" },
  /* mid-height left */
  { top: "36%", left: "4%", size: 260, blur: 104, fill: "rgba(52, 211, 153, 0.135)" },
  /* large wash — behind Market Indexes band */
  { top: "62%", left: "18%", size: 440, blur: 126, fill: "rgba(0, 255, 163, 0.092)" },
  /* large — bottom right */
  { top: "78%", left: "78%", size: 400, blur: 120, fill: "rgba(20, 184, 166, 0.115)" },
  /* subtle depth — center-right */
  { top: "48%", left: "72%", size: 180, blur: 88, fill: "rgba(148, 255, 212, 0.125)" },
];

function AmbientAurora() {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-[1] overflow-hidden"
      aria-hidden
    >
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

export default function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#08090e] text-white">
      <div className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-b from-[#090a10] via-[#08090e] to-[#050508]" />

      <AmbientAurora />

      {/* Subtle grid overlay — above glows so dots stay visible */}
      <div
        className="pointer-events-none absolute inset-0 z-[2] opacity-[0.028]"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(148,255,212,0.35) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      {/* Hero */}
      <section className="relative z-10 flex flex-col items-center justify-center px-6 pt-28 sm:pt-36 pb-16">
        <div className="flex items-center gap-4 mb-8">
          <img
            src={ASSETS.icons.tokenable}
            alt="Tokenable"
            width={56}
            height={56}
            className="h-14 w-14 object-contain"
          />
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">
            TOKENABLE
          </h1>
        </div>

        <h2 className="text-xl sm:text-2xl font-semibold text-gray-200 mb-4 text-center">
          RWA Exchange&ensp;-&ensp;Real World Asset Trading Platform
        </h2>

        <p className="max-w-lg text-center text-sm sm:text-base text-gray-400 leading-relaxed mb-10">
          Tokenize, trade, and settle physical collectibles on-chain.
          <br />
          PSA-graded cards, instant settlement, 5% fee.
        </p>

        <Link
          href="/exchange"
          className="group relative inline-flex items-center justify-center rounded-full bg-mint px-8 py-3.5 text-base font-bold text-[#030712] transition-all hover:brightness-110 hover:shadow-lg hover:shadow-mint/25 active:scale-[0.97]"
        >
          RWA Exchange
        </Link>
      </section>

      {/* Stats */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 pb-24">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {STATS.map(({ value, label }) => (
            <div
              key={label}
              className="flex flex-col items-center justify-center rounded-2xl border border-emerald-500/20 bg-[#060d0b]/65 backdrop-blur-sm px-4 py-8 sm:py-10 transition-colors hover:border-emerald-400/40"
            >
              <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mb-2">
                {value}
              </span>
              <span className="text-xs sm:text-sm text-gray-400 text-center">
                {label}
              </span>
            </div>
          ))}
        </div>
      </section>

      <MarketIndexes />

      {/* Footer */}
      <footer className="relative z-10 border-t border-gray-800/50 py-8 text-center text-xs text-gray-600">
        &copy; {new Date().getFullYear()} Tokenable. All rights reserved.
      </footer>
    </div>
  );
}

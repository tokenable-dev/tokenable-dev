"use client";

import Link from "next/link";
import { ASSETS } from "@/constants/assets";

const STATS = [
  { value: "$ 10 T", label: "RWA Market by 2030" },
  { value: "5 %", label: "Transaction Fee" },
  { value: "24/7", label: "Order-Book Trading" },
  { value: "$ 100 M", label: "AUM Target 2026" },
];

export default function LandingPage() {
  return (
    <div className="relative min-h-screen bg-[#030712] text-white overflow-hidden">
      {/* Ambient glow effects */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-[10%] left-[8%] h-64 w-64 rounded-full bg-mint/8 blur-[120px]" />
        <div className="absolute top-[8%] right-[6%] h-72 w-72 rounded-full bg-mint/10 blur-[140px]" />
        <div className="absolute bottom-[10%] left-[15%] h-56 w-56 rounded-full bg-mint/6 blur-[100px]" />
        <div className="absolute bottom-[5%] right-[10%] h-48 w-48 rounded-full bg-mint-deep/8 blur-[110px]" />
      </div>

      {/* Subtle grid overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(148,255,212,0.3) 1px, transparent 1px)",
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
              className="flex flex-col items-center justify-center rounded-2xl border border-mint-deep/25 bg-[#060d0b]/60 backdrop-blur-sm px-4 py-8 sm:py-10 transition-colors hover:border-mint-deep/45"
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

      {/* Footer */}
      <footer className="relative z-10 border-t border-gray-800/50 py-8 text-center text-xs text-gray-600">
        &copy; {new Date().getFullYear()} Tokenable. All rights reserved.
      </footer>
    </div>
  );
}

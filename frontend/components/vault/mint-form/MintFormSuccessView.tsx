"use client";

import Link from "next/link";
import {
  GradientOutlineFrame,
  VAULT_OUTLINE_PAD_CLASS,
} from "@/components/ui/GradientOutlineFrame";

export function MintFormSuccessView({
  txHash,
  onReset,
}: {
  txHash: string;
  onReset: () => void;
}) {
  return (
    <div className="rounded-2xl border border-mint-deep/35 bg-[#0a0e14]/80 p-6 sm:p-8">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-mint/10 border border-mint/25 mb-4">
          <svg className="w-8 h-8 text-mint" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-white">Asset Minted Successfully</h3>
      </div>
      <div className="space-y-3">
        <div className="bg-gray-800/50 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Transaction Hash</p>
          <p className="text-xs font-mono text-blue-400 break-all">{txHash}</p>
        </div>
        <p className="text-xs text-mint text-center">Confirmed on-chain</p>
      </div>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:gap-3">
        <GradientOutlineFrame className="w-full flex-1" padClass={VAULT_OUTLINE_PAD_CLASS}>
          <Link
            href="/portfolio"
            className="flex w-full items-center justify-center rounded-[11px] border-0 !bg-black py-3 text-center text-sm font-bold text-mint no-underline transition hover:bg-zinc-950"
            style={{ backgroundColor: "#000000" }}
          >
            Portfolio
          </Link>
        </GradientOutlineFrame>
        <button
          type="button"
          onClick={onReset}
          className="w-full flex-1 rounded-xl border border-zinc-600/80 bg-black py-3 text-sm font-medium text-zinc-300 transition hover:border-zinc-500 hover:text-white sm:min-w-[10rem]"
          style={{ backgroundColor: "#000000" }}
        >
          Tokenize Another
        </button>
      </div>
    </div>
  );
}

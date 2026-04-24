"use client";

import Link from "next/link";
import { useState } from "react";

/**
 * Seaport ERC721_WITH_CRITERIA + Merkle 기준 컬렉션 매매 안내.
 */
export function CollectionTradeGuide() {
  const [open, setOpen] = useState(true);

  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900/50 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-white/[0.03] transition-colors"
      >
        <span className="text-sm font-semibold text-white">
          Trading on this collection (Seaport criteria bids)
        </span>
        <span className="text-gray-500 text-xs shrink-0">{open ? "Hide" : "Show"}</span>
      </button>
      {open && (
        <div className="px-4 pb-4 pt-0 space-y-4 border-t border-gray-800/80">
          <div className="grid sm:grid-cols-2 gap-4 text-[12px] leading-relaxed text-gray-400">
            <div className="rounded-xl bg-rose-500/[0.06] border border-rose-500/20 px-3 py-3">
              <p className="text-[11px] font-semibold text-rose-200/90 mb-2 uppercase tracking-wide">
                Buyers
              </p>
              <ul className="list-disc list-inside space-y-1.5 text-gray-400">
                <li>
                  <strong className="text-gray-300">Listed asks</strong> — open a token, approve USDC,
                  and fulfill the seller&apos;s Seaport listing.
                </li>
                <li>
                  <strong className="text-gray-300">Collection bid</strong> — sign a Seaport order with{" "}
                  <strong className="text-gray-300">ERC721_WITH_CRITERIA</strong> and the Merkle root
                  for this collection&apos;s <strong className="text-gray-300">current minted-in-bucket</strong>{" "}
                  token set. When that set grows, the root changes: older bids need to be{" "}
                  <strong className="text-gray-300">cancelled and re-signed</strong> (Orders shows{" "}
                  <span className="text-amber-200/90">Pool outdated</span>). New listings can still trigger{" "}
                  <strong className="text-gray-300">matchAdvancedOrders</strong> when roots align.
                </li>
              </ul>
            </div>
            <div className="rounded-xl bg-emerald-500/[0.06] border border-emerald-500/20 px-3 py-3">
              <p className="text-[11px] font-semibold text-emerald-200/90 mb-2 uppercase tracking-wide">
                Sellers
              </p>
              <ul className="list-disc list-inside space-y-1.5 text-gray-400">
                <li>
                  <strong className="text-gray-300">List</strong> —{" "}
                  <Link
                    href="/portfolio"
                    className="text-mint hover:underline font-medium"
                  >
                    My Assets
                  </Link>{" "}
                  → approve Seaport for all your RWAs once (setApprovalForAll), then sign each ask.
                </li>
                <li>
                  <strong className="text-gray-300">Fill a collection bid</strong> — open{" "}
                  <strong className="text-gray-300">Sell</strong>, pick your asset, and list at the
                  bid price (or less). The listing step triggers on-chain settlement when the Merkle
                  snapshot matches. Per-token page still has <strong className="text-gray-300">Match collection bid</strong>{" "}
                  if you already have a live listing there.
                </li>
              </ul>
            </div>
          </div>
          <p className="text-[11px] text-gray-600">
            Settlement is on-chain via Seaport. The Merkle leaf set follows{" "}
            <strong className="text-gray-500">minted RWAs in this card bucket</strong> (not only live
            asks). Your bid embeds one fixed root at sign time — it cannot track future mints without a new
            signature.
          </p>
        </div>
      )}
    </div>
  );
}

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
                  for this collection&apos;s active listings. One bid can match any listed token in the
                  set when a seller runs <strong className="text-gray-300">matchAdvancedOrders</strong>.
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
                  <strong className="text-gray-300">Match a collection bid</strong> — on the token page,
                  use <strong className="text-gray-300">Match collection bid</strong> (proof + on-chain
                  match). On the collection order book, use <strong className="text-gray-300">Sell</strong> on a bid
                  row to reprice your listing when needed and run the same match in one flow.
                </li>
              </ul>
            </div>
          </div>
          <p className="text-[11px] text-gray-600">
            Settlement is on-chain via Seaport. The Merkle leaf set is derived from active listings for
            the collection; bids must use the same root as the current set, or sellers should ask buyers
            to cancel and re-bid after listings change.
          </p>
        </div>
      )}
    </div>
  );
}

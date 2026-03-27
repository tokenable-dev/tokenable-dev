"use client";

import Link from "next/link";
import { useState } from "react";

/**
 * Seaport + 오프체인 풀 입찰만 사용할 때의 컬렉션 매매 안내 (새 컨트랙트 없음).
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
          Trading on this collection (Seaport + pool bids)
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
                  <strong className="text-gray-300">Listed asks</strong> — click a row, open the
                  asset page, buy with one Seaport flow (USDC approve + fulfill).
                </li>
                <li>
                  <strong className="text-gray-300">Pool bid</strong> — sign once (EIP-712) for
                  “I’ll pay X USDC for any asset in this graded bucket.” When a seller picks your
                  token, you sign a <strong className="text-gray-300">Seaport bid</strong> for that
                  token, then they can accept — no new contracts.
                </li>
              </ul>
            </div>
            <div className="rounded-xl bg-emerald-500/[0.06] border border-emerald-500/20 px-3 py-3">
              <p className="text-[11px] font-semibold text-emerald-200/90 mb-2 uppercase tracking-wide">
                Sellers
              </p>
              <ul className="list-disc list-inside space-y-1.5 text-gray-400">
                <li>
                  <strong className="text-gray-300">Fixed price</strong> —{" "}
                  <Link
                    href="/?tab=my-nfts"
                    className="text-mint hover:underline font-medium"
                  >
                    My Assets
                  </Link>{" "}
                  → List with one Seaport listing (approve token + sign).
                </li>
                <li>
                  <strong className="text-gray-300">Pool buyers</strong> — enter your token ID in
                  the order book footer, use <strong className="text-gray-300">Sell</strong> on a
                  pool row, then on your asset page: Check match → Buyer link → when their Seaport bid
                  appears, Accept.
                </li>
              </ul>
            </div>
          </div>
          <p className="text-[11px] text-gray-600">
            Settlement is always on-chain via Seaport. Pool bids are off-chain commitments until
            matched to a token-specific order.
          </p>
        </div>
      )}
    </div>
  );
}

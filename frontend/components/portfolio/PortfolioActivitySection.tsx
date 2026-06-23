"use client";

import type { TxRow } from "@/lib/portfolio/portfolioTypes";
import { CategoryBadge } from "./CollectibleCardChrome";

export function PortfolioActivitySection({
  loading,
  txRows,
}: {
  loading: boolean;
  txRows: TxRow[];
}) {
  return (
    <div id="transaction-history" className="rounded-2xl border border-gray-800 bg-[#0b1118] p-5 sm:p-6 scroll-mt-24">
      <h2 className="mb-4 text-sm font-bold">Transaction History</h2>
      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-11 animate-pulse rounded-lg bg-gray-800/40" />
          ))}
        </div>
      ) : txRows.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">No transactions yet</p>
      ) : (
        <div className="max-h-[264px] overflow-hidden overflow-y-auto rounded-xl border border-gray-800/60">
          <table className="w-full table-fixed text-[13px]">
            <colgroup>
              <col style={{ width: "10%" }} />
              <col style={{ width: "36%" }} />
              <col style={{ width: "14%" }} />
              <col style={{ width: "16%" }} />
              <col style={{ width: "24%" }} />
            </colgroup>
            <thead className="sticky top-0 z-10">
              <tr className="bg-[#111a25] text-left text-xs text-gray-500">
                <th className="px-4 py-2.5 font-medium">Type</th>
                <th className="px-4 py-2.5 font-medium">Asset</th>
                <th className="px-4 py-2.5 font-medium">Amount</th>
                <th className="px-4 py-2.5 font-medium">Price</th>
                <th className="px-4 py-2.5 font-medium">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/40">
              {txRows.map((tx) => (
                <tr key={tx.orderHash} className="transition-colors hover:bg-white/[0.02]">
                  <td className="px-4 py-2.5">
                    <span
                      className={`inline-flex items-center justify-center rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                        tx.type === "BUY"
                          ? "bg-mint/15 text-mint"
                          : "bg-red-500/15 text-red-400"
                      }`}
                    >
                      {tx.type}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-[13px] font-medium text-gray-200">
                        {tx.asset}
                      </span>
                      {tx.category ? <CategoryBadge label={tx.category} /> : null}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-gray-400">{tx.amount}</td>
                  <td className="px-4 py-2.5 text-gray-400">
                    ${tx.price.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </td>
                  <td className="px-4 py-2.5 text-gray-500">{tx.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

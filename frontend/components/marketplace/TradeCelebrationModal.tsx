"use client";

export type TradeCelebrationKind = "purchase" | "sale";

/**
 * Full-screen overlay after a successful on-platform buy or sell (instant fill / matched order).
 */
export function TradeCelebrationModal({
  open,
  kind,
  onClose,
}: {
  open: boolean;
  kind: TradeCelebrationKind;
  onClose: () => void;
}) {
  if (!open) return null;

  const purchase = kind === "purchase";
  const title = purchase ? "Purchase complete" : "Sale complete";
  const body = purchase
    ? "The RWA is yours — check your wallet. USDC moved on-chain as agreed."
    : "Your listing matched — USDC should appear in your wallet shortly.";
  const accent = purchase
    ? "from-mint/25 via-mint/10 to-transparent"
    : "from-rose-500/25 via-amber-400/10 to-transparent";

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="trade-celebration-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        className={`relative w-full max-w-sm overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0c0f14] shadow-[0_24px_80px_-24px_rgba(0,0,0,0.9)] ring-1 ring-white/[0.06]`}
      >
        <div
          className={`pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-gradient-to-br ${accent} blur-3xl`}
          aria-hidden
        />
        <div className="relative px-6 pb-6 pt-8 text-center">
          <div className="mb-4 text-5xl" aria-hidden>
            {purchase ? "🎉" : "✨"}
          </div>
          <h2
            id="trade-celebration-title"
            className="text-xl font-bold tracking-tight text-white"
          >
            {title}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">{body}</p>
          <button
            type="button"
            onClick={onClose}
            className="mt-7 w-full rounded-xl bg-gradient-to-r from-mint to-mint-dim py-3 text-sm font-semibold text-mint-ink shadow-[0_12px_32px_-16px_rgba(16,211,51,0.45)] transition hover:brightness-105"
          >
            Great
          </button>
        </div>
      </div>
    </div>
  );
}

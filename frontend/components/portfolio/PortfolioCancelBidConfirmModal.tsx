"use client";

export function PortfolioCancelBidConfirmModal({
  open,
  collectionLabel,
  priceLabel,
  pending,
  onClose,
  onConfirm,
}: {
  open: boolean;
  collectionLabel: string;
  priceLabel: string;
  pending?: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
}) {
  if (!open) return null;

  const label = collectionLabel.trim() || "Collection bid";

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="portfolio-cancel-bid-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        aria-label="Close"
        disabled={pending}
        onClick={onClose}
      />
      <div className="relative w-full max-w-xs rounded-2xl border border-rose-500/20 bg-zinc-950 px-5 py-5 shadow-xl shadow-black/50">
        <h2
          id="portfolio-cancel-bid-title"
          className="text-center text-base font-semibold text-white"
        >
          Cancel bid?
        </h2>
        <p className="mt-2 text-center text-[13px] leading-snug text-zinc-400">
          <span className="text-zinc-300">{label}</span>
          <span className="mx-1 text-zinc-600">·</span>
          <span className="font-mono tabular-nums text-zinc-400">{priceLabel} USDC</span>
        </p>
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={onClose}
            className="min-w-0 flex-1 rounded-lg border border-zinc-700/80 bg-zinc-900/80 py-2.5 text-[13px] font-semibold text-zinc-300 transition hover:bg-zinc-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            Keep
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => void onConfirm()}
            className="min-w-0 flex-1 rounded-lg border border-rose-500/40 bg-rose-500/15 py-2.5 text-[13px] font-semibold text-rose-200 transition hover:bg-rose-500/22 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? "…" : "Cancel"}
          </button>
        </div>
      </div>
    </div>
  );
}

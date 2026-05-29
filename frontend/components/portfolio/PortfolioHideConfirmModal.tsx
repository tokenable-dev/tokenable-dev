"use client";

function HideIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 12c2.4-4 6-6 9-6s6.6 2 9 6c-2.4 4-6 6-9 6s-6.6-2-9-6z" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M4 4l16 16" />
    </svg>
  );
}

export function PortfolioHideConfirmModal({
  open,
  tokenId,
  assetName,
  pending,
  onClose,
  onConfirm,
}: {
  open: boolean;
  tokenId: number;
  assetName: string;
  pending?: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
}) {
  if (!open) return null;

  const title = assetName.trim() || `RWA #${tokenId}`;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="portfolio-hide-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
        aria-label="Close"
        disabled={pending}
        onClick={onClose}
      />
      <div className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-mint/20 bg-[#0c0f14] shadow-[0_24px_80px_-24px_rgba(0,0,0,0.9)] ring-1 ring-mint/10">
        <div
          className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-gradient-to-br from-mint/30 via-mint/10 to-transparent blur-3xl"
          aria-hidden
        />
        <div className="relative px-6 pb-6 pt-7">
          <div className="mb-4 flex justify-center">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-mint/35 bg-mint/10 text-mint shadow-[0_0_28px_-12px_rgba(16,211,51,0.55)]">
              <HideIcon />
            </span>
          </div>
          <h2
            id="portfolio-hide-title"
            className="text-center text-lg font-bold tracking-tight text-white sm:text-xl"
          >
            Hide from portfolio?
          </h2>
          <p className="mt-2 text-center text-sm leading-relaxed text-zinc-400">
            <span className="font-medium text-zinc-200">{title}</span>
            <span className="mt-1 block text-zinc-500">
              Stays in your wallet · excluded from Total Value · restore from{" "}
              <span className="text-mint/90">Hidden</span>
            </span>
          </p>
          <div className="mt-6 flex flex-col gap-2.5 sm:flex-row-reverse sm:gap-3">
            <button
              type="button"
              disabled={pending}
              onClick={() => void onConfirm()}
              className="w-full rounded-xl bg-gradient-to-r from-mint to-mint-dim py-3 text-sm font-semibold text-mint-ink shadow-[0_12px_32px_-16px_rgba(16,211,51,0.5)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? "Hiding…" : "Hide"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={onClose}
              className="w-full rounded-xl border border-zinc-700/80 bg-zinc-900/80 py-3 text-sm font-semibold text-zinc-300 transition hover:border-zinc-600 hover:bg-zinc-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

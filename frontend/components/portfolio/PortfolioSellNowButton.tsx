"use client";

/** Unlisted card CTA — dark teal border, mint label (design ref). */
export function PortfolioSellNowButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className="w-full rounded-xl border border-[#0D4A42] bg-black px-2 py-2 text-center text-[10px] font-semibold leading-none text-mint transition-colors hover:border-[#145C52] hover:text-[#2EE86A] sm:px-3 sm:py-2.5 sm:text-[12px]"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
    >
      Sell now
    </button>
  );
}

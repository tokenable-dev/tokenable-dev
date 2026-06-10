"use client";

const BORDER_CLASS = "border border-[#5A3D72]";
const LABEL_CLASS =
  "font-semibold leading-none text-[#8B3540] transition-colors enabled:hover:text-[#A34452] disabled:cursor-not-allowed disabled:opacity-50";

/** Listed card CTA — solid dark purple border, dark red label (design ref). */
export function PortfolioListingManageButton({
  busy,
  onChange,
  onCancel,
}: {
  busy: boolean;
  onChange: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className={`flex w-full min-w-0 items-center justify-center gap-1 rounded-xl bg-black px-2 py-2 sm:gap-1.5 sm:px-3 sm:py-2.5 ${BORDER_CLASS}`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      {busy ? (
        <span className={`${LABEL_CLASS} text-[10px] sm:text-[12px]`}>Cancelling…</span>
      ) : (
        <>
          <button
            type="button"
            disabled={busy}
            className={`${LABEL_CLASS} text-[10px] sm:text-[12px]`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onChange();
            }}
          >
            Change
          </button>
          <span className="text-[10px] font-semibold leading-none text-[#8B3540]/70 sm:text-[12px]">
            /
          </span>
          <button
            type="button"
            disabled={busy}
            className={`${LABEL_CLASS} text-[10px] sm:text-[12px]`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onCancel();
            }}
          >
            Cancel
          </button>
        </>
      )}
    </div>
  );
}

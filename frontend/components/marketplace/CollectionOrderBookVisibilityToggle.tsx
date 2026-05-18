"use client";

import { IBM_Plex_Sans } from "next/font/google";

const orderBookToggleLabelFont = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["500"],
  display: "swap",
});

/**
 * Order book visibility: off = grey 32×20 track (spec) + × knob; on = mint + ✓.
 * Knob motion: 300ms ease-out.
 */
export function CollectionOrderBookVisibilityToggle({
  checked,
  onChange,
  rowJustify = "end",
  contentWidth = false,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  /** `start`: pack to the left. `end`: pack to the right (used with {@link contentWidth} on exchange bezel overlay). */
  rowJustify?: "start" | "end";
  /** When true, only as wide as label + switch (e.g. overlay on cluster bezel). */
  contentWidth?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-[10px] ${
        contentWidth ? "w-auto max-w-full min-w-0" : "w-full min-w-0"
      } ${rowJustify === "start" ? "justify-start" : "justify-end"}`}
    >
      <span
        id="orderbook-visibility-label"
        className={`${orderBookToggleLabelFont.className} text-[15px] font-medium leading-[150%] tracking-normal text-white`}
      >
        Show Order Book
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby="orderbook-visibility-label"
        onClick={() => onChange(!checked)}
        className={`relative box-border h-5 w-8 shrink-0 cursor-pointer rounded-[20px] pt-[2px] pr-[10px] pb-[2px] pl-[2px] transition-colors duration-300 ease-out ${
          checked
            ? "bg-[#0fd4bd]/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
            : "bg-[rgba(127,127,127,1)]"
        }`}
      >
        <span
          aria-hidden
          className={`pointer-events-none absolute left-[2px] top-[2px] flex h-4 w-4 items-center justify-center rounded-full bg-white shadow-sm transition-transform duration-300 ease-out ${
            checked ? "translate-x-[12px]" : "translate-x-0"
          }`}
        >
          {checked ? (
            <svg
              className="h-2.5 w-2.5 text-[#0a9e8a]"
              viewBox="0 0 14 14"
              fill="none"
              aria-hidden
            >
              <path
                d="M2.5 7 L5.5 10 L11.5 3.5"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            <svg className="h-2 w-2 text-zinc-500" viewBox="0 0 12 12" fill="none" aria-hidden>
              <path
                d="M3 3 L9 9 M9 3 L3 9"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          )}
        </span>
      </button>
    </div>
  );
}

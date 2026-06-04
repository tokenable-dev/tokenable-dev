"use client";

import { IBM_Plex_Sans } from "next/font/google";

const orderBookToggleLabelFont = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["500", "600"],
  display: "swap",
});

/**
 * Order book visibility: off = grey track + × knob; on = mint + ✓.
 * `bar` — full-width mobile control below the chart; `inline` — compact label + switch (desktop overlay).
 */
export function CollectionOrderBookVisibilityToggle({
  checked,
  onChange,
  rowJustify = "end",
  contentWidth = false,
  variant = "inline",
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  rowJustify?: "start" | "end";
  contentWidth?: boolean;
  variant?: "inline" | "bar";
}) {
  if (variant === "bar") {
    return (
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left transition-all duration-200 ${
          checked
            ? "border-mint/40 bg-mint/[0.07] shadow-[inset_0_1px_0_rgba(16,211,51,0.14),0_0_20px_-12px_rgba(16,211,51,0.45)]"
            : "border-black bg-black hover:border-zinc-600/90 active:bg-black"
        }`}
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <span
            className={`h-2 w-2 shrink-0 rounded-full transition-colors ${
              checked ? "bg-mint shadow-[0_0_8px_rgba(16,211,51,0.65)]" : "bg-zinc-600"
            }`}
            aria-hidden
          />
          <span className="min-w-0">
            <span
              className={`${orderBookToggleLabelFont.className} block text-[12px] font-semibold leading-tight tracking-tight text-white`}
            >
              Order book
            </span>
            <span className="mt-0.5 block text-[10px] leading-snug text-zinc-500">
              {checked ? "Bids & asks — tap a level to trade" : "Show live depth beside the chart"}
            </span>
          </span>
        </span>
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-all duration-200 ${
            checked
              ? "border-mint/35 bg-mint/15 text-mint"
              : "border-zinc-700 bg-black/40 text-zinc-500"
          }`}
          aria-hidden
        >
          <svg
            className={`h-3.5 w-3.5 transition-transform duration-200 ${checked ? "rotate-180" : ""}`}
            viewBox="0 0 16 16"
            fill="none"
          >
            <path
              d="M4 6 L8 10 L12 6"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </button>
    );
  }

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
            ? "bg-mint/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
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
              className="h-2.5 w-2.5 text-mint-deep"
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

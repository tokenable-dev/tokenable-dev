"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

const BUY_BAR_SCROLL_DELTA_PX = 10;
const BUY_BAR_TOP_SHOW_PX = 32;

/** Hide fixed Buy bar on scroll down; reveal on scroll up (mobile asset detail). */
function useScrollRevealBuyBar() {
  const [visible, setVisible] = useState(true);
  const lastY = useRef(0);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1279px)");
    if (!mq.matches) return;

    lastY.current = window.scrollY;

    const onScroll = () => {
      const y = window.scrollY;
      if (y <= BUY_BAR_TOP_SHOW_PX) {
        setVisible(true);
      } else if (y - lastY.current > BUY_BAR_SCROLL_DELTA_PX) {
        setVisible(false);
      } else if (lastY.current - y > BUY_BAR_SCROLL_DELTA_PX) {
        setVisible(true);
      }
      lastY.current = y;
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return visible;
}

/** Mobile sticky Buy rim — 2px gradient border (matches product spec). */
export const RWA_STICKY_BUY_BORDER_GRADIENT =
  "linear-gradient(90deg, #49C15E 9%, #10D333 53.81%, #004307 97.14%)";

export function RwaDetailMobileCardHeader({
  title,
  titleLoading = false,
  setDescription,
  cardIdLine,
  price,
}: {
  title: ReactNode;
  titleLoading?: boolean;
  setDescription?: string | null;
  cardIdLine?: string | null;
  price: ReactNode;
}) {
  return (
    <header className="w-full min-w-0 px-4 pt-5 pb-1 text-left xl:hidden">
      {titleLoading ? (
        <div
          className="h-8 w-[min(100%,16rem)] max-w-full animate-pulse rounded-lg bg-zinc-800/85"
          aria-hidden
        />
      ) : (
        <h1 className="text-[1.5rem] font-bold leading-tight tracking-tight text-white [overflow-wrap:anywhere]">
          <span>{title}</span>
          {cardIdLine ? (
            <span className="whitespace-nowrap text-zinc-400"> {cardIdLine}</span>
          ) : null}
        </h1>
      )}

      {setDescription ? (
        <p className="mt-2 text-[13px] font-normal leading-snug text-zinc-500">
          {setDescription}
        </p>
      ) : null}

      <div className="mt-5 min-w-0 tabular-nums">{price}</div>
    </header>
  );
}

export function RwaDetailMobileDetailSection({
  rows,
  title = "Detail",
  defaultExpanded = true,
}: {
  rows: { label: string; value: string }[];
  title?: string;
  defaultExpanded?: boolean;
}) {
  const [open, setOpen] = useState(defaultExpanded);

  if (rows.length === 0) return null;

  return (
    <section className="w-full min-w-0 px-4 pt-4 pb-2 xl:hidden" aria-label={title}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full min-w-0 items-center justify-between gap-3 py-1 text-left"
      >
        <h2 className="text-[15px] font-bold tracking-tight text-white">{title}</h2>
        <DetailChevron expanded={open} />
      </button>

      <div
        className={`grid transition-[grid-template-rows] duration-200 ease-out ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="mt-2 bg-black px-0 py-1">
            <dl className="flex w-full min-w-0 flex-col gap-y-3">
              {rows.map((row) => (
                <div
                  key={row.label}
                  className="flex items-start justify-between gap-4"
                >
                  <dt className="min-w-0 shrink-0 text-[13px] font-normal text-zinc-500">
                    {row.label}
                  </dt>
                  <dd className="min-w-0 max-w-[58%] text-right text-[13px] font-medium leading-snug text-white [overflow-wrap:anywhere]">
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>
    </section>
  );
}

function DetailChevron({ expanded }: { expanded: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={`h-5 w-5 shrink-0 text-zinc-400 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
      aria-hidden
    >
      <path
        d="M7 10l5 5 5-5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function RwaDetailStickyBuyFooter({
  children,
  footerNote,
}: {
  children: ReactNode;
  footerNote?: ReactNode;
}) {
  const barVisible = useScrollRevealBuyBar();

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-[90] bg-black/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] shadow-[0_-16px_48px_-8px_rgba(0,0,0,0.92)] backdrop-blur-md transition-transform duration-300 ease-out will-change-transform motion-reduce:transition-none xl:hidden ${
        barVisible
          ? "translate-y-0"
          : "pointer-events-none translate-y-full"
      }`}
      role="region"
      aria-label="Purchase actions"
      aria-hidden={!barVisible}
    >
      {footerNote != null ? (
        <div className="mb-2 min-w-0 text-center">{footerNote}</div>
      ) : null}
      {children}
    </div>
  );
}

/** Reference mobile CTA — black fill, 2px gradient rim, white label. */
export function RwaDetailStickyBuyButton({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <div
      className="w-full min-w-0 rounded-xl p-[2px]"
      style={{ background: RWA_STICKY_BUY_BORDER_GRADIENT }}
    >
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="flex h-[52px] w-full min-w-0 items-center justify-center rounded-[10px] bg-black text-[17px] font-semibold leading-none text-white transition hover:bg-zinc-950 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {children}
      </button>
    </div>
  );
}

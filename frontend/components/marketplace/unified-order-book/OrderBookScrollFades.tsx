"use client";

import { useLayoutEffect, useState, type RefObject } from "react";

/** Card.html `.ob-fade` — show chevrons only while the pane can scroll that way. */
export function useOrderBookScrollFades(
  scrollRef: RefObject<HTMLElement | null>,
  deps: ReadonlyArray<unknown>,
) {
  const [showTop, setShowTop] = useState(false);
  const [showBot, setShowBot] = useState(false);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const update = () => {
      const overflow = el.scrollHeight > el.clientHeight + 1;
      if (!overflow) {
        setShowTop(false);
        setShowBot(false);
        return;
      }
      setShowTop(el.scrollTop > 2);
      setShowBot(el.scrollTop + el.clientHeight < el.scrollHeight - 2);
    };

    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    ro?.observe(el);
    const inner = el.firstElementChild;
    if (inner instanceof HTMLElement) ro?.observe(inner);

    return () => {
      el.removeEventListener("scroll", update);
      ro?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- caller lists content keys
  }, deps);

  return { showTop, showBot };
}

export function OrderBookScrollFades({
  showTop,
  showBot,
}: {
  showTop: boolean;
  showBot: boolean;
}) {
  return (
    <>
      <div
        className={`cd-ob-fade cd-ob-fade--top${showTop ? "" : " cd-ob-fade--hide"}`}
        aria-hidden
      />
      <div
        className={`cd-ob-fade cd-ob-fade--bot${showBot ? "" : " cd-ob-fade--hide"}`}
        aria-hidden
      />
    </>
  );
}

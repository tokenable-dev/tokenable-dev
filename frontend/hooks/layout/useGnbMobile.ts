"use client";

import { useLayoutEffect, useState } from "react";

/** Prototype GNB breakpoint — burger + mobile search below 1025px (Markets/Portfolio/Vault HTML). */
const GNB_MOBILE_MQ = "(max-width: 1024px)";

export function useGnbMobile(): boolean {
  // Match SSR (desktop shell) until we read matchMedia after mount.
  const [mobile, setMobile] = useState(false);

  useLayoutEffect(() => {
    const mq = window.matchMedia(GNB_MOBILE_MQ);
    const apply = () => setMobile(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  return mobile;
}

"use client";

import { useEffect, useState } from "react";

/** Prototype GNB breakpoint — burger + mobile search below 881px. */
const GNB_MOBILE_MQ = "(max-width: 880px)";

export function useGnbMobile(): boolean {
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(GNB_MOBILE_MQ);
    const apply = () => setMobile(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  return mobile;
}

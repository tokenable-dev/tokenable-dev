"use client";

import { useEffect, useState } from "react";
import { COLLECTION_DETAIL_MOBILE_MEDIA } from "@/lib/marketplace/collectionDetailConstants";

/** Collection detail mobile shell — viewport below `lg` (1024px). */
export function useCollectionDetailMobile(): boolean {
  const [mobile, setMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(COLLECTION_DETAIL_MOBILE_MEDIA).matches;
  });
  useEffect(() => {
    const mq = window.matchMedia(COLLECTION_DETAIL_MOBILE_MEDIA);
    const apply = () => setMobile(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return mobile;
}

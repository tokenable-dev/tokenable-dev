"use client";

import { useEffect, useState } from "react";
import { COLLECTION_DETAIL_MOBILE_MEDIA } from "@/components/marketplace/collectionOverviewChrome";

/** Collection detail mobile shell — viewport below `lg` (1024px). */
export function useCollectionDetailMobile(): boolean {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(COLLECTION_DETAIL_MOBILE_MEDIA);
    const apply = () => setMobile(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return mobile;
}

"use client";

import { useEffect, useState } from "react";
import { COLLECTION_DETAIL_MOBILE_MEDIA } from "@/components/marketplace/collectionOverviewChrome";

function readCollectionDetailMobile(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia(COLLECTION_DETAIL_MOBILE_MEDIA).matches;
}

/** Collection detail mobile shell — viewport below `lg` (1024px). */
export function useCollectionDetailMobile(): boolean {
  const [mobile, setMobile] = useState(readCollectionDetailMobile);
  useEffect(() => {
    const mq = window.matchMedia(COLLECTION_DETAIL_MOBILE_MEDIA);
    const apply = () => setMobile(mq.matches);
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return mobile;
}

"use client";

import { useEffect } from "react";

const HTML_CLASS = "collection-details-scroll";
const MOBILE_LOCK_CLASS = "collection-details-mobile-lock";

/**
 * 컬렉션 상세: html에 클래스를 붙여 scrollbar-gutter만 적용 (스타일링 없음).
 * Mobile: page scroll so the hero can stick and condense (`is-stuck`).
 */
export function CollectionDetailsScrollScope() {
  useEffect(() => {
    document.documentElement.classList.add(HTML_CLASS);
    document.documentElement.classList.remove(MOBILE_LOCK_CLASS);
    return () => {
      document.documentElement.classList.remove(HTML_CLASS);
      document.documentElement.classList.remove(MOBILE_LOCK_CLASS);
    };
  }, []);
  return null;
}

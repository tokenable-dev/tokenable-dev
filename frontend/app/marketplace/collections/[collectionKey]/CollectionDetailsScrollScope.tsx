"use client";

import { useEffect } from "react";

const HTML_CLASS = "collection-details-scroll";

/**
 * 컬렉션 상세: html에 클래스를 붙여 scrollbar-gutter만 적용 (스타일링 없음).
 */
export function CollectionDetailsScrollScope() {
  useEffect(() => {
    document.documentElement.classList.add(HTML_CLASS);
    return () => {
      document.documentElement.classList.remove(HTML_CLASS);
    };
  }, []);
  return null;
}

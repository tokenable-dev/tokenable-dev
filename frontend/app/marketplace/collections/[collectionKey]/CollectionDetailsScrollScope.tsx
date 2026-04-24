"use client";

import { useEffect } from "react";

const HTML_CLASS = "collection-details-scroll";

/**
 * Scope custom scrollbar CSS to collection detail routes (viewport + nested utilities).
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

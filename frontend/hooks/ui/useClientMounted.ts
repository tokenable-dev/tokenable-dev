"use client";

import { useEffect, useState } from "react";

/** True after the component has mounted — use to avoid SSR/client markup mismatches. */
export function useClientMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

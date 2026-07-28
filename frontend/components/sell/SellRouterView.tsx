"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { resolveSellRouterDestination } from "@/lib/vault/vaultAccess";

/** Matches Tokenable-with design system-2/Sell.html — full-screen loader then role route. */
export function SellRouterView() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (cancelled) return;
      router.replace(resolveSellRouterDestination());
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [router]);

  return (
    <div className="sell-router" role="status" aria-live="polite" aria-busy="true">
      <div className="sell-router__inner">
        <div className="sell-router__dots" aria-hidden>
          <span className="sell-router__dot" />
          <span className="sell-router__dot" style={{ animationDelay: "0.15s" }} />
          <span className="sell-router__dot" style={{ animationDelay: "0.3s" }} />
        </div>
        <p className="sell-router__label">Opening your seller tools…</p>
      </div>
    </div>
  );
}

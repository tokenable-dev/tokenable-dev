"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";

/**
 * `/sell` router — everyone lands on `/vault` (Vault-Dashboard-Active.html).
 * Guests see the signed-out landing; signed-in users see the sell hub dashboard.
 */
export function SellRouterView() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const initialized = useAuthStore((s) => s.initialized);
  const loading = useAuthStore((s) => s.loading);

  useEffect(() => {
    if (!initialized || loading) return;
    router.replace("/vault");
  }, [initialized, loading, user, router]);

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

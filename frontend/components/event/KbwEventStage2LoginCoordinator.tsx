"use client";

import { useEffect } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { isKbwEventActive } from "@/lib/event/kbwEventPeriod";
import { isKbwStage2FlowPending } from "@/lib/event/kbwEventLoginRouting";
import { useAuthStore } from "@/store/authStore";

/**
 * MetaMask Mobile returns to `/event` before Tokenable cookie hydration finishes.
 * Nudge `GET /auth/session` so AddEmailRequiredModal / offer modal get a real user.
 */
export function KbwEventStage2LoginCoordinator() {
  const { ready, authenticated } = usePrivy();
  const user = useAuthStore((s) => s.user);
  const initialized = useAuthStore((s) => s.initialized);
  const refresh = useAuthStore((s) => s.refresh);

  useEffect(() => {
    if (!isKbwEventActive() || !isKbwStage2FlowPending()) return;
    if (!ready || !authenticated) return;
    if (user) return;
    void refresh({ showLoading: false });
  }, [ready, authenticated, user, refresh]);

  useEffect(() => {
    if (!isKbwEventActive() || !isKbwStage2FlowPending()) return;
    if (!ready || !authenticated || !initialized) return;
    if (user) return;
    const t = window.setTimeout(() => {
      void refresh({ showLoading: false });
    }, 800);
    return () => window.clearTimeout(t);
  }, [ready, authenticated, initialized, user, refresh]);

  return null;
}

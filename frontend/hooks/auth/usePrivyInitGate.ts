"use client";

import { useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useClientMounted } from "@/hooks/ui/useClientMounted";

/** How long to wait for Privy `ready` before showing auth CTAs anyway. */
const PRIVY_READY_TIMEOUT_MS = 5_000;

/**
 * Gates header/auth UI on Privy init — but does not wait forever.
 *
 * When `POST auth.privy.io/api/v1/sessions` fails (500), Privy never sets
 * `ready=true` and the GNB would otherwise show an infinite skeleton
 * (no Sign up / wallet chip). After the timeout we surface the logged-out CTA
 * so the user can retry; a refresh often recovers when Privy is healthy again.
 */
export function usePrivyInitGate(timeoutMs = PRIVY_READY_TIMEOUT_MS) {
  const mounted = useClientMounted();
  const { ready, authenticated } = usePrivy();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!mounted || ready) {
      setTimedOut(false);
      return;
    }
    const id = window.setTimeout(() => setTimedOut(true), timeoutMs);
    return () => window.clearTimeout(id);
  }, [mounted, ready, timeoutMs]);

  const waitingForPrivy = mounted && !ready && !timedOut;
  const privyUnavailable = timedOut && !ready;

  return {
    mounted,
    ready,
    authenticated,
    waitingForPrivy,
    privyUnavailable,
    /** Safe to leave the auth skeleton. */
    canShowAuthUi: mounted && (ready || timedOut),
  };
}

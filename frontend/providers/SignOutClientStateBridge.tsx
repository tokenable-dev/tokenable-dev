"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { clearSessionSensitiveClientCache } from "@/lib/auth/clearSessionClientState";
import { onAuthSignOutClearClientState } from "@/lib/privy/session";

/** Clears portfolio / inbox / wallet RQ cache when sign-out starts. */
export function SignOutClientStateBridge() {
  const queryClient = useQueryClient();

  useEffect(() => {
    return onAuthSignOutClearClientState(() => {
      clearSessionSensitiveClientCache(queryClient);
    });
  }, [queryClient]);

  return null;
}

"use client";

import { usePrivy } from "@privy-io/react-auth";
import { PrivyUserPill } from "@/components/privy/PrivyUserPill";
import { useAuthStore } from "@/store/authStore";

const SKELETON_CLS =
  "h-10 w-[7.5rem] animate-pulse rounded-xl border border-gray-800/60 bg-gray-900/50";

/** Header auth slot — Privy `UserPill` only (login + account dropdown). */
export function HeaderAuthControls() {
  const { ready, authenticated } = usePrivy();
  const initialized = useAuthStore((s) => s.initialized);
  const loading = useAuthStore((s) => s.loading);

  if (!ready || !initialized || loading) {
    return <div className={SKELETON_CLS} aria-hidden />;
  }

  if (!authenticated) {
    return <PrivyUserPill action={{ type: "login" }} />;
  }

  return <PrivyUserPill />;
}

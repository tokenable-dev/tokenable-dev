"use client";

import { useAuthStore } from "@/store/authStore";
import { HeaderAccountMenu, HeaderGuestAuthButtons } from "./HeaderAccountMenu";

export function HeaderAuthControls() {
  const user = useAuthStore((s) => s.user);
  const initialized = useAuthStore((s) => s.initialized);
  const loading = useAuthStore((s) => s.loading);

  if (!initialized || loading) {
    return (
      <div
        className="h-10 w-[5.5rem] animate-pulse rounded-xl border border-gray-800/60 bg-gray-900/50"
        aria-hidden
      />
    );
  }

  if (user) {
    return <HeaderAccountMenu />;
  }

  return <HeaderGuestAuthButtons />;
}

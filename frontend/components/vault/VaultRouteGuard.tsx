"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { canAccessVault } from "@/lib/auth/accountAccess";
import { useAuthStore } from "@/store/authStore";

/** Redirect non-internal users away from `/vault` (direct URL / legacy links). */
export function VaultRouteGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const initialized = useAuthStore((s) => s.initialized);
  const allowed = canAccessVault(user);

  useEffect(() => {
    if (!initialized) return;
    if (!allowed) {
      router.replace("/markets");
    }
  }, [initialized, allowed, router]);

  if (!initialized) {
    return null;
  }

  if (!allowed) {
    return null;
  }

  return <>{children}</>;
}

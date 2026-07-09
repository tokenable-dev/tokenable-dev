"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { useAuthUiStore } from "@/store/authUiStore";

/**
 * Vault routes require a Tokenable session (Privy sign-in).
 * Guests who land on a vault URL directly are sent back and prompted to sign in.
 */
export function VaultAuthGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const initialized = useAuthStore((s) => s.initialized);
  const loading = useAuthStore((s) => s.loading);
  const openSignIn = useAuthUiStore((s) => s.openSignIn);
  const pathname = usePathname();
  const redirected = useRef(false);

  const returnTo = pathname || "/vault";

  useEffect(() => {
    if (!initialized || loading || user || redirected.current) return;
    redirected.current = true;
    openSignIn({ returnTo });
    router.replace("/markets");
  }, [initialized, loading, user, openSignIn, returnTo, router]);

  useEffect(() => {
    if (user) redirected.current = false;
  }, [user]);

  if (!initialized || loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div
          className="h-7 w-7 animate-spin rounded-full border-2 border-[var(--azure)]/30 border-t-[var(--azure)]"
          aria-label="Loading"
        />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}

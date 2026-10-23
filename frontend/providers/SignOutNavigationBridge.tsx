"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { pathnameRequiresLeaveAfterSignOut } from "@/lib/auth/postSignOutNavigation";
import { onAuthSignOutComplete } from "@/lib/privy/session";

/** After sign-out, leave account-only URLs without opening the sign-in modal. */
export function SignOutNavigationBridge() {
  const router = useRouter();

  useEffect(() => {
    return onAuthSignOutComplete(() => {
      if (typeof window === "undefined") return;
      const path = window.location.pathname;
      if (pathnameRequiresLeaveAfterSignOut(path)) {
        router.replace("/");
      }
    });
  }, [router]);

  return null;
}

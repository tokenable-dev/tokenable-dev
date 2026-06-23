"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { useAuthUiStore, type AuthBanner } from "@/store/authUiStore";

const VERIFY_BANNERS: Record<string, AuthBanner> = {
  ok: {
    tone: "success",
    title: "Email verified",
    body: "Your email is confirmed. Sign in to continue.",
  },
  invalid: {
    tone: "error",
    title: "Invalid verification link",
    body: "The link may be broken. Sign in and request a new email.",
  },
  expired: {
    tone: "error",
    title: "Verification link expired",
    body: "Sign in and resend a new verification email.",
  },
  missing: {
    tone: "error",
    title: "Invalid verification request",
    body: "Try signing up again or use the link from your latest email.",
  },
};

function EmailVerifyHandlerInner() {
  const searchParams = useSearchParams();
  const refresh = useAuthStore((s) => s.refresh);
  const openSignIn = useAuthUiStore((s) => s.openSignIn);

  useEffect(() => {
    const v = searchParams.get("email_verify");
    if (!v) return;

    void refresh();

    const banner = VERIFY_BANNERS[v] ?? VERIFY_BANNERS.invalid;
    openSignIn({
      mode: "sign-in",
      openEmailForm: v === "ok",
      banner,
    });

    if (typeof window !== "undefined") {
      const u = new URL(window.location.href);
      u.searchParams.delete("email_verify");
      window.history.replaceState({}, "", u.pathname + (u.search || "") + u.hash);
    }
  }, [searchParams, refresh, openSignIn]);

  return null;
}

/** Opens the sign-in modal after email verification redirect (`?email_verify=`). */
export function EmailVerifyToast() {
  return (
    <Suspense fallback={null}>
      <EmailVerifyHandlerInner />
    </Suspense>
  );
}

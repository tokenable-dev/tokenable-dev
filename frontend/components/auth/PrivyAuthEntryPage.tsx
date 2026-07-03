"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useLogin, usePrivy } from "@privy-io/react-auth";
import { PrivyUserPill } from "@/components/privy/PrivyUserPill";
import { useAuthStore } from "@/store/authStore";

/** Opens Privy's native login modal; UserPill is the fallback if the modal is dismissed. */
export function PrivyAuthEntryPage() {
  const router = useRouter();
  const { ready, authenticated } = usePrivy();
  const { login } = useLogin();
  const { user, loading, initialized } = useAuthStore();
  const loginOpened = useRef(false);

  useEffect(() => {
    if (!loading && initialized && user) {
      router.replace("/");
    }
  }, [user, loading, initialized, router]);

  useEffect(() => {
    if (!ready || authenticated || loginOpened.current) return;
    loginOpened.current = true;
    login();
  }, [ready, authenticated, login]);

  if (!ready) {
    return (
      <div
        className="min-h-[calc(100vh-4rem)] flex items-center justify-center"
        aria-busy
        aria-label="Loading"
      />
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4">
      <PrivyUserPill action={{ type: "login" }} />
    </div>
  );
}

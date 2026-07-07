"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useLogin, usePrivy } from "@privy-io/react-auth";
import { PrivyUserPill } from "@/components/privy/PrivyUserPill";
import { useAuthStore } from "@/store/authStore";

type PrivyAuthEntryPageProps = {
  mode?: "login" | "signup";
};

/** Opens Privy's native login modal; UserPill is the fallback if the modal is dismissed. */
export function PrivyAuthEntryPage({ mode = "login" }: PrivyAuthEntryPageProps) {
  const router = useRouter();
  const { ready, authenticated } = usePrivy();
  const { login } = useLogin();
  const { user, loading, initialized } = useAuthStore();
  const loginOpened = useRef(false);

  const title = mode === "signup" ? "Create your account" : "Sign in to Tokenable";
  const subtitle =
    mode === "signup"
      ? "Connect with email or wallet to start trading vaulted cards."
      : "Connect with email or wallet to access your portfolio and vault.";

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
        className="secondary-page secondary-page--centered"
        aria-busy
        aria-label="Loading"
      >
        <div className="secondary-spinner" />
      </div>
    );
  }

  return (
    <div className="secondary-page secondary-page--centered px-4">
      <div className="secondary-auth-card">
        <h1 className="secondary-auth-card__title">{title}</h1>
        <p className="secondary-auth-card__text">{subtitle}</p>
        <div className="flex justify-center">
          <PrivyUserPill action={{ type: "login" }} />
        </div>
      </div>
    </div>
  );
}

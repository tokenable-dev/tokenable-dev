"use client";

import { useEffect, useState } from "react";
import { AuthModalShell } from "./AuthModalShell";
import { AuthProviderButtons } from "./AuthProviderButtons";
import { AuthNoticeBanner } from "./AuthNoticeBanner";
import { EmailAuthForm } from "./EmailAuthForm";
import { useAuthUiStore } from "@/store/authUiStore";

export function SignInModal() {
  const signInOpen = useAuthUiStore((s) => s.signInOpen);
  const signInMode = useAuthUiStore((s) => s.signInMode);
  const signInEmailFormOpen = useAuthUiStore((s) => s.signInEmailFormOpen);
  const authBanner = useAuthUiStore((s) => s.authBanner);
  const closeSignIn = useAuthUiStore((s) => s.closeSignIn);
  const clearAuthBanner = useAuthUiStore((s) => s.clearAuthBanner);
  const [emailFormOpen, setEmailFormOpen] = useState(false);

  useEffect(() => {
    if (!signInOpen) {
      setEmailFormOpen(false);
      return;
    }
    setEmailFormOpen(signInEmailFormOpen);
  }, [signInOpen, signInEmailFormOpen]);

  const isSignUp = signInMode === "sign-up";
  const titleId = "auth-modal-title";
  const showEmailForm = emailFormOpen;

  function handleClose() {
    setEmailFormOpen(false);
    closeSignIn();
  }

  function handleOpenEmail() {
    clearAuthBanner();
    setEmailFormOpen(true);
  }

  return (
    <AuthModalShell open={signInOpen} onClose={handleClose} titleId={titleId} maxWidthClass="max-w-sm">
      <div className="px-6 pb-[max(1.25rem,env(safe-area-inset-bottom,0px))] pt-6 sm:px-7 sm:pb-7">
        <h2 id={titleId} className="text-lg font-bold text-white sm:text-xl">
          {showEmailForm
            ? isSignUp
              ? "Create your account"
              : "Sign in with email"
            : isSignUp
              ? "Sign up"
              : "Sign in"}
        </h2>

        {authBanner ? <div className="mt-4"><AuthNoticeBanner banner={authBanner} /></div> : null}

        <div className={authBanner ? "mt-1" : "mt-5"}>
          {showEmailForm ? (
            <EmailAuthForm mode={signInMode} />
          ) : (
            <AuthProviderButtons onEmailClick={handleOpenEmail} />
          )}
        </div>
      </div>
    </AuthModalShell>
  );
}

"use client";

import { useEffect, useState } from "react";
import { AuthModalShell } from "./AuthModalShell";
import { AuthProviderButtons } from "./AuthProviderButtons";
import { AuthNoticeBanner } from "./AuthNoticeBanner";
import { EmailAuthForm } from "./EmailAuthForm";
import { AUTH_MINT_LINK } from "./authUiStyles";
import { useAuthUiStore } from "@/store/authUiStore";

export function SignInModal() {
  const signInOpen = useAuthUiStore((s) => s.signInOpen);
  const signInMode = useAuthUiStore((s) => s.signInMode);
  const signInEmailFormOpen = useAuthUiStore((s) => s.signInEmailFormOpen);
  const authBanner = useAuthUiStore((s) => s.authBanner);
  const closeSignIn = useAuthUiStore((s) => s.closeSignIn);
  const openSignIn = useAuthUiStore((s) => s.openSignIn);
  const openSignUp = useAuthUiStore((s) => s.openSignUp);
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

  function handleBackFromEmail() {
    clearAuthBanner();
    setEmailFormOpen(false);
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
        {!showEmailForm ? (
          <p className="mt-1 text-sm text-gray-500">
            {isSignUp
              ? "Join with Google or email to save watchlists and trade."
              : "Welcome back. Pick how you want to sign in."}
          </p>
        ) : null}

        {authBanner ? <div className="mt-4"><AuthNoticeBanner banner={authBanner} /></div> : null}

        <div className={authBanner ? "mt-1" : "mt-5"}>
          {showEmailForm ? (
            <EmailAuthForm mode={signInMode} onBack={handleBackFromEmail} />
          ) : (
            <AuthProviderButtons onEmailClick={handleOpenEmail} />
          )}
        </div>

        {!showEmailForm ? (
          <p className="mt-5 text-center text-xs text-gray-500">
            {isSignUp ? (
              <>
                Already have an account?{" "}
                <button type="button" onClick={() => openSignIn({ mode: "sign-in" })} className={AUTH_MINT_LINK}>
                  Sign in
                </button>
              </>
            ) : (
              <>
                New to Tokenable?{" "}
                <button type="button" onClick={() => openSignUp()} className={AUTH_MINT_LINK}>
                  Create an account
                </button>
              </>
            )}
          </p>
        ) : null}
      </div>
    </AuthModalShell>
  );
}

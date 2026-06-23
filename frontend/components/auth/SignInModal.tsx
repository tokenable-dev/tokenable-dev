"use client";

import { useEffect, useState } from "react";
import { AuthModalShell } from "./AuthModalShell";
import { AuthProviderButtons } from "./AuthProviderButtons";
import { EmailAuthForm } from "./EmailAuthForm";
import { AUTH_MINT_LINK } from "./authUiStyles";
import { useAuthUiStore } from "@/store/authUiStore";

export function SignInModal() {
  const signInOpen = useAuthUiStore((s) => s.signInOpen);
  const signInMode = useAuthUiStore((s) => s.signInMode);
  const closeSignIn = useAuthUiStore((s) => s.closeSignIn);
  const openSignIn = useAuthUiStore((s) => s.openSignIn);
  const openSignUp = useAuthUiStore((s) => s.openSignUp);
  const [emailFormOpen, setEmailFormOpen] = useState(false);

  useEffect(() => {
    if (!signInOpen) setEmailFormOpen(false);
  }, [signInOpen]);

  useEffect(() => {
    setEmailFormOpen(false);
  }, [signInMode]);

  const isSignUp = signInMode === "sign-up";
  const titleId = "auth-modal-title";

  function handleClose() {
    setEmailFormOpen(false);
    closeSignIn();
  }

  return (
    <AuthModalShell open={signInOpen} onClose={handleClose} titleId={titleId} maxWidthClass="max-w-sm">
      <div className="px-6 pb-[max(1.25rem,env(safe-area-inset-bottom,0px))] pt-6 sm:px-7 sm:pb-7">
        <h2 id={titleId} className="text-lg font-bold text-white sm:text-xl">
          {isSignUp ? "Sign up" : "Sign in"}
        </h2>

        <div className="mt-5">
          {emailFormOpen ? (
            <EmailAuthForm mode={signInMode} onBack={() => setEmailFormOpen(false)} />
          ) : (
            <AuthProviderButtons onEmailClick={() => setEmailFormOpen(true)} />
          )}
        </div>

        {!emailFormOpen ? (
          <p className="mt-5 text-center text-xs text-gray-500">
            {isSignUp ? (
              <>
                Have an account?{" "}
                <button type="button" onClick={() => openSignIn({ mode: "sign-in" })} className={AUTH_MINT_LINK}>
                  Sign in
                </button>
              </>
            ) : (
              <>
                New here?{" "}
                <button type="button" onClick={() => openSignUp()} className={AUTH_MINT_LINK}>
                  Sign up
                </button>
              </>
            )}
          </p>
        ) : null}
      </div>
    </AuthModalShell>
  );
}

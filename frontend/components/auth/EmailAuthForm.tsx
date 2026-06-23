"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AuthModalMode } from "@/store/authUiStore";
import { useAuthUiStore } from "@/store/authUiStore";
import { useAuthStore } from "@/store/authStore";
import { formatAuthError } from "@/lib/auth/formatAuthError";
import {
  loginWithEmail,
  registerWithEmail,
  resendVerificationEmailPublic,
} from "@/lib/auth/emailAuth";
import {
  AUTH_INPUT_CLASS,
  AUTH_MINT_LINK,
  AUTH_PRIMARY_BTN,
} from "./authUiStyles";

function MailIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-7.5a2.25 2.25 0 01-2.25-2.25V6.75m9 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
      />
    </svg>
  );
}

export function EmailAuthForm({
  mode,
  onBack,
}: {
  mode: AuthModalMode;
  onBack: () => void;
}) {
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);
  const closeSignIn = useAuthUiStore((s) => s.closeSignIn);
  const openSignIn = useAuthUiStore((s) => s.openSignIn);
  const consumeReturnTo = useAuthUiStore((s) => s.consumeReturnTo);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signupSentTo, setSignupSentTo] = useState<string | null>(null);
  const [resendPending, setResendPending] = useState(false);
  const [resendOk, setResendOk] = useState(false);
  const [needsVerify, setNeedsVerify] = useState(false);

  const isSignUp = mode === "sign-up";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResendOk(false);
    setNeedsVerify(false);
    setPending(true);
    try {
      if (isSignUp) {
        const result = await registerWithEmail({
          email: email.trim(),
          password,
          name: name.trim() || undefined,
        });
        setSignupSentTo(result.email);
        return;
      }

      const user = await loginWithEmail({ email: email.trim(), password });
      setUser(user);
      closeSignIn();
      const returnTo = consumeReturnTo();
      if (returnTo) router.push(returnTo);
    } catch (err) {
      const msg = formatAuthError(err instanceof Error ? err.message : "Error");
      setError(msg);
      setNeedsVerify(msg === "Verify your email first.");
    } finally {
      setPending(false);
    }
  }

  async function handleResend(target?: string) {
    const to = target ?? signupSentTo ?? email.trim();
    if (!to) return;
    setResendPending(true);
    setError(null);
    try {
      await resendVerificationEmailPublic(to);
      setResendOk(true);
    } catch (err) {
      setError(formatAuthError(err instanceof Error ? err.message : "Failed"));
    } finally {
      setResendPending(false);
    }
  }

  if (signupSentTo) {
    return (
      <div className="space-y-4 text-center">
        <MailIcon className="mx-auto h-8 w-8 text-mint" />
        <p className="text-sm text-gray-300">Check your inbox</p>
        <p className="truncate text-xs text-gray-500">{signupSentTo}</p>
        {error ? (
          <p className="text-sm text-red-400" role="alert">
            {error}
          </p>
        ) : null}
        {resendOk ? <p className="text-xs text-mint">Sent</p> : null}
        <button
          type="button"
          disabled={resendPending}
          onClick={() => void handleResend()}
          className={`${AUTH_MINT_LINK} disabled:opacity-50`}
        >
          Resend
        </button>
        <button
          type="button"
          onClick={() => {
            setSignupSentTo(null);
            openSignIn({ mode: "sign-in" });
          }}
          className="block w-full text-xs text-gray-500 hover:text-gray-300"
        >
          Sign in
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-3">
      <button
        type="button"
        onClick={onBack}
        className="mb-0.5 flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      {isSignUp ? (
        <input
          id="auth-name"
          type="text"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={AUTH_INPUT_CLASS}
          placeholder="Name (optional)"
        />
      ) : null}

      <input
        id="auth-email"
        type="email"
        required
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className={AUTH_INPUT_CLASS}
        placeholder="Email"
      />

      <input
        id="auth-password"
        type="password"
        required
        minLength={isSignUp ? 8 : 1}
        autoComplete={isSignUp ? "new-password" : "current-password"}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className={AUTH_INPUT_CLASS}
        placeholder={isSignUp ? "Password (8+)" : "Password"}
      />

      {error ? (
        <p className="text-center text-sm text-red-400" role="alert">
          {error}
        </p>
      ) : null}

      {needsVerify ? (
        <button
          type="button"
          disabled={resendPending}
          onClick={() => void handleResend()}
          className={`${AUTH_MINT_LINK} w-full text-center disabled:opacity-50`}
        >
          Resend verification
        </button>
      ) : null}

      <button type="submit" disabled={pending} className={AUTH_PRIMARY_BTN}>
        {pending ? "…" : isSignUp ? "Create account" : "Sign in"}
      </button>
    </form>
  );
}

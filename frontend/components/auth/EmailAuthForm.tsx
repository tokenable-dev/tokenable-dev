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
  requestPasswordReset,
  resendVerificationEmailPublic,
} from "@/lib/auth/emailAuth";
import {
  AUTH_INPUT_CLASS,
  AUTH_MINT_LINK,
  AUTH_PRIMARY_BTN,
} from "./authUiStyles";


function FieldLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-medium text-gray-400">
      {children}
    </label>
  );
}

export function EmailAuthForm({ mode }: { mode: AuthModalMode }) {
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);
  const closeSignIn = useAuthUiStore((s) => s.closeSignIn);
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
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

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
      const msg = formatAuthError(err instanceof Error ? err.message : "Something went wrong.");
      setError(msg);
      setNeedsVerify(msg === "Please verify your email before signing in.");
    } finally {
      setPending(false);
    }
  }

  async function handleResend(target?: string) {
    const to = target ?? signupSentTo ?? email.trim();
    if (!to) return;
    setResendPending(true);
    setError(null);
    setResendOk(false);
    try {
      await resendVerificationEmailPublic(to);
      setResendOk(true);
    } catch (err) {
      setError(formatAuthError(err instanceof Error ? err.message : "Could not resend email."));
    } finally {
      setResendPending(false);
    }
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    const to = email.trim();
    if (!to) return;
    setPending(true);
    setError(null);
    try {
      await requestPasswordReset(to);
      setForgotSent(true);
    } catch (err) {
      setError(formatAuthError(err instanceof Error ? err.message : "Could not send email."));
    } finally {
      setPending(false);
    }
  }

  if (forgotSent) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm font-medium text-white">Check your inbox</p>
        <p className="truncate text-sm text-gray-400" title={email.trim()}>
          {email.trim()}
        </p>
      </div>
    );
  }

  if (forgotOpen) {
    return (
      <form onSubmit={(e) => void handleForgot(e)} className="space-y-3.5">
        <div>
          <FieldLabel htmlFor="forgot-email">Email</FieldLabel>
          <input
            id="forgot-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={AUTH_INPUT_CLASS}
            placeholder="you@example.com"
          />
        </div>
        {error ? (
          <p className="text-center text-sm text-red-400" role="alert">
            {error}
          </p>
        ) : null}
        <button type="submit" disabled={pending} className={AUTH_PRIMARY_BTN}>
          {pending ? "Sending…" : "Send reset link"}
        </button>
      </form>
    );
  }

  if (signupSentTo) {
    return (
      <div className="space-y-4 text-center">
        <p className="truncate text-sm font-medium text-white" title={signupSentTo}>
          {signupSentTo}
        </p>

        {error ? (
          <p className="text-sm text-red-400" role="alert">
            {error}
          </p>
        ) : null}

        {resendOk ? (
          <p className="text-sm font-medium text-mint" role="status">
            Verification email sent again.
          </p>
        ) : null}

        <button
          type="button"
          disabled={resendPending}
          onClick={() => void handleResend()}
          className={`${AUTH_MINT_LINK} disabled:opacity-50`}
        >
          {resendPending ? "Sending…" : "Resend verification email"}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-3.5">
      {isSignUp ? (
        <div>
          <FieldLabel htmlFor="auth-name">Name</FieldLabel>
          <input
            id="auth-name"
            type="text"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={AUTH_INPUT_CLASS}
            placeholder="Optional"
          />
        </div>
      ) : null}

      <div>
        <FieldLabel htmlFor="auth-email">Email</FieldLabel>
        <input
          id="auth-email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={AUTH_INPUT_CLASS}
          placeholder="you@example.com"
        />
      </div>

      <div>
        <FieldLabel htmlFor="auth-password">Password</FieldLabel>
        <input
          id="auth-password"
          type="password"
          required
          minLength={isSignUp ? 8 : 1}
          autoComplete={isSignUp ? "new-password" : "current-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={AUTH_INPUT_CLASS}
          placeholder={isSignUp ? "At least 8 characters" : "Your password"}
        />
        {!isSignUp ? (
          <button
            type="button"
            onClick={() => {
              setForgotOpen(true);
              setError(null);
            }}
            className="mt-2 text-xs text-gray-500 transition-colors hover:text-mint"
          >
            Forgot password?
          </button>
        ) : null}
      </div>

      {needsVerify ? (
        <div
          className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-3 text-left"
          role="alert"
        >
          <p className="text-sm font-semibold text-amber-100">Email not verified yet</p>
          <button
            type="button"
            disabled={resendPending}
            onClick={() => void handleResend()}
            className={`${AUTH_MINT_LINK} mt-2 inline-block text-xs disabled:opacity-50`}
          >
            {resendPending ? "Sending…" : "Resend verification email"}
          </button>
        </div>
      ) : null}

      {error && !needsVerify ? (
        <p className="text-center text-sm text-red-400" role="alert">
          {error}
        </p>
      ) : null}

      {resendOk && needsVerify ? (
        <p className="text-center text-sm font-medium text-mint" role="status">
          Verification email sent.
        </p>
      ) : null}

      <button type="submit" disabled={pending} className={AUTH_PRIMARY_BTN}>
        {pending ? "Please wait…" : isSignUp ? "Create account" : "Sign in"}
      </button>
    </form>
  );
}

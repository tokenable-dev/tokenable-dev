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

function FieldLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-medium text-gray-400">
      {children}
    </label>
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
        <p className="text-xs leading-relaxed text-gray-500">
          Email/password accounts get a reset link. Google-only accounts get a sign-in note.
        </p>
        <button
          type="button"
          onClick={() => {
            setForgotSent(false);
            setForgotOpen(false);
          }}
          className={AUTH_MINT_LINK}
        >
          Back to sign in
        </button>
      </div>
    );
  }

  if (forgotOpen) {
    return (
      <form onSubmit={(e) => void handleForgot(e)} className="space-y-3.5">
        <button
          type="button"
          onClick={() => {
            setForgotOpen(false);
            setError(null);
          }}
          className="mb-0.5 flex items-center gap-1 text-xs text-gray-500 transition-colors hover:text-gray-300"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Sign in
        </button>
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
        <div className="rounded-xl border border-mint/25 bg-mint/5 px-4 py-5">
          <MailIcon className="mx-auto h-9 w-9 text-mint" />
          <h3 className="mt-3 text-base font-semibold text-white">Verify your email</h3>
          <p className="mt-2 text-sm leading-relaxed text-gray-400">
            We sent a verification link to
          </p>
          <p className="mt-1 truncate text-sm font-medium text-white" title={signupSentTo}>
            {signupSentTo}
          </p>
          <p className="mt-3 text-xs leading-relaxed text-gray-500">
            Open the link in that email to activate your account. Check spam if you do not see it
            within a few minutes.
          </p>
        </div>

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

        <button
          type="button"
          onClick={() => {
            setSignupSentTo(null);
            openSignIn({ mode: "sign-in", openEmailForm: true });
          }}
          className="block w-full text-xs text-gray-500 transition-colors hover:text-gray-300"
        >
          Already verified? Sign in
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-3.5">
      <button
        type="button"
        onClick={onBack}
        className="mb-0.5 flex items-center gap-1 text-xs text-gray-500 transition-colors hover:text-gray-300"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        All sign-in options
      </button>

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
        {isSignUp ? (
          <p className="mt-1.5 text-xs text-gray-500">Use 8 or more characters.</p>
        ) : (
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
        )}
      </div>

      {needsVerify ? (
        <div
          className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-3 text-left"
          role="alert"
        >
          <p className="text-sm font-semibold text-amber-100">Email not verified yet</p>
          <p className="mt-0.5 text-xs leading-relaxed text-amber-200/80">
            Confirm your email using the link we sent, then sign in again.
          </p>
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
          Verification email sent. Check your inbox.
        </p>
      ) : null}

      <button type="submit" disabled={pending} className={AUTH_PRIMARY_BTN}>
        {pending ? "Please wait…" : isSignUp ? "Create account" : "Sign in"}
      </button>

      {isSignUp ? (
        <p className="text-center text-xs leading-relaxed text-gray-500">
          By creating an account, you agree to receive a one-time verification email.
        </p>
      ) : null}
    </form>
  );
}

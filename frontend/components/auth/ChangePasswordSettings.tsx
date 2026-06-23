"use client";

import { useState } from "react";
import { AuthModalShell } from "./AuthModalShell";
import { formatAuthError } from "@/lib/auth/formatAuthError";
import { changePassword } from "@/lib/auth/emailAuth";
import { sendVerificationEmail } from "@/lib/auth";
import { useAuthStore } from "@/store/authStore";
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

export function ChangePasswordModal({
  open,
  onClose,
  emailVerified,
}: {
  open: boolean;
  onClose: () => void;
  emailVerified: boolean;
}) {
  const refresh = useAuthStore((s) => s.refresh);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [resendPending, setResendPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [resendOk, setResendOk] = useState(false);

  function handleClose() {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setError(null);
    setOk(false);
    setResendOk(false);
    onClose();
  }

  async function handleResend() {
    setResendPending(true);
    setError(null);
    setResendOk(false);
    try {
      await sendVerificationEmail();
      await refresh();
      setResendOk(true);
    } catch (err) {
      setError(formatAuthError(err instanceof Error ? err.message : "Could not resend email."));
    } finally {
      setResendPending(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(false);
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setPending(true);
    try {
      await changePassword({ currentPassword, newPassword });
      setOk(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(formatAuthError(err instanceof Error ? err.message : "Could not update password."));
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthModalShell open={open} onClose={handleClose} titleId="change-password-title" maxWidthClass="max-w-sm">
      <div className="px-6 pb-[max(1.25rem,env(safe-area-inset-bottom,0px))] pt-6 sm:px-7 sm:pb-7">
        <h2 id="change-password-title" className="text-lg font-bold text-white">
          {emailVerified ? "Change password" : "Verify email first"}
        </h2>

        {!emailVerified ? (
          <div className="mt-5 space-y-4">
            <p className="text-sm leading-relaxed text-gray-400">
              Confirm your email before changing your password.
            </p>
            {error ? (
              <p className="text-sm text-red-400" role="alert">
                {error}
              </p>
            ) : null}
            {resendOk ? (
              <p className="text-sm font-medium text-mint" role="status">
                Verification email sent.
              </p>
            ) : null}
            <button
              type="button"
              disabled={resendPending}
              onClick={() => void handleResend()}
              className={`${AUTH_PRIMARY_BTN} disabled:opacity-50`}
            >
              {resendPending ? "Sending…" : "Resend verification email"}
            </button>
            <button type="button" onClick={handleClose} className={`${AUTH_MINT_LINK} block w-full text-center`}>
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={(e) => void onSubmit(e)} className="mt-5 space-y-3.5">
            <div>
              <FieldLabel htmlFor="modal-current-password">Current</FieldLabel>
              <input
                id="modal-current-password"
                type="password"
                required
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className={AUTH_INPUT_CLASS}
              />
            </div>
            <div>
              <FieldLabel htmlFor="modal-new-password">New</FieldLabel>
              <input
                id="modal-new-password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={AUTH_INPUT_CLASS}
              />
            </div>
            <div>
              <FieldLabel htmlFor="modal-confirm-password">Confirm</FieldLabel>
              <input
                id="modal-confirm-password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={AUTH_INPUT_CLASS}
              />
            </div>
            {error ? (
              <p className="text-sm text-red-400" role="alert">
                {error}
              </p>
            ) : null}
            {ok ? (
              <p className="text-sm font-medium text-mint" role="status">
                Password updated.
              </p>
            ) : null}
            <button type="submit" disabled={pending} className={AUTH_PRIMARY_BTN}>
              {pending ? "Saving…" : "Update password"}
            </button>
            {ok ? (
              <button type="button" onClick={handleClose} className={`${AUTH_MINT_LINK} block w-full text-center`}>
                Done
              </button>
            ) : null}
          </form>
        )}
      </div>
    </AuthModalShell>
  );
}

export function ChangePasswordSettingsRow({
  emailVerified,
}: {
  emailVerified: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <section className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-gray-800 bg-gray-900/30 px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-white">Password</h2>
          {!emailVerified ? (
            <p className="mt-1 text-xs text-gray-500">Email verification required</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="shrink-0 rounded-lg border border-gray-700 px-3 py-2 text-xs font-semibold text-white transition-colors hover:border-mint/35 hover:text-mint"
        >
          Change password
        </button>
      </section>
      <ChangePasswordModal
        open={open}
        onClose={() => setOpen(false)}
        emailVerified={emailVerified}
      />
    </>
  );
}

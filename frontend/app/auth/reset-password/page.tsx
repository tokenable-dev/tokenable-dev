"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { formatAuthError } from "@/lib/auth/formatAuthError";
import { resetPasswordWithToken } from "@/lib/auth/emailAuth";
import { useAuthStore } from "@/store/authStore";
import {
  AUTH_INPUT_CLASS,
  AUTH_MINT_LINK,
  AUTH_PRIMARY_BTN,
} from "@/components/auth/authUiStyles";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setUser = useAuthStore((s) => s.setUser);
  const token = searchParams.get("token")?.trim() ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (!token) {
    return (
      <div className="text-center">
        <p className="text-sm text-red-400">Invalid reset link.</p>
        <button
          type="button"
          onClick={() => router.replace("/")}
          className={`${AUTH_MINT_LINK} mt-4`}
        >
          Home
        </button>
      </div>
    );
  }

  if (done) {
    return (
      <div className="text-center">
        <p className="text-sm font-medium text-white">Password updated.</p>
        <button
          type="button"
          onClick={() => router.replace("/")}
          className={`${AUTH_MINT_LINK} mt-4`}
        >
          Continue
        </button>
      </div>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setPending(true);
    try {
      const user = await resetPasswordWithToken({ token, password });
      setUser(user);
      setDone(true);
    } catch (err) {
      setError(formatAuthError(err instanceof Error ? err.message : "Failed"));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
      <div>
        <label htmlFor="new-password" className="mb-1.5 block text-xs font-medium text-gray-400">
          New password
        </label>
        <input
          id="new-password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={AUTH_INPUT_CLASS}
        />
      </div>
      <div>
        <label htmlFor="confirm-password" className="mb-1.5 block text-xs font-medium text-gray-400">
          Confirm
        </label>
        <input
          id="confirm-password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className={AUTH_INPUT_CLASS}
        />
      </div>
      {error ? (
        <p className="text-center text-sm text-red-400" role="alert">
          {error}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className={AUTH_PRIMARY_BTN}>
        {pending ? "Saving…" : "Update password"}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-black px-4 py-10">
      <div className="w-full max-w-sm rounded-2xl border border-gray-800 bg-gray-950 p-6 sm:p-7">
        <h1 className="text-lg font-bold text-white">New password</h1>
        <div className="mt-5">
          <Suspense
            fallback={
              <span className="mx-auto block h-5 w-5 animate-spin rounded-full border-2 border-mint/30 border-t-mint" />
            }
          >
            <ResetPasswordForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

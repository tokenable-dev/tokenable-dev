"use client";

import { useState } from "react";
import { AUTH_INPUT_CLASS, AUTH_PRIMARY_BTN } from "@/components/auth/authUiStyles";

export function MarketplaceAdminLoginForm({
  onLogin,
}: {
  onLogin: (input: { username: string; password: string }) => Promise<unknown>;
}) {
  const [username, setUsername] = useState("skyand");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await onLogin({ username: username.trim(), password });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black px-4">
      <form onSubmit={(e) => void handleSubmit(e)} className="w-full max-w-sm space-y-4">
        <h1 className="text-center text-2xl font-bold text-white sm:text-3xl">Admin</h1>

        <div>
          <label htmlFor="admin-username" className="mb-1.5 block text-xs font-medium text-zinc-400">
            ID
          </label>
          <input
            id="admin-username"
            type="text"
            autoComplete="username"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className={AUTH_INPUT_CLASS}
          />
        </div>

        <div>
          <label htmlFor="admin-password" className="mb-1.5 block text-xs font-medium text-zinc-400">
            Password
          </label>
          <input
            id="admin-password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={AUTH_INPUT_CLASS}
          />
        </div>

        {error ? (
          <p className="text-sm text-red-400" role="alert">
            {error}
          </p>
        ) : null}

        <button type="submit" disabled={pending} className={AUTH_PRIMARY_BTN}>
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}

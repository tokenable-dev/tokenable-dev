"use client";

import { useState } from "react";
import {
  ADMIN_ARTICLE,
  ADMIN_BTN_PRIMARY,
  ADMIN_INPUT,
  ADMIN_LABEL,
  ADMIN_SHELL_BG,
} from "./adminUi";

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
    <div
      className={`admin-console flex min-h-screen items-center justify-center px-4 py-8 ${ADMIN_SHELL_BG}`}
    >
      <form
        onSubmit={(e) => void handleSubmit(e)}
        className={`admin-login-card ${ADMIN_ARTICLE} w-full max-w-sm space-y-4`}
      >
        <div className="text-center">
          <h1 className="text-xl font-semibold text-zinc-900">Admin sign in</h1>
          <p className="mt-1 text-sm text-zinc-700">Tokenable backoffice</p>
        </div>

        <div>
          <label htmlFor="admin-username" className={ADMIN_LABEL}>
            ID
          </label>
          <input
            id="admin-username"
            type="text"
            autoComplete="username"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className={ADMIN_INPUT}
          />
        </div>

        <div>
          <label htmlFor="admin-password" className={ADMIN_LABEL}>
            Password
          </label>
          <input
            id="admin-password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={ADMIN_INPUT}
          />
        </div>

        {error ? (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}

        <button type="submit" disabled={pending} className={`${ADMIN_BTN_PRIMARY} w-full`}>
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}

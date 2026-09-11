"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { TkButton, TkField, TkInput } from "@/components/ds";

export function SiteAccessClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const nextPath = sanitizeNextPath(searchParams.get("next"));

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);

    try {
      const res = await fetch("/site-access/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password }),
      });

      if (!res.ok) {
        setError(
          res.status === 401
            ? "Incorrect password."
            : "Unable to verify access. Please try again.",
        );
        return;
      }

      router.replace(nextPath);
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="secondary-page secondary-page--full secondary-page--centered px-4 py-10">
      <div className="secondary-gate-card">
        <h1 className="secondary-gate-card__title">Site access</h1>
        <p className="secondary-gate-card__text">Password required. Access lasts 1 hour.</p>

        <form className="secondary-gate-form" onSubmit={onSubmit}>
          <TkField label="Password" htmlFor="site-access-password">
            <TkInput
              id="site-access-password"
              type="password"
              name="password"
              autoComplete="current-password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              disabled={pending}
              hasError={error != null}
            />
          </TkField>

          {error ? (
            <p className="secondary-gate-error" role="alert">
              {error}
            </p>
          ) : null}

          <TkButton
            type="submit"
            variant="primary"
            className="w-full justify-center"
            disabled={pending || password.length === 0}
          >
            {pending ? "Checking…" : "Continue"}
          </TkButton>
        </form>
      </div>
    </div>
  );
}

function sanitizeNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/";
  if (raw.startsWith("/site-access")) return "/";
  return raw;
}

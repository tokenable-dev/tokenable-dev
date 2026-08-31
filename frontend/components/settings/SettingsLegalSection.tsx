"use client";

import { useEffect, useRef, useState } from "react";
import type { AuthUser } from "@/lib/auth";
import { updateAuthProfile } from "@/lib/auth";
import { cn } from "@/lib/ds/cn";
import { useAuthStore } from "@/store/authStore";
import { SettingsBtn } from "./SettingsBtn";

const AGREEMENTS = [
  "Seller Agreement",
  "Terms of Use",
  "Privacy Policy",
] as const;

export function SettingsLegalSection({ user }: { user: AuthUser }) {
  const setUser = useAuthStore((s) => s.setUser);
  const [marketingOn, setMarketingOn] = useState(user.marketingEmailsOptIn ?? false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<boolean | null>(null);
  const setUserRef = useRef(setUser);
  setUserRef.current = setUser;

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      const next = pending.current;
      pending.current = null;
      if (next === null) return;
      void updateAuthProfile({ marketingEmailsOptIn: next })
        .then((u) => setUserRef.current(u))
        .catch(() => undefined);
    };
  }, []);

  function toggleMarketing() {
    const next = !marketingOn;
    setMarketingOn(next);
    pending.current = next;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const value = pending.current;
      pending.current = null;
      if (value === null) return;
      void updateAuthProfile({ marketingEmailsOptIn: value })
        .then((u) => {
          setUser(u);
          setError(null);
        })
        .catch((e) => {
          setMarketingOn(!value);
          setError(e instanceof Error ? e.message : "Could not save preference.");
        });
    }, 250);
  }

  return (
    <section className="tk-settings__sec tk-settings__sec--legal">
      <h1 className="tk-settings__sec-h">Legal and consents</h1>
      <p className="tk-settings__sec-sub">
        Manage your agreements and communication preferences.
      </p>

      <div className="tk-settings__card">
        <div className="tk-settings__row">
          <div>
            <div className="tk-settings__row-t">Marketing emails</div>
            <div className="tk-settings__row-d">
              Product news and drops. Opt out anytime.
            </div>
          </div>
          <button
            type="button"
            className={cn("tk-settings__sw", marketingOn && "on")}
            aria-label="Marketing emails"
            aria-pressed={marketingOn}
            onClick={toggleMarketing}
          />
        </div>
      </div>

      <div className="tk-settings__card">
        <div className="tk-settings__lbl" style={{ marginBottom: 4 }}>
          Agreements
        </div>
        {AGREEMENTS.map((title) => (
          <div key={title} className="tk-settings__row">
            <div className="tk-settings__row-t">{title}</div>
            <SettingsBtn
              variant="ghost"
              size="sm"
              onClick={() =>
                setHint(
                  `${title} document pages are coming soon. Seller terms are shown in the sell flow today.`,
                )
              }
            >
              Coming soon
            </SettingsBtn>
          </div>
        ))}
      </div>

      <div className="tk-settings__card">
        <div className="tk-settings__lbl" style={{ marginBottom: 12 }}>
          Consent history
        </div>
        <p className="text-sm leading-relaxed text-[var(--t2)]">
          A permanent consent audit log is coming soon. Seller terms are accepted again each time
          you list through the sell flow.
        </p>
      </div>

      {error || hint ? (
        <p className="mt-3 text-xs text-[var(--warn)]" role="status">
          {error ?? hint}
        </p>
      ) : null}
    </section>
  );
}

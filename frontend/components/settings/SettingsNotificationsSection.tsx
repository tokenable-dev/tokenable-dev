"use client";

import { useEffect, useRef, useState } from "react";
import type { AuthUser, EmailNotifPrefs } from "@/lib/auth";
import { updateAuthProfile } from "@/lib/auth";
import { cn } from "@/lib/ds/cn";
import { useAuthStore } from "@/store/authStore";
import { SettingsBtn } from "./SettingsBtn";

type Channel = "telegram" | "push" | "email";
type Category = keyof EmailNotifPrefs;

const CATEGORIES: { id: Category; label: string }[] = [
  { id: "trades", label: "Trades" },
  { id: "bids", label: "Bids" },
  { id: "price", label: "Price alerts" },
  { id: "vault", label: "Vault" },
];

const DEFAULT_PREFS: EmailNotifPrefs = {
  trades: true,
  bids: true,
  price: true,
  vault: true,
};

function CheckIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

type PendingSave = { emailOn: boolean; prefs: EmailNotifPrefs };

export function SettingsNotificationsSection({ user }: { user: AuthUser }) {
  const setUser = useAuthStore((s) => s.setUser);
  const [emailOn, setEmailOn] = useState(user.emailNotificationsEnabled ?? true);
  const [prefs, setPrefs] = useState<EmailNotifPrefs>({
    ...DEFAULT_PREFS,
    ...user.emailNotifPrefs,
  });
  const [pushEnabled, setPushEnabled] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<PendingSave | null>(null);
  const saveChain = useRef(Promise.resolve());
  const committed = useRef({
    emailOn: user.emailNotificationsEnabled ?? true,
    prefs: { ...DEFAULT_PREFS, ...user.emailNotifPrefs },
  });
  const setUserRef = useRef(setUser);
  setUserRef.current = setUser;

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    setPushEnabled(Notification.permission === "granted");
  }, []);

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      const payload = pending.current;
      pending.current = null;
      if (!payload) return;
      // Flush so a quick section switch does not discard the last toggle.
      void updateAuthProfile({
        emailNotificationsEnabled: payload.emailOn,
        emailNotifPrefs: payload.prefs,
      })
        .then((u) => setUserRef.current(u))
        .catch(() => undefined);
    };
  }, []);

  function persist(next: PendingSave) {
    saveChain.current = saveChain.current.then(async () => {
      // Capture after prior saves so a failed follow-up does not wipe a success.
      const previous = committed.current;
      try {
        const u = await updateAuthProfile({
          emailNotificationsEnabled: next.emailOn,
          emailNotifPrefs: next.prefs,
        });
        committed.current = {
          emailOn: u.emailNotificationsEnabled ?? next.emailOn,
          prefs: { ...DEFAULT_PREFS, ...u.emailNotifPrefs },
        };
        setUser(u);
        setSaveError(null);
      } catch (e) {
        setEmailOn(previous.emailOn);
        setPrefs(previous.prefs);
        setSaveError(e instanceof Error ? e.message : "Could not save preferences.");
      }
    });
  }

  function scheduleSave(next: PendingSave) {
    pending.current = next;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const payload = pending.current;
      pending.current = null;
      if (payload) persist(payload);
    }, 350);
  }

  function toggleEmailMaster() {
    const nextOn = !emailOn;
    setEmailOn(nextOn);
    scheduleSave({ emailOn: nextOn, prefs });
  }

  function toggleEmailCategory(cat: Category) {
    if (!emailOn) return;
    const nextPrefs = { ...prefs, [cat]: !prefs[cat] };
    setPrefs(nextPrefs);
    scheduleSave({ emailOn, prefs: nextPrefs });
  }

  return (
    <section className="tk-settings__sec">
      <h1 className="tk-settings__sec-h">Notifications</h1>
      <p className="tk-settings__sec-sub">Choose how Tokenable reaches you.</p>

      <div className="tk-settings__banner tk-settings__banner--info">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="mt-px shrink-0"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
        <span>
          Email preferences are saved to your account. Telegram and server push delivery are not
          connected yet — in-app inbox still shows all activity.
        </span>
      </div>

      <div className="tk-settings__card">
        <div className="tk-settings__row">
          <div className="flex items-center gap-3">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="var(--brand-400)">
              <path d="M21.9 4.3 18.6 19.8c-.2 1-.9 1.3-1.8.8l-4.9-3.6-2.4 2.3c-.3.3-.5.5-1 .5l.3-4.9 9-8.1c.4-.3-.1-.5-.6-.2L6.1 13 1.3 11.5c-1-.3-1-1 .2-1.5L20.6 2.8c.9-.3 1.6.2 1.3 1.5z" />
            </svg>
            <div>
              <div className="tk-settings__row-t">Telegram</div>
              <div className="tk-settings__row-d">Real-time alerts via our Telegram bot.</div>
            </div>
          </div>
          <SettingsBtn
            variant="ghost"
            size="sm"
            onClick={() => setHint("Telegram bot linking is coming soon.")}
          >
            Coming soon
          </SettingsBtn>
        </div>

        <div className="tk-settings__row">
          <div className="flex items-center gap-3">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--t2)" strokeWidth="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            <div>
              <div className="tk-settings__row-t">Web push</div>
              <div className="tk-settings__row-d">
                Browser permission on this device only. Server push delivery is not wired yet.
              </div>
            </div>
          </div>
          <SettingsBtn
            variant="ghost"
            size="sm"
            style={
              pushEnabled
                ? { color: "var(--pos)", boxShadow: "inset 0 0 0 1px rgba(0,200,100,0.4)" }
                : undefined
            }
            onClick={() => {
              if (typeof window !== "undefined" && "Notification" in window) {
                void Notification.requestPermission().then((perm) => {
                  setPushEnabled(perm === "granted");
                  if (perm !== "granted") {
                    setHint("Browser blocked notifications for this site.");
                  }
                });
                return;
              }
              setHint("This browser does not support web notifications.");
            }}
          >
            {pushEnabled ? "Allowed" : "Allow"}
          </SettingsBtn>
        </div>

        <div className="tk-settings__row">
          <div className="flex items-center gap-3">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--t2)" strokeWidth="2">
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <path d="m22 7-10 5L2 7" />
            </svg>
            <div>
              <div className="tk-settings__row-t">Email</div>
              <div className="tk-settings__row-d">{user.email}</div>
            </div>
          </div>
          <button
            type="button"
            className={cn("tk-settings__sw", emailOn && "on")}
            aria-label="Email notifications"
            aria-pressed={emailOn}
            onClick={toggleEmailMaster}
          />
        </div>
      </div>

      <div className="tk-settings__card">
        <div className="tk-settings__lbl" style={{ marginBottom: 6 }}>
          Email categories
        </div>
        <div className="tk-settings__matrix-wrap">
          <table className="tk-settings__matrix">
            <thead>
              <tr>
                <th>Category</th>
                <th>Telegram</th>
                <th>Web push</th>
                <th>Email</th>
              </tr>
            </thead>
            <tbody>
              {CATEGORIES.map((cat) => (
                <tr key={cat.id}>
                  <td>{cat.label}</td>
                  {(["telegram", "push", "email"] as Channel[]).map((ch) => {
                    if (ch !== "email") {
                      return (
                        <td key={ch}>
                          <button
                            type="button"
                            className="tk-settings__cbx"
                            aria-label={`${cat.label} ${ch} (coming soon)`}
                            aria-pressed={false}
                            disabled
                            title="Coming soon"
                          >
                            <CheckIcon />
                          </button>
                        </td>
                      );
                    }
                    const on = emailOn && prefs[cat.id];
                    return (
                      <td key={ch}>
                        <button
                          type="button"
                          className={cn("tk-settings__cbx", on && "on")}
                          aria-label={`${cat.label} email`}
                          aria-pressed={on}
                          disabled={!emailOn}
                          onClick={() => toggleEmailCategory(cat.id)}
                        >
                          <CheckIcon />
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {saveError || hint ? (
        <p className="text-xs text-[var(--warn)]" role="status">
          {saveError ?? hint}
        </p>
      ) : null}
    </section>
  );
}

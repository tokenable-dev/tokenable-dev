"use client";

import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { TkButton, TkDialog, TkField, TkInput } from "@/components/ds";
import { updateAuthProfile } from "@/lib/auth/auth";
import { getPrimaryWalletAddress } from "@/lib/auth/wallets";
import { isWalletOnlyPlaceholderEmail } from "@/lib/auth/walletOnlyEmail";
import { completeKbwPostLoginRedirect } from "@/lib/event/kbwEventLoginRouting";
import { useSiteAccessAllowsAppModals } from "@/hooks/site-access/useSiteAccessAllowsAppModals";
import { useAuthStore } from "@/store/authStore";
import { useAuthUiStore } from "@/store/authUiStore";
import "@/styles/tokenable-add-email.css";

function deferKey(userId: string) {
  return `tk_add_email_deferred:${userId}`;
}

function readDeferred(userId: string): boolean {
  try {
    return sessionStorage.getItem(deferKey(userId)) === "1";
  } catch {
    return false;
  }
}

function writeDeferred(userId: string, deferred: boolean) {
  try {
    if (deferred) sessionStorage.setItem(deferKey(userId), "1");
    else sessionStorage.removeItem(deferKey(userId));
  } catch {
    /* ignore */
  }
}

function EmailIcon() {
  return (
    <span className="tk-add-email__icon" aria-hidden>
      <svg viewBox="0 0 24 24" width={22} height={22} fill="none">
        <rect
          x="3"
          y="5"
          width="18"
          height="14"
          rx="2.5"
          stroke="#9B7BFF"
          strokeWidth="1.75"
        />
        <path
          d="M4.5 7.5L12 13l7.5-5.5"
          stroke="#9B7BFF"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * After MetaMask / wallet-only Privy login, collect a real contact email when
 * the account still has the `@privy.wallet` placeholder.
 */
export function AddEmailRequiredModal() {
  const router = useRouter();
  const siteAccessAllowsModals = useSiteAccessAllowsAppModals();
  const user = useAuthStore((s) => s.user);
  const initialized = useAuthStore((s) => s.initialized);
  const privySessionSyncing = useAuthStore((s) => s.privySessionSyncing);
  const setUser = useAuthStore((s) => s.setUser);

  const inputId = useId();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deferred, setDeferred] = useState(false);

  const needsEmail =
    Boolean(user) && isWalletOnlyPlaceholderEmail(user?.email);

  useEffect(() => {
    if (!user?.id) {
      setDeferred(false);
      return;
    }
    setDeferred(readDeferred(user.id));
  }, [user?.id]);

  useEffect(() => {
    if (!needsEmail) {
      setEmail("");
      setError(null);
      setSaving(false);
    }
  }, [needsEmail]);

  const open =
    siteAccessAllowsModals &&
    initialized &&
    !privySessionSyncing &&
    needsEmail &&
    !deferred &&
    Boolean(user);

  function dismiss() {
    if (!user?.id) return;
    writeDeferred(user.id, true);
    setDeferred(true);
  }

  async function handleSave() {
    const next = email.trim().toLowerCase();
    if (!EMAIL_RE.test(next)) {
      setError("Enter a valid email address");
      return;
    }
    if (isWalletOnlyPlaceholderEmail(next)) {
      setError("Enter a real email address");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const updated = await updateAuthProfile({ email: next });
      setUser(updated);
      if (user?.id) writeDeferred(user.id, false);
      setDeferred(false);
      setEmail("");
      const ui = useAuthUiStore.getState();
      await completeKbwPostLoginRedirect({
        walletAddress: getPrimaryWalletAddress(updated),
        push: (path) => router.push(path),
        armKbwOffer: () => ui.armKbwOffer(),
        clearKbwOffer: () => ui.clearKbwOffer(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save email");
    } finally {
      setSaving(false);
    }
  }

  const canSave = EMAIL_RE.test(email.trim()) && !saving;

  return (
    <TkDialog
      open={open}
      onClose={dismiss}
      icon={<EmailIcon />}
      title="Add your email"
      description="We send all updates and event notifications by email."
      className="tk-add-email"
      footer={
        <TkButton
          type="button"
          variant="primary"
          className="w-full justify-center"
          disabled={!canSave}
          onClick={() => void handleSave()}
        >
          {saving ? "Saving…" : "Save"}
        </TkButton>
      }
    >
      <TkField
        className="tk-add-email__field"
        label="EMAIL ADDRESS"
        htmlFor={inputId}
        error={error ?? undefined}
      >
        <TkInput
          id={inputId}
          className="tk-add-email__input"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="your@email.com"
          value={email}
          hasError={Boolean(error)}
          disabled={saving}
          onChange={(e) => {
            setEmail(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && canSave) {
              e.preventDefault();
              void handleSave();
            }
          }}
        />
      </TkField>
    </TkDialog>
  );
}

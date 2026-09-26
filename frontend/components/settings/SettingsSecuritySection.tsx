"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TkDialog } from "@/components/ds";
import { deleteAccount } from "@/lib/auth/auth";
import { completeSignOut } from "@/lib/auth/signOut";
import { useAuthStore } from "@/store/authStore";
import { SettingsBtn } from "./SettingsBtn";

export function SettingsSecuritySection() {
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);
  const [signingOut, setSigningOut] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await completeSignOut(logout);
      router.replace("/");
    } finally {
      setSigningOut(false);
    }
  }

  async function handleDelete() {
    setDeleteError(null);
    setDeletePending(true);
    try {
      await deleteAccount();
      // Clear Privy too — otherwise PrivySessionBridge recreates the user via session sync.
      await completeSignOut(logout);
      setDeleteOpen(false);
      router.replace("/");
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Could not delete account.");
    } finally {
      setDeletePending(false);
    }
  }

  return (
    <section className="tk-settings__sec">
      <h1 className="tk-settings__sec-h">Security</h1>
      <p className="tk-settings__sec-sub">
        Protect your account and manage where you&rsquo;re signed in.
      </p>

      <div className="tk-settings__card">
        <div className="tk-settings__row">
          <div>
            <div className="tk-settings__row-t">Two-factor authentication</div>
            <div className="tk-settings__row-d">
              Require a code from your authenticator app or SMS at sign-in.
            </div>
          </div>
          <SettingsBtn
            variant="primary"
            size="sm"
            onClick={() => setHint("2FA setup is coming soon.")}
          >
            Coming soon
          </SettingsBtn>
        </div>
      </div>

      <div className="tk-settings__card">
        <div className="tk-settings__lbl" style={{ marginBottom: 4 }}>
          Active sessions
        </div>
        <div className="tk-settings__row">
          <div>
            <div className="tk-settings__row-t">
              This device
              <span
                className="tk-settings__chip tk-settings__chip--muted"
                style={{ marginLeft: 6 }}
              >
                CURRENT
              </span>
            </div>
            <div className="tk-settings__row-d">
              Multi-device session management is coming soon. Sign out below to end this session.
            </div>
          </div>
        </div>
      </div>

      <div className="tk-settings__card">
        <div className="tk-settings__row">
          <div>
            <div className="tk-settings__row-t">Sign out</div>
            <div className="tk-settings__row-d">
              End your session on this device.
            </div>
          </div>
          <SettingsBtn
            variant="danger"
            size="sm"
            disabled={signingOut}
            onClick={() => void handleSignOut()}
          >
            {signingOut ? "Signing out…" : "Sign out"}
          </SettingsBtn>
        </div>
      </div>

      <div className="tk-settings__card">
        <div className="tk-settings__row">
          <div>
            <div className="tk-settings__row-t" style={{ color: "#FF6B7A" }}>
              Delete account
            </div>
            <div className="tk-settings__row-d">
              Permanently remove your account, watchlist, addresses, and linked wallets.
            </div>
          </div>
          <SettingsBtn variant="danger" size="sm" onClick={() => setDeleteOpen(true)}>
            Delete
          </SettingsBtn>
        </div>
      </div>

      {hint ? (
        <p className="text-xs text-[var(--warn)]" role="status">
          {hint}
        </p>
      ) : null}

      <TkDialog
        open={deleteOpen}
        onClose={() => {
          setDeleteError(null);
          setDeleteOpen(false);
        }}
        title="Delete account"
        description="This permanently removes your account, watchlist, addresses, and linked wallets. This cannot be undone."
        footer={
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-end">
            <SettingsBtn
              variant="ghost"
              size="sm"
              onClick={() => {
                setDeleteError(null);
                setDeleteOpen(false);
              }}
            >
              Cancel
            </SettingsBtn>
            <SettingsBtn
              variant="danger"
              size="sm"
              disabled={deletePending}
              onClick={() => void handleDelete()}
            >
              {deletePending ? "Deleting…" : "Delete account"}
            </SettingsBtn>
          </div>
        }
      >
        {deleteError ? (
          <p className="text-sm text-[var(--neg)]" role="alert">
            {deleteError}
          </p>
        ) : null}
      </TkDialog>
    </section>
  );
}

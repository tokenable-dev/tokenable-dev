"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { TkDialog } from "@/components/ds";
import { deleteAccount } from "@/lib/auth/auth";
import { completeSignOut } from "@/lib/auth";
import { useAuthStore } from "@/store/authStore";
import { SettingsBtn } from "./SettingsBtn";

function describeThisSession(device: string, active: string, browserLabel: string): { title: string; detail: string } {
  if (typeof navigator === "undefined") {
    return { title: device, detail: active };
  }
  const ua = navigator.userAgent;
  let browser = browserLabel;
  if (/Edg\//i.test(ua)) browser = "Edge";
  else if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) browser = "Chrome";
  else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) browser = "Safari";
  else if (/Firefox\//i.test(ua)) browser = "Firefox";

  return { title: device, detail: `${browser} · ${active}` };
}

export function SettingsSecuritySection() {
  const t = useTranslations("Settings");
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);
  const session = useMemo(
    () => describeThisSession(t("ui.thisDevice"), t("ui.activeNow"), t("ui.browser")),
    [t],
  );
  const [signingOut, setSigningOut] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleSignOutEverywhere() {
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
      await completeSignOut(logout);
      setDeleteOpen(false);
      router.replace("/");
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : t("ui.deleteFailed"));
    } finally {
      setDeletePending(false);
    }
  }

  return (
    <section className="tk-settings__sec">
      <h1 className="tk-settings__sec-h">{t("nav.security")}</h1>
      <p className="tk-settings__sec-sub">
        {t("ui.securitySub")}
      </p>

      <div className="tk-settings__card">
        <div className="tk-settings__row">
          <div>
            <div className="tk-settings__row-t">{t("ui.twoFactor")}</div>
            <div className="tk-settings__row-d">{t("ui.twoFactorDesc")}</div>
          </div>
          <SettingsBtn
            variant="primary"
            size="sm"
            onClick={() => setHint(t("ui.twoFactorSoon"))}
          >
            {t("ui.setup2fa")}
          </SettingsBtn>
        </div>
      </div>

      <div className="tk-settings__card">
        <div className="tk-settings__lbl" style={{ marginBottom: 4 }}>
          {t("ui.sessions")}
        </div>
        <div className="tk-settings__row">
          <div>
            <div className="tk-settings__row-t">
              {session.title}
              <span
                className="tk-settings__chip tk-settings__chip--muted"
                style={{ marginLeft: 6 }}
              >
                {t("ui.thisDeviceChip")}
              </span>
            </div>
            <div className="tk-settings__row-d">{session.detail}</div>
          </div>
        </div>
      </div>

      <div className="tk-settings__card">
        <div className="tk-settings__row">
          <div>
            <div className="tk-settings__row-t" style={{ color: "#FF6B7A" }}>
              {t("ui.signOutEverywhere")}
            </div>
            <div className="tk-settings__row-d">
              {t("ui.signOutEverywhereDesc")}
            </div>
          </div>
          <SettingsBtn
            variant="danger"
            size="sm"
            disabled={signingOut}
            onClick={() => void handleSignOutEverywhere()}
          >
            {signingOut ? t("ui.signingOut") : t("ui.signOut")}
          </SettingsBtn>
        </div>
      </div>

      <div className="tk-settings__card">
        <div className="tk-settings__row">
          <div>
            <div className="tk-settings__row-t" style={{ color: "#FF6B7A" }}>
              {t("ui.deleteAccount")}
            </div>
            <div className="tk-settings__row-d">
              {t("ui.deleteAccountDesc")}
            </div>
          </div>
          <SettingsBtn variant="danger" size="sm" onClick={() => setDeleteOpen(true)}>
            {t("ui.delete")}
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
        title={t("ui.deleteAccount")}
        description={t("ui.deleteDialog")}
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
              {t("ui.cancel")}
            </SettingsBtn>
            <SettingsBtn
              variant="danger"
              size="sm"
              disabled={deletePending}
              onClick={() => void handleDelete()}
            >
              {deletePending ? t("ui.deleting") : t("ui.deleteAccount")}
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

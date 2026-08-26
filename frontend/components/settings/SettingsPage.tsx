"use client";

import { useCallback, useEffect, useMemo, useRef, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { AuthUser } from "@/lib/auth";
import { cn } from "@/lib/ds/cn";
import { SettingsAddressesSection } from "./SettingsAddressesSection";
import { SettingsIdentitySection } from "./SettingsIdentitySection";
import { SettingsLegalSection } from "./SettingsLegalSection";
import { SettingsNotificationsSection } from "./SettingsNotificationsSection";
import { SettingsProfileSection } from "./SettingsProfileSection";
import { SettingsSecuritySection } from "./SettingsSecuritySection";
import { SettingsWalletSection } from "./SettingsWalletSection";
import {
  parseSettingsSection,
  type SettingsSectionId,
} from "./settingsSections";

const NAV: {
  id: SettingsSectionId;
  label: string;
  shortLabel: string;
  icon: ReactNode;
}[] = [
  {
    id: "profile",
    label: "Profile",
    shortLabel: "Profile",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
  {
    id: "notifications",
    label: "Notifications",
    shortLabel: "Alerts",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
    ),
  },
  {
    id: "wallet",
    label: "Wallet and balance",
    shortLabel: "Wallet",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <path d="M2 10h20" />
      </svg>
    ),
  },
  {
    id: "addresses",
    label: "Addresses",
    shortLabel: "Address",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 10c0 7-9 12-9 12s-9-5-9-12a9 9 0 0 1 18 0z" />
        <circle cx="12" cy="10" r="3" />
      </svg>
    ),
  },
  {
    id: "identity",
    label: "Identity",
    shortLabel: "Identity",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <circle cx="9" cy="10" r="2" />
        <path d="M13 9h5M13 13h5M5 16c1-2 3-2 4 0" />
      </svg>
    ),
  },
  {
    id: "legal",
    label: "Legal and consents",
    shortLabel: "Legal and consents",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
    ),
  },
  {
    id: "security",
    label: "Security",
    shortLabel: "Security",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="11" width="18" height="11" rx="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    ),
  },
];

export function SettingsPage({ user }: { user: AuthUser }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const snavRef = useRef<HTMLElement | null>(null);
  const section = useMemo(
    () => parseSettingsSection(searchParams?.get("section")),
    [searchParams],
  );

  const selectSection = useCallback(
    (id: SettingsSectionId) => {
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      if (id === "profile") params.delete("section");
      else params.set("section", id);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: true });
      window.scrollTo(0, 0);
    },
    [pathname, router, searchParams],
  );

  // Keep the active chip visible in the horizontal mobile snav.
  useEffect(() => {
    const nav = snavRef.current;
    if (!nav) return;
    const active = nav.querySelector<HTMLElement>(".tk-settings__snav-item.on");
    active?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [section]);

  return (
    <div className="tk-settings">
      <nav
        ref={snavRef}
        className="tk-settings__snav"
        aria-label="Settings sections"
      >
        {NAV.map((item) => (
          <button
            key={item.id}
            type="button"
            className={cn("tk-settings__snav-item", section === item.id && "on")}
            aria-current={section === item.id ? "page" : undefined}
            onClick={() => selectSection(item.id)}
          >
            {item.icon}
            <span className="tk-settings__lbltxt--full">{item.label}</span>
            <span className="tk-settings__lbltxt--short">{item.shortLabel}</span>
          </button>
        ))}
      </nav>

      <div className="tk-settings__main">
        {section === "profile" ? <SettingsProfileSection user={user} /> : null}
        {section === "notifications" ? (
          <SettingsNotificationsSection user={user} />
        ) : null}
        {section === "wallet" ? <SettingsWalletSection user={user} /> : null}
        {section === "addresses" ? (
          <SettingsAddressesSection userId={user.id} />
        ) : null}
        {section === "identity" ? <SettingsIdentitySection user={user} /> : null}
        {section === "legal" ? <SettingsLegalSection user={user} /> : null}
        {section === "security" ? <SettingsSecuritySection /> : null}
      </div>
    </div>
  );
}

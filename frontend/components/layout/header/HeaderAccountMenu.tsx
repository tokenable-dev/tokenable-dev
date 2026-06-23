"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { isKycComplete } from "@/lib/auth/accountAccess";
import { useAccessGate } from "@/hooks/auth/useAccessGate";
import { useAuthStore } from "@/store/authStore";
import { useAuthUiStore } from "@/store/authUiStore";

const ACCOUNT_MENU_LINKS = [
  { label: "Notifications", href: "/profile?section=notifications" },
  { label: "Settings", href: "/profile" },
] as const;

const MENU_PAD_X = "px-6";
/** Header: px-6 + user icon (2.5rem) + gap-3 — align menu labels with email column. */
const MENU_TEXT_INSET = "pl-[4.75rem] pr-6";

function AccountMenuLinkItem({
  label,
  href,
  onNavigate,
  gated = false,
}: {
  label: string;
  href: string;
  onNavigate: () => void;
  gated?: boolean;
}) {
  const { navigateIfAllowed } = useAccessGate(1, href);

  if (gated) {
    return (
      <button
        type="button"
        onClick={() => {
          onNavigate();
          navigateIfAllowed(href);
        }}
        className={`block w-full py-2 text-left text-sm text-gray-300 transition-colors hover:text-white ${MENU_TEXT_INSET}`}
      >
        {label}
      </button>
    );
  }

  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={`block py-2 text-sm text-gray-300 transition-colors hover:text-white ${MENU_TEXT_INSET}`}
    >
      {label}
    </Link>
  );
}

export function HeaderAccountMenu() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    }
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, close]);

  if (!user) return null;

  const username = user.name?.trim() || user.email.split("@")[0];
  const kycVerified = isKycComplete(user);
  const triggerLabel = username;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((p) => !p)}
        className={`flex h-10 max-w-[min(100vw-8rem,14rem)] items-center gap-2 rounded-xl border px-2 sm:max-w-none sm:px-2.5 text-sm transition-colors bg-gray-950/90 ${
          open
            ? "border-gray-700/70"
            : "border-gray-800/60 hover:border-gray-700/70"
        }`}
      >
        {user.pictureUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.pictureUrl}
            alt=""
            className="h-7 w-7 shrink-0 rounded-full border border-gray-700 object-cover"
          />
        ) : (
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-gray-700 bg-gray-800 text-xs font-semibold text-mint">
            {username.charAt(0).toUpperCase()}
          </span>
        )}
        <span className="hidden min-w-0 truncate font-medium text-white sm:block">{triggerLabel}</span>
        <svg
          className={`h-3.5 w-3.5 shrink-0 text-gray-500 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-[60] mt-2 w-72 overflow-hidden rounded-2xl border border-gray-700/60 bg-gray-900/98 shadow-2xl shadow-black/40 backdrop-blur-lg">
          <div className={`border-b border-gray-800/60 ${MENU_PAD_X} py-4`}>
            <div className="flex items-center gap-3">
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-gray-700/80 bg-gray-800/60 text-gray-400"
                aria-hidden
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0"
                  />
                </svg>
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white" title={user.email}>
                  {user.email}
                </p>
                <p className="mt-0.5 text-xs text-gray-400">
                  KYC:{" "}
                  {kycVerified ? (
                    <span className="text-mint">✓ Verified</span>
                  ) : (
                    <span className="text-gray-500">Pending</span>
                  )}
                </p>
              </div>
            </div>
          </div>

          <nav className="py-1.5" aria-label="Account">
            <AccountMenuLinkItem
              label="Portfolio"
              href="/portfolio"
              gated
              onNavigate={close}
            />

            {ACCOUNT_MENU_LINKS.map((item) => (
              <AccountMenuLinkItem
                key={item.label}
                {...item}
                onNavigate={close}
              />
            ))}
          </nav>

          <div className="border-t border-gray-800/60 py-2">
            <button
              type="button"
              onClick={() => {
                close();
                void logout();
              }}
              className={`w-full py-2 text-left text-sm text-gray-400 transition-colors hover:text-white ${MENU_TEXT_INSET}`}
            >
              Sign Out
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function HeaderGuestAuthButtons() {
  const openSignIn = useAuthUiStore((s) => s.openSignIn);
  const openSignUp = useAuthUiStore((s) => s.openSignUp);

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => openSignUp()}
        className="hidden h-10 items-center rounded-xl border border-gray-800/60 bg-gray-950/90 px-3.5 text-sm font-semibold text-gray-300 transition-colors hover:border-gray-700/70 hover:text-white sm:inline-flex"
      >
        Sign up
      </button>
      <button
        type="button"
        onClick={() => openSignIn()}
        className="inline-flex h-10 items-center rounded-xl border border-mint/30 bg-mint/10 px-3.5 text-sm font-semibold text-mint transition-colors hover:bg-mint/15 sm:px-4"
      >
        Sign in
      </button>
      <button
        type="button"
        onClick={() => openSignUp()}
        className="inline-flex h-10 items-center rounded-xl border border-gray-800/60 px-3 text-sm font-semibold text-gray-400 transition-colors hover:border-gray-700/70 hover:text-white sm:hidden"
      >
        Sign up
      </button>
    </div>
  );
}

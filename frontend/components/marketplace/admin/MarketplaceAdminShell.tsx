"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  MarketplaceAdminMobileMenuButton,
  MarketplaceAdminNav,
} from "./MarketplaceAdminNav";
import { AdminNetworkSwitcher } from "./AdminNetworkSwitcher";
import { ADMIN_BTN_GHOST, ADMIN_SHELL_BG } from "./adminUi";

export function MarketplaceAdminShell({
  username,
  onLogout,
  children,
}: {
  username: string;
  onLogout: () => void;
  children: ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!sidebarOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [sidebarOpen]);

  return (
    <div className={`admin-console flex h-dvh min-h-0 overflow-hidden ${ADMIN_SHELL_BG}`}>
      {sidebarOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-zinc-900/40 lg:hidden"
          aria-label="Close menu"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-dvh w-[min(18rem,88vw)] flex-col border-r border-zinc-200 bg-white pt-[env(safe-area-inset-top,0px)] transition-transform duration-200 lg:static lg:z-auto lg:h-full lg:w-64 lg:translate-x-0 lg:pt-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-14 shrink-0 items-center border-b border-zinc-200 px-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-zinc-900">
              Tokenable
            </p>
            <p className="text-xs text-zinc-600">Admin console</p>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]">
          <MarketplaceAdminNav onNavigate={() => setSidebarOpen(false)} />
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-zinc-200 bg-white px-3 pt-[env(safe-area-inset-top,0px)] sm:gap-3 sm:px-6 sm:pt-0">
          <MarketplaceAdminMobileMenuButton
            open={sidebarOpen}
            onClick={() => setSidebarOpen((v) => !v)}
          />
          <p className="min-w-0 truncate text-sm font-medium text-zinc-700 lg:hidden">
            Admin
          </p>
          <div className="ml-auto flex min-w-0 shrink-0 items-center gap-1.5 sm:gap-3">
            <AdminNetworkSwitcher />
            <span className="hidden max-w-[10rem] truncate text-xs text-zinc-600 sm:inline sm:max-w-none sm:text-sm">
              <span className="text-zinc-600">Signed in as </span>
              <span className="font-medium text-zinc-700">{username}</span>
            </span>
            <button
              type="button"
              onClick={onLogout}
              className={`${ADMIN_BTN_GHOST} min-h-11 px-3`}
            >
              Sign out
            </button>
          </div>
        </header>

        <main className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-3 pb-[max(1rem,env(safe-area-inset-bottom,0px))] sm:p-6 lg:p-8">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}

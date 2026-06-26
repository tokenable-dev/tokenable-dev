"use client";

import { useState, type ReactNode } from "react";
import {
  MarketplaceAdminMobileMenuButton,
  MarketplaceAdminNav,
} from "./MarketplaceAdminNav";
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

  return (
    <div className={`flex min-h-screen ${ADMIN_SHELL_BG}`}>
      {sidebarOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-zinc-900/40 lg:hidden"
          aria-label="Close menu"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-zinc-200 bg-white transition-transform duration-200 lg:static lg:z-auto lg:translate-x-0 ${
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
        <div className="flex-1 overflow-y-auto">
          <MarketplaceAdminNav onNavigate={() => setSidebarOpen(false)} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-zinc-200 bg-white px-4 sm:px-6">
          <MarketplaceAdminMobileMenuButton
            open={sidebarOpen}
            onClick={() => setSidebarOpen((v) => !v)}
          />
          <p className="truncate text-sm font-medium text-zinc-700 lg:hidden">
            Admin
          </p>
          <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
            <span className="hidden max-w-[10rem] truncate text-xs text-zinc-600 sm:inline sm:max-w-none sm:text-sm">
              <span className="text-zinc-600">Signed in as </span>
              <span className="font-medium text-zinc-700">{username}</span>
            </span>
            <button
              type="button"
              onClick={onLogout}
              className={ADMIN_BTN_GHOST}
            >
              Sign out
            </button>
          </div>
        </header>

        <main className="min-w-0 flex-1 overflow-x-hidden p-4 sm:p-6 lg:p-8">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}

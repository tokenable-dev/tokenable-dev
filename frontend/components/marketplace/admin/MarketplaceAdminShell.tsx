"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ASSETS } from "@/constants/assets";
import { cn } from "@/lib/ds/cn";
import {
  MarketplaceAdminMobileMenuButton,
  MarketplaceAdminNav,
} from "./MarketplaceAdminNav";
import { AdminNetworkSwitcher } from "./AdminNetworkSwitcher";

function operatorInitials(username: string): string {
  const parts = username.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  return username.slice(0, 2).toUpperCase() || "AD";
}

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
    <div className="admin-console admin-shell">
      {sidebarOpen ? (
        <button
          type="button"
          className="admin-shell__backdrop lg:hidden"
          aria-label="Close menu"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      <aside
        className={cn(
          "admin-sidebar admin-sidebar--drawer",
          !sidebarOpen && "admin-sidebar--closed",
        )}
      >
        <div className="admin-sidebar__brand">
          <img
            src={ASSETS.logo.tokenableDs}
            alt="Tokenable"
            className="admin-sidebar__logo"
          />
          <div className="admin-sidebar__kicker">Admin console</div>
        </div>
        <div className="admin-sidebar__nav-wrap">
          <MarketplaceAdminNav onNavigate={() => setSidebarOpen(false)} />
        </div>
        <div className="admin-sidebar__footer">
          <div className="admin-sidebar__network">
            <AdminNetworkSwitcher />
          </div>
          <div className="admin-sidebar__user">
            <span className="admin-sidebar__avatar" aria-hidden>
              {operatorInitials(username)}
            </span>
            <div className="admin-sidebar__user-meta">
              <div className="admin-sidebar__user-name">{username}</div>
              <div className="admin-sidebar__user-role">Operator</div>
            </div>
          </div>
          <button type="button" onClick={onLogout} className="admin-sidebar__signout">
            Sign out
          </button>
        </div>
      </aside>

      <div className="admin-main">
        <header className="admin-main__mobile">
          <MarketplaceAdminMobileMenuButton
            open={sidebarOpen}
            onClick={() => setSidebarOpen((v) => !v)}
          />
          <p className="admin-main__mobile-title">Admin</p>
        </header>
        <main className="admin-main__body">{children}</main>
      </div>
    </div>
  );
}

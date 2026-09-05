"use client";

import type { ReactNode } from "react";
import { useMarketplaceAdminSession } from "@/hooks/marketplace-admin/useMarketplaceAdminSession";
import { MarketplaceAdminLoginForm } from "./MarketplaceAdminLoginForm";
import { MarketplaceAdminShell } from "./MarketplaceAdminShell";
import { ADMIN_SHELL_BG } from "./adminUi";

export function MarketplaceAdminGate({ children }: { children: ReactNode }) {
  const session = useMarketplaceAdminSession();

  if (session.loading) {
    return (
      <div
        className={`flex min-h-screen items-center justify-center ${ADMIN_SHELL_BG} text-sm text-zinc-700`}
      >
        Loading…
      </div>
    );
  }

  if (!session.authenticated) {
    return <MarketplaceAdminLoginForm onLogin={session.login} />;
  }

  return (
    <MarketplaceAdminShell
      username={session.username ?? "admin"}
      onLogout={() => void session.logout()}
    >
      {children}
    </MarketplaceAdminShell>
  );
}

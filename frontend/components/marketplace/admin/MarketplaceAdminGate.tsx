"use client";

import type { ReactNode } from "react";
import { useMarketplaceAdminSession } from "@/hooks/marketplace-admin/useMarketplaceAdminSession";
import { MarketplaceAdminLoginForm } from "./MarketplaceAdminLoginForm";

export function MarketplaceAdminGate({ children }: { children: ReactNode }) {
  const session = useMarketplaceAdminSession();

  if (session.loading) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black text-sm text-zinc-500">
        Loading…
      </div>
    );
  }

  if (!session.authenticated) {
    return <MarketplaceAdminLoginForm onLogin={session.login} />;
  }

  return (
    <div>
      <div className="border-b border-zinc-800/80 bg-zinc-950/90">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-3 py-2 sm:px-5">
          <p className="text-[11px] text-zinc-500">
            Signed in as <span className="font-medium text-zinc-300">{session.username}</span>
          </p>
          <button
            type="button"
            onClick={() => void session.logout()}
            className="text-[11px] font-semibold text-zinc-400 transition-colors hover:text-white"
          >
            Sign out
          </button>
        </div>
      </div>
      {children}
    </div>
  );
}

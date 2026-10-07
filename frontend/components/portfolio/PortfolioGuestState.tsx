"use client";

import { APP_MAIN_SHELL_CLASS } from "@/constants/layout";
import { TkButton } from "@/components/ds";
import { useAuthUiStore } from "@/store/authUiStore";

export function PortfolioGuestState() {
  const openSignIn = useAuthUiStore((s) => s.openSignIn);

  return (
    <div className="min-h-screen min-w-0 overflow-x-clip bg-black text-white">
      <div
        className={`${APP_MAIN_SHELL_CLASS} flex min-h-[calc(100vh-4rem)] flex-col justify-center py-8 pb-20`}
      >
        <div className="mx-auto flex w-full max-w-md flex-col items-center justify-center">
          <div className="w-full rounded-2xl border border-gray-800/90 bg-gray-900/40 px-6 py-9 text-center sm:px-8 sm:py-10">
            <h2 className="text-lg font-semibold tracking-tight text-white">Sign in</h2>
            <p className="mt-2 text-sm leading-relaxed text-gray-400">
              Sign in to view your portfolio, watchlist, and activity.
            </p>
            <TkButton
              type="button"
              variant="primary"
              className="mt-7 w-full justify-center"
              onClick={() => openSignIn({ returnTo: "/portfolio?tab=assets" })}
            >
              Sign in
            </TkButton>
          </div>
        </div>
      </div>
    </div>
  );
}

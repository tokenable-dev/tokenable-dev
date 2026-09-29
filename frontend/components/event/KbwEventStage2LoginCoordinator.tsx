"use client";

import { useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { getPrimaryWalletAddress } from "@/lib/auth/wallets";
import { isKbwEventActive } from "@/lib/event/kbwEventPeriod";
import {
  isKbwStage2FlowPending,
  tryCompleteKbwStage2AfterLogin,
} from "@/lib/event/kbwEventLoginRouting";
import { pickPrivyUserEthereumWalletAddress } from "@/lib/privy/wallet";
import { useAuthStore } from "@/store/authStore";
import { useAuthUiStore } from "@/store/authUiStore";

/**
 * Desktop MetaMask keeps one tab alive; mobile opens the wallet app and often
 * reloads or restores this page without firing Privy `useLogin.onComplete` again.
 * Re-run session + Stage-2 completion when the tab becomes visible.
 */
export function KbwEventStage2LoginCoordinator() {
  const router = useRouter();
  const { ready, authenticated, user: privyUser } = usePrivy();
  const user = useAuthStore((s) => s.user);
  const initialized = useAuthStore((s) => s.initialized);
  const refresh = useAuthStore((s) => s.refresh);

  const finishStage2IfReady = useCallback(async () => {
    if (!isKbwEventActive() || !isKbwStage2FlowPending()) return;
    if (!ready || !authenticated) return;

    let sessionUser = useAuthStore.getState().user;
    if (!sessionUser) {
      await refresh({ showLoading: false });
      sessionUser = useAuthStore.getState().user;
    }
    if (!sessionUser) return;

    const wallet =
      getPrimaryWalletAddress(sessionUser) ??
      pickPrivyUserEthereumWalletAddress(privyUser) ??
      null;

    const ui = useAuthUiStore.getState();
    await tryCompleteKbwStage2AfterLogin({
      user: sessionUser,
      walletAddress: wallet,
      push: (path) => router.push(path),
      armKbwOffer: () => ui.armKbwOffer(),
      clearKbwOffer: () => ui.clearKbwOffer(),
    });
  }, [ready, authenticated, privyUser, refresh, router]);

  useEffect(() => {
    if (!isKbwEventActive() || !isKbwStage2FlowPending()) return;
    if (!ready || !authenticated) return;
    if (!initialized) return;
    void finishStage2IfReady();
  }, [ready, authenticated, initialized, user?.id, user?.email, finishStage2IfReady]);

  useEffect(() => {
    if (!isKbwEventActive()) return;

    const onReturnToTab = () => {
      if (document.visibilityState !== "visible") return;
      void finishStage2IfReady();
    };

    window.addEventListener("pageshow", onReturnToTab);
    document.addEventListener("visibilitychange", onReturnToTab);
    return () => {
      window.removeEventListener("pageshow", onReturnToTab);
      document.removeEventListener("visibilitychange", onReturnToTab);
    };
  }, [finishStage2IfReady]);

  return null;
}

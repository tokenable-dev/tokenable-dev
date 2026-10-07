"use client";

import { useCallback, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { getPrimaryWalletAddress } from "@/lib/auth/wallets";
import { isKbwEventActive } from "@/lib/event/kbwEventPeriod";
import {
  completeKbwStage2Session,
  isKbwStage2Pending,
} from "@/lib/event/kbwEventStage2";
import { pickPrivyUserEthereumWalletAddress } from "@/lib/privy/wallet";
import { refreshPrivyAuthSession } from "@/lib/privy/session";
import { useAuthStore } from "@/store/authStore";
import { useAuthUiStore } from "@/store/authUiStore";

const POLL_MS = 800;
const MAX_POLLS = 45;

/** Mobile MetaMask return: poll until session exists, then finish Stage-2 on `/event`. */
export function useKbwEventStage2PostLogin() {
  const router = useRouter();
  const pathname = usePathname();
  const { ready, authenticated, getAccessToken, user: privyUser } = usePrivy();

  useEffect(() => {
    useAuthUiStore.getState().hydrateKbwOfferPending();
  }, []);

  const user = useAuthStore((s) => s.user);
  const initialized = useAuthStore((s) => s.initialized);
  const hydrateFromSession = useAuthStore((s) => s.hydrateFromSession);
  const refresh = useAuthStore((s) => s.refresh);
  const finishedRef = useRef(false);
  const pollCountRef = useRef(0);

  const ensureTokenableUser = useCallback(async () => {
    let sessionUser = useAuthStore.getState().user;
    if (sessionUser) return sessionUser;

    if (ready && authenticated) {
      try {
        const synced = await refreshPrivyAuthSession(getAccessToken);
        if (synced) {
          await hydrateFromSession(synced);
          sessionUser = useAuthStore.getState().user;
        }
      } catch {
        /* GET /auth/session */
      }
    }

    if (!sessionUser) {
      await refresh({ showLoading: false });
      sessionUser = useAuthStore.getState().user;
    }
    return sessionUser;
  }, [ready, authenticated, getAccessToken, hydrateFromSession, refresh]);

  const tryFinish = useCallback(async () => {
    if (!isKbwEventActive() || !isKbwStage2Pending()) {
      finishedRef.current = false;
      pollCountRef.current = 0;
      return;
    }
    if (finishedRef.current) return;
    if (!useAuthStore.getState().user && (!ready || !authenticated)) return;

    const sessionUser = await ensureTokenableUser();
    if (!sessionUser) return;

    const wallet =
      getPrimaryWalletAddress(sessionUser) ??
      pickPrivyUserEthereumWalletAddress(privyUser) ??
      null;

    const ui = useAuthUiStore.getState();
    const result = await completeKbwStage2Session({
      user: sessionUser,
      walletAddress: wallet,
      pathname,
      push: (path) => router.push(path),
      armKbwOffer: () => ui.armKbwOffer(),
      clearKbwOffer: () => ui.clearKbwOffer(),
      allowWaitForWallet: true,
    });

    if (result === "done") finishedRef.current = true;
  }, [
    ready,
    authenticated,
    privyUser,
    pathname,
    ensureTokenableUser,
    router,
  ]);

  useEffect(() => {
    if (!isKbwEventActive() || !isKbwStage2Pending()) return;
    void tryFinish();
  }, [tryFinish, user?.id, user?.email, initialized, ready, authenticated]);

  useEffect(() => {
    if (!isKbwEventActive() || !isKbwStage2Pending()) return;

    const tick = () => {
      if (finishedRef.current) return;
      if (pollCountRef.current >= MAX_POLLS) return;
      pollCountRef.current += 1;
      void tryFinish();
    };

    const id = window.setInterval(tick, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      pollCountRef.current = 0;
      void tryFinish();
    };

    window.addEventListener("pageshow", onVisible);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearInterval(id);
      window.removeEventListener("pageshow", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [tryFinish]);
}

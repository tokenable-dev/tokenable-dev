"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { getPrimaryWalletAddress } from "@/lib/auth/wallets";
import { userNeedsContactEmail } from "@/lib/auth/walletOnlyEmail";
import { isKbwEventActive } from "@/lib/event/kbwEventPeriod";
import {
  isKbwEventStage2PostLoginActive,
  tryCompleteKbwStage2AfterLogin,
} from "@/lib/event/kbwEventLoginRouting";
import { pickPrivyUserEthereumWalletAddress } from "@/lib/privy/wallet";
import { refreshPrivyAuthSession } from "@/lib/privy/session";
import { useAuthStore } from "@/store/authStore";
import { useAuthUiStore } from "@/store/authUiStore";

const POLL_MS = 800;
const MAX_POLLS = 45;

/**
 * Stage-2 post-login: after Privy + MetaMask (mobile app switch), wait for
 * Tokenable session user then email check → arm KBW offer once.
 */
export function useKbwEventStage2PostLogin() {
  const router = useRouter();
  const { ready, authenticated, getAccessToken, user: privyUser } = usePrivy();

  useEffect(() => {
    useAuthUiStore.getState().hydrateKbwOfferPending();
  }, []);

  const user = useAuthStore((s) => s.user);
  const initialized = useAuthStore((s) => s.initialized);
  const hydrateFromSession = useAuthStore((s) => s.hydrateFromSession);
  const refresh = useAuthStore((s) => s.refresh);
  const offerArmedRef = useRef(false);
  const pollCountRef = useRef(0);

  const resetArmedIfFlowCleared = useCallback(() => {
    if (!isKbwEventStage2PostLoginActive()) {
      offerArmedRef.current = false;
      pollCountRef.current = 0;
    }
  }, []);

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
        /* fall through to GET /auth/session */
      }
    }

    if (!sessionUser) {
      await refresh({ showLoading: false });
      sessionUser = useAuthStore.getState().user;
    }
    return sessionUser;
  }, [ready, authenticated, getAccessToken, hydrateFromSession, refresh]);

  const finishStage2OnEvent = useCallback(async () => {
    resetArmedIfFlowCleared();
    if (!isKbwEventActive() || !isKbwEventStage2PostLoginActive()) return;
    if (offerArmedRef.current) return;

    const cookieUser = useAuthStore.getState().user;
    if (!cookieUser && (!ready || !authenticated)) return;

    const sessionUser = await ensureTokenableUser();
    if (!sessionUser) return;
    if (userNeedsContactEmail(sessionUser)) return;

    const wallet =
      getPrimaryWalletAddress(sessionUser) ??
      pickPrivyUserEthereumWalletAddress(privyUser) ??
      null;

    const ui = useAuthUiStore.getState();
    const handled = await tryCompleteKbwStage2AfterLogin({
      user: sessionUser,
      walletAddress: wallet,
      push: (path) => router.push(path),
      armKbwOffer: () => ui.armKbwOffer(),
      clearKbwOffer: () => ui.clearKbwOffer(),
    });
    if (handled) offerArmedRef.current = true;
  }, [
    ready,
    authenticated,
    privyUser,
    ensureTokenableUser,
    router,
    resetArmedIfFlowCleared,
  ]);

  useEffect(() => {
    resetArmedIfFlowCleared();
  }, [resetArmedIfFlowCleared, user?.id]);

  useEffect(() => {
    if (!isKbwEventActive() || !isKbwEventStage2PostLoginActive()) return;
    void finishStage2OnEvent();
  }, [
    finishStage2OnEvent,
    user?.id,
    user?.email,
    initialized,
    ready,
    authenticated,
  ]);

  useEffect(() => {
    if (!isKbwEventActive() || !isKbwEventStage2PostLoginActive()) return;

    const tick = () => {
      if (offerArmedRef.current) return;
      if (pollCountRef.current >= MAX_POLLS) return;
      pollCountRef.current += 1;
      void finishStage2OnEvent();
    };

    const id = window.setInterval(tick, POLL_MS);

    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      pollCountRef.current = 0;
      void finishStage2OnEvent();
    };

    window.addEventListener("pageshow", onVisible);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearInterval(id);
      window.removeEventListener("pageshow", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [finishStage2OnEvent]);
}

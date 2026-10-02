"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useQuery } from "@tanstack/react-query";
import { ASSETS } from "@/constants/assets";
import { isKbwEventActive } from "@/lib/event/kbwEventPeriod";
import { userNeedsContactEmail } from "@/lib/auth/walletOnlyEmail";
import { ensureTokenableWalletSynced } from "@/lib/auth/ensureTokenableWalletSynced";
import { getPrimaryWalletAddress } from "@/lib/auth/wallets";
import {
  fetchKbwMysteryCardStatus,
  kbwMysteryCardContactScope,
} from "@/lib/core/api/kbw-mystery-card";
import { rq } from "@/lib/core/queryKeys";
import { PORTFOLIO_PATH } from "@/lib/portfolio/portfolioPaths";
import type { AuthUser } from "@/lib/auth/auth";
import {
  clearKbwStage2,
  finishKbwEventOnPage,
  isKbwStage2Pending,
} from "@/lib/event/kbwEventStage2";
import { pickPrivyUserEthereumWalletAddress } from "@/lib/privy/wallet";
import { useAuthStore } from "@/store/authStore";
import { useAuthUiStore } from "@/store/authUiStore";

function emailDeferKey(userId: string) {
  return `tk_add_email_deferred:${userId}`;
}

function isEmailCaptureBlocking(user: AuthUser | null | undefined): boolean {
  if (!user?.id || !userNeedsContactEmail(user)) return false;
  try {
    if (sessionStorage.getItem(emailDeferKey(user.id)) === "1") return false;
  } catch {
    /* ignore */
  }
  return true;
}

function dismissKbwOfferUi() {
  clearKbwStage2();
  useAuthUiStore.getState().clearKbwOffer();
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} fill="none" aria-hidden>
      <path
        d="M6 6l12 12M18 6L6 18"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
      />
    </svg>
  );
}

function OfferGloss() {
  return (
    <svg
      className="ev-btn__gloss"
      xmlns="http://www.w3.org/2000/svg"
      width="308"
      height="37"
      viewBox="0 0 308 37"
      fill="none"
      aria-hidden
    >
      <path
        d="M298.635 2.45085C314.531 11.6923 307.975 36.0122 289.588 36.0122H18.0351C-0.623138 36.0122 -6.96442 11.1232 9.41913 2.19522C12.0627 0.754631 15.0253 -0.000114441 18.0359 2.28882e-05L289.588 0.0121422C292.766 0.0122833 295.887 0.853691 298.635 2.45085Z"
        fill="url(#ev-offer-btn-gloss)"
      />
      <defs>
        <linearGradient
          id="ev-offer-btn-gloss"
          x1="161.138"
          y1="0"
          x2="161.138"
          y2="37"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="white" stopOpacity="0.55" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function KbwMysteryOfferModal() {
  const router = useRouter();
  const { authenticated, user: privyUser, getAccessToken } = usePrivy();
  const { wallets } = useWallets();
  const user = useAuthStore((s) => s.user);
  const initialized = useAuthStore((s) => s.initialized);
  const hydrateFromSession = useAuthStore((s) => s.hydrateFromSession);
  const kbwMysteryOfferVisible = useAuthUiStore((s) => s.kbwMysteryOfferVisible);

  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [buyNavigating, setBuyNavigating] = useState(false);

  const wallet =
    (
      getPrimaryWalletAddress(user) ??
      pickPrivyUserEthereumWalletAddress(privyUser)
    )?.toLowerCase() ?? "";

  const sessionReady = initialized && Boolean(user);
  const stage2AwaitingOffer = authenticated && isKbwStage2Pending();
  const kbwContactScope = kbwMysteryCardContactScope(user?.email);
  const emailGateOpen = isEmailCaptureBlocking(user);
  const needsEmail = userNeedsContactEmail(user);
  const hasContactEmail = Boolean(kbwContactScope);

  const shouldCheckBurned =
    mounted &&
    isKbwEventActive() &&
    sessionReady &&
    hasContactEmail &&
    !needsEmail &&
    !emailGateOpen &&
    stage2AwaitingOffer;

  const cardStatusQuery = useQuery({
    queryKey: rq.kbwMysteryCard(wallet, kbwContactScope),
    queryFn: () => fetchKbwMysteryCardStatus(wallet),
    enabled: shouldCheckBurned,
    staleTime: 30_000,
    retry: 1,
  });

  const participated = cardStatusQuery.data?.burned === true;
  const stage2BurnedRedirectInFlight = useRef(false);

  useEffect(() => {
    setMounted(true);
    useAuthUiStore.getState().hydrateKbwOfferPending();
  }, []);

  useEffect(() => {
    if (!mounted || !isKbwEventActive()) {
      setOpen(false);
      return;
    }
    if (!sessionReady || needsEmail || emailGateOpen) {
      setOpen(false);
      return;
    }

    if (kbwMysteryOfferVisible) {
      setOpen(true);
      return;
    }

    if (!stage2AwaitingOffer) {
      setOpen(false);
      return;
    }

    if (!hasContactEmail) return;
    if (cardStatusQuery.isLoading || cardStatusQuery.data === undefined) return;
    setOpen(!participated);
  }, [
    mounted,
    kbwMysteryOfferVisible,
    stage2AwaitingOffer,
    participated,
    cardStatusQuery.isLoading,
    cardStatusQuery.data,
    sessionReady,
    needsEmail,
    emailGateOpen,
    hasContactEmail,
  ]);

  useEffect(() => {
    if (!stage2AwaitingOffer || !sessionReady || !hasContactEmail) return;
    if (needsEmail || emailGateOpen) return;
    if (cardStatusQuery.isLoading || cardStatusQuery.data === undefined) return;
    if (!participated) return;
    if (stage2BurnedRedirectInFlight.current) return;

    stage2BurnedRedirectInFlight.current = true;
    const ui = useAuthUiStore.getState();
    void finishKbwEventOnPage({
      user,
      walletAddress: wallet,
      push: (path) => router.push(path),
      armKbwOffer: () => ui.armKbwOffer(),
      clearKbwOffer: () => ui.clearKbwOffer(),
    }).finally(() => {
      stage2BurnedRedirectInFlight.current = false;
    });
  }, [
    stage2AwaitingOffer,
    sessionReady,
    hasContactEmail,
    wallet,
    participated,
    cardStatusQuery.isLoading,
    cardStatusQuery.data,
    needsEmail,
    emailGateOpen,
    user,
    router,
  ]);

  function close() {
    setOpen(false);
    dismissKbwOfferUi();
  }

  async function handleBuy() {
    if (buyNavigating) return;
    setBuyNavigating(true);
    try {
      await ensureTokenableWalletSynced({
        getAccessToken,
        hydrateFromSession,
        privyWalletHint:
          wallets.length > 0 ||
          Boolean(pickPrivyUserEthereumWalletAddress(privyUser)),
      });
    } finally {
      setBuyNavigating(false);
    }
    setOpen(false);
    dismissKbwOfferUi();
    useAuthUiStore.getState().clearPendingReturnToForEvent();
    router.push(`${PORTFOLIO_PATH}?tab=assets`);
  }

  if (!mounted || !open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="ev-offer-overlay"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        className="ev-offer-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Mystery pack offer"
      >
        <header className="ev-top ev-offer-modal__top">
          <div className="ev-top__logo" aria-hidden>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={ASSETS.logo.tokenableDs}
              alt=""
              width={160}
              height={22}
            />
          </div>
          <button
            type="button"
            className="ev-offer-modal__close"
            aria-label="Close"
            onClick={close}
          >
            <CloseIcon />
          </button>
        </header>

        <div className="ev-offer-modal__pack">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={ASSETS.event.mysteryPack}
            alt="Oripa mystery pack"
            width={663}
            height={1024}
          />
        </div>

        <div className="ev-offer-modal__meta">
          <p className="ev-offer-modal__price" aria-label="Was 50 dollars">
            <span className="ev-offer-modal__price-strike">$50</span>
          </p>
        </div>

        <button
          type="button"
          className="ev-btn ev-btn--primary ev-offer-modal__cta"
          disabled={buyNavigating}
          onClick={() => void handleBuy()}
        >
          <OfferGloss />
          <span className="ev-btn__label">
            {buyNavigating ? "Loading…" : "BUY • FREE"}
          </span>
        </button>
      </div>
    </div>,
    document.body,
  );
}

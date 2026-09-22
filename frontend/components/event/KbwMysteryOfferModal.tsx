"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ASSETS } from "@/constants/assets";
import { isKbwEventActive } from "@/lib/event/kbwEventPeriod";
import { isWalletOnlyPlaceholderEmail } from "@/lib/auth/walletOnlyEmail";
import { getPrimaryWalletAddress } from "@/lib/auth/wallets";
import { fetchKbwMysteryCardStatus } from "@/lib/core/api/kbw-mystery-card";
import { rq } from "@/lib/core/queryKeys";
import { PORTFOLIO_PATH } from "@/lib/portfolio/portfolioPaths";
import { useAuthStore } from "@/store/authStore";
import { useAuthUiStore } from "@/store/authUiStore";

function emailDeferKey(userId: string) {
  return `tk_add_email_deferred:${userId}`;
}

/** True while AddEmailRequiredModal should take priority. */
function isEmailCaptureBlocking(
  userId: string | undefined,
  email: string | undefined,
): boolean {
  if (!userId || !isWalletOnlyPlaceholderEmail(email)) return false;
  try {
    if (sessionStorage.getItem(emailDeferKey(userId)) === "1") return false;
  } catch {
    /* ignore */
  }
  return true;
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

/**
 * KBW mystery-card offer — all viewports.
 *
 * Participation SSOT: `burned === false` → not participated → show modal.
 * `burned === true` → participated (portfolio shows card as Used) → hide modal.
 */
export function KbwMysteryOfferModal() {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const initialized = useAuthStore((s) => s.initialized);
  const privySessionSyncing = useAuthStore((s) => s.privySessionSyncing);
  const kbwOfferPending = useAuthUiStore((s) => s.kbwOfferPending);
  const clearKbwOffer = useAuthUiStore((s) => s.clearKbwOffer);
  const hydrateKbwOfferPending = useAuthUiStore((s) => s.hydrateKbwOfferPending);

  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);

  const wallet = getPrimaryWalletAddress(user)?.toLowerCase() ?? "";
  const cardStatusQuery = useQuery({
    queryKey: rq.kbwMysteryCard(wallet),
    queryFn: () => fetchKbwMysteryCardStatus(wallet),
    enabled:
      mounted &&
      isKbwEventActive() &&
      Boolean(wallet) &&
      initialized &&
      !privySessionSyncing &&
      Boolean(user),
    staleTime: 30_000,
  });

  /** Card still in portfolio ⇒ not participated. */
  const cardStillInPortfolio = cardStatusQuery.data?.burned === false;
  /** Burned / removed ⇒ participated. */
  const cardRemovedFromPortfolio = cardStatusQuery.data?.burned === true;
  const statusReady = cardStatusQuery.isSuccess;

  useEffect(() => {
    setMounted(true);
    hydrateKbwOfferPending();
  }, [hydrateKbwOfferPending]);

  const emailGateOpen = isEmailCaptureBlocking(user?.id, user?.email);

  useEffect(() => {
    if (!mounted) return;
    if (!isKbwEventActive()) {
      clearKbwOffer();
      setOpen(false);
      return;
    }
    if (!initialized || privySessionSyncing || !user) return;
    if (emailGateOpen) return;
    if (!wallet) return;
    if (!statusReady) return;

    if (cardRemovedFromPortfolio) {
      clearKbwOffer();
      setOpen(false);
      return;
    }

    if (!cardStillInPortfolio) return;

    const onHome = pathname === "/" || pathname === "";
    // `/event` only opens when Stage 2 armed the offer (not on every visit).
    if (kbwOfferPending || onHome) {
      setOpen(true);
      if (kbwOfferPending) clearKbwOffer();
    }
  }, [
    mounted,
    kbwOfferPending,
    clearKbwOffer,
    initialized,
    privySessionSyncing,
    user,
    emailGateOpen,
    wallet,
    statusReady,
    cardStillInPortfolio,
    cardRemovedFromPortfolio,
    pathname,
  ]);

  function close() {
    setOpen(false);
  }

  function handleBuy() {
    clearKbwOffer();
    close();
    router.push(`${PORTFOLIO_PATH}?tab=assets`);
  }

  if (!mounted || !open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="ev-page ev-offer-overlay"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        className="ev-shell ev-offer-modal"
        role="dialog"
        aria-modal="true"
        aria-label="KBW Mystery Card"
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

        <section className="ev-offer-modal__hero" aria-label="Event">
          <p className="ev-offer-modal__eyebrow">Korea Blockchain Week</p>
          <div className="ev-hero__rule" aria-hidden />
        </section>

        <div className="ev-offer-modal__pack">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={ASSETS.event.mysteryPack}
            alt="KBW Mystery Card pack"
            width={430}
            height={603}
          />
        </div>

        <div className="ev-offer-modal__meta">
          <h2 className="ev-offer-modal__title">KBW MYSTERY CARD</h2>
          <p className="ev-offer-modal__price" aria-label="Was 50 dollars">
            <span className="ev-offer-modal__price-strike">$50</span>
          </p>
        </div>

        <button
          type="button"
          className="ev-btn ev-btn--primary ev-offer-modal__cta"
          onClick={handleBuy}
        >
          <OfferGloss />
          <span className="ev-btn__label">BUY • FREE</span>
        </button>
      </div>
    </div>,
    document.body,
  );
}

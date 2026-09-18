"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ASSETS } from "@/constants/assets";
import {
  claimGuestKbwStage1ForAccount,
  kbwEventParticipationScope,
  readKbwStage1Done,
  writeKbwStage1Done,
} from "@/lib/event/kbwEventParticipation";
import { isMobileBrowserUa } from "@/lib/privy/walletLoginIntent";
import { useAuthStore } from "@/store/authStore";
import { useAuthUiStore } from "@/store/authUiStore";

const STAGE1_IG_USER = "tokenable_io";
const STAGE1_INSTAGRAM_WEB = `https://www.instagram.com/${STAGE1_IG_USER}`;
const STAGE1_INSTAGRAM_APP = `instagram://user?username=${STAGE1_IG_USER}`;

const COPY = {
  heroTitle: "Claim Your Free Card!",
  stage1Label: "STAGE 1",
  stage1Desc: "Follow @tokenable and like the pinned post",
  stage1Cta: "1. Instagram Follow & Like",
  stage2Label: "STAGE 2",
  stage2Desc: "Buy a mystery card on Tokenable for 0 USDC",
  stage2Cta: "Log in to Tokenable",
  foot: "REAL GRADED CARDS · ON-CHAIN · INSTANTSETTLEMENT",
} as const;

/** Open Instagram profile — prefer native app on mobile; never leave `/event` with a popup. */
function openInstagramProfile() {
  if (!isMobileBrowserUa()) {
    window.open(STAGE1_INSTAGRAM_WEB, "_blank", "noopener,noreferrer");
    return;
  }

  // Mobile: never `window.open` HTTPS — that forces a browser tab/popup before the app.
  // Try the native scheme first; only if we are still visible after a pause, fall back
  // same-tab (Universal / App Links may still hand off to Instagram).
  const isAndroid = /Android/i.test(navigator.userAgent);

  if (isAndroid) {
    window.location.href =
      `intent://user?username=${STAGE1_IG_USER}#Intent;` +
      `scheme=instagram;package=com.instagram.android;end`;
  } else {
    window.location.href = STAGE1_INSTAGRAM_APP;
  }

  window.setTimeout(() => {
    // App took over → tab is hidden; do nothing.
    if (document.hidden) return;
    // Same tab only — no popup. OS may still open the Instagram app via App Links.
    window.location.assign(STAGE1_INSTAGRAM_WEB);
  }, 2200);
}

function Stage1Gloss() {
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
        fill="url(#ev-btn-gloss)"
      />
      <defs>
        <linearGradient
          id="ev-btn-gloss"
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

/** Pixel check — inline so we never depend on a flaky PNG load. */
function Stage1CheckIcon() {
  return (
    <svg
      className="ev-btn__check"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 43 32"
      width={43}
      height={32}
      aria-hidden
    >
      <path
        fill="#38d17f"
        d="M4 16h3v3H4v-3zm3 3h3v3H7v-3zm3 3h3v3h-3v-3zm3 3h3v3h-3v-3zm3-3h3v3h-3v-3zm3-3h3v3h-3v-3zm3-3h3v3h-3v-3zm3-3h3v3h-3v-3zm3-3h3v3h-3v-3zm3-3h3v3h-3v-3zm3-3h3v3h-3v-3z"
      />
    </svg>
  );
}

/** KBW event landing — Figma 430×932 layout. */
export function EventLandingView() {
  const router = useRouter();
  const [stage1Done, setStage1Done] = useState(false);
  const stage1TimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const user = useAuthStore((s) => s.user);
  const userId = user?.id;
  const userEmail = user?.email;
  const openSignIn = useAuthUiStore((s) => s.openSignIn);
  const armKbwOffer = useAuthUiStore((s) => s.armKbwOffer);
  const scope = kbwEventParticipationScope(userId, userEmail);

  useEffect(() => {
    // Per-account (or guest) — switching users must not keep another account's check.
    if (readKbwStage1Done(scope)) {
      setStage1Done(true);
      return;
    }
    if (scope !== "guest" && readKbwStage1Done("guest")) {
      claimGuestKbwStage1ForAccount(userId, userEmail);
      setStage1Done(true);
      return;
    }
    setStage1Done(false);
  }, [scope, userId, userEmail]);

  useEffect(() => {
    return () => {
      if (stage1TimerRef.current) clearTimeout(stage1TimerRef.current);
    };
  }, []);

  function handleStage1() {
    if (stage1Done || stage1TimerRef.current) return;

    // Persist immediately so backgrounding the tab (Instagram app) cannot lose progress.
    writeKbwStage1Done(scope);
    openInstagramProfile();

    // Checkmark UI after a short delay (matches design timing).
    stage1TimerRef.current = setTimeout(() => {
      stage1TimerRef.current = null;
      setStage1Done(true);
    }, 2000);
  }

  function handleStage2() {
    if (!stage1Done) return;
    // Agreed: login → main (`/`) → offer modal → BUY FREE → portfolio.
    armKbwOffer();
    try {
      sessionStorage.setItem("tk_kbw_login_intent", "1");
    } catch {
      /* ignore */
    }
    if (user) {
      router.push("/");
      return;
    }
    openSignIn({ returnTo: "/" });
  }

  return (
    <div className="ev-page">
      <div className="ev-shell">
        <section className="ev-intro" aria-label="Tokenable x KBW2026">
          <div className="ev-intro__brand">
            <Link href="/" className="ev-intro__logo" aria-label="Tokenable home">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={ASSETS.logo.tokenableDs}
                alt="Tokenable"
                width={280}
                height={40}
              />
            </Link>
            <p className="ev-intro__x" aria-hidden>
              X
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="ev-intro__kbw"
              src={ASSETS.event.kbw2026}
              alt="KBW2026"
              width={158}
              height={27}
            />
            <div className="ev-intro__rule" aria-hidden />
          </div>
          <h1 className="ev-intro__claim">{COPY.heroTitle}</h1>
        </section>

        <div className="ev-stages">
          <section className="ev-stage" aria-labelledby="ev-stage-1">
            <p
              className={`ev-stage__label ${stage1Done ? "ev-stage__label--unchecked" : "ev-stage__label--checked"}`}
              id="ev-stage-1"
            >
              {COPY.stage1Label}
            </p>
            <p className="ev-stage__desc">{COPY.stage1Desc}</p>
            <button
              type="button"
              className={`ev-btn${stage1Done ? " ev-btn--done" : " ev-btn--primary"}`}
              aria-label={stage1Done ? "Stage 1 complete" : COPY.stage1Cta}
              aria-pressed={stage1Done}
              disabled={stage1Done}
              onClick={handleStage1}
            >
              {stage1Done ? null : <Stage1Gloss />}
              <span className="ev-btn__label">
                {stage1Done ? <Stage1CheckIcon /> : COPY.stage1Cta}
              </span>
            </button>
          </section>

          <section className="ev-stage" aria-labelledby="ev-stage-2">
            <p
              className="ev-stage__label ev-stage__label--checked"
              id="ev-stage-2"
            >
              {COPY.stage2Label}
            </p>
            <p className="ev-stage__desc">{COPY.stage2Desc}</p>
            <button
              type="button"
              className={`ev-btn${stage1Done ? " ev-btn--primary" : " ev-btn--disabled"}`}
              disabled={!stage1Done}
              onClick={handleStage2}
            >
              {stage1Done ? <Stage1Gloss /> : null}
              <span className="ev-btn__label">{COPY.stage2Cta}</span>
            </button>
          </section>
        </div>

        <footer className="ev-foot" aria-label={COPY.foot}>
          <div className="ev-foot__marquee">
            <div className="ev-foot__track">
              <span className="ev-foot__tag">{COPY.foot}</span>
              <span className="ev-foot__tag" aria-hidden>
                {COPY.foot}
              </span>
              <span className="ev-foot__tag" aria-hidden>
                {COPY.foot}
              </span>
              <span className="ev-foot__tag" aria-hidden>
                {COPY.foot}
              </span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

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
import { useAuthStore } from "@/store/authStore";
import { useAuthUiStore } from "@/store/authUiStore";

const STAGE1_INSTAGRAM_URL = "https://www.instagram.com/tokenable_io";

const COPY = {
  heroSub: "Korea Blockchain Week",
  stage1Label: "STAGE 1",
  stage1Desc: "Follow @tokenable and like the pinned post",
  stage1Cta: "1. Instagram Follow & Like",
  stage2Label: "STAGE 2",
  stage2Desc: "Buy a mystery card on Tokenable for 0 USDC",
  stage2Cta: "Log in to Tokenable",
  foot: "REAL GRADED CARDS · ON-CHAIN · INSTANTSETTLEMENT",
} as const;

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

    // Same-tab only — no popup (desktop was opening both a new tab and navigating).
    stage1TimerRef.current = setTimeout(() => {
      stage1TimerRef.current = null;
      writeKbwStage1Done(scope);
      setStage1Done(true);
      window.location.assign(STAGE1_INSTAGRAM_URL);
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
        <header className="ev-top">
          <Link href="/" className="ev-top__logo" aria-label="Tokenable home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={ASSETS.logo.tokenableDs}
              alt="Tokenable"
              width={160}
              height={22}
            />
          </Link>
        </header>

        <section className="ev-hero" aria-label="Event hero">
          <h1 className="ev-hero__title">
            <span className="ev-hero__title-line">PLAY</span>
            <span className="ev-hero__title-line ev-hero__title-line--accent">
              THE MARKET
            </span>
          </h1>
          <div className="ev-hero__rule" aria-hidden />
          <p className="ev-hero__sub">{COPY.heroSub}</p>
        </section>

        <div className="ev-stages">
          <section className="ev-stage" aria-labelledby="ev-stage-1">
            <p className="ev-stage__label ev-stage__label--1" id="ev-stage-1">
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
                {stage1Done ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    className="ev-btn__check"
                    src={ASSETS.event.check}
                    alt=""
                    width={43}
                    height={32}
                  />
                ) : (
                  COPY.stage1Cta
                )}
              </span>
            </button>
          </section>

          <section className="ev-stage" aria-labelledby="ev-stage-2">
            <p className="ev-stage__label ev-stage__label--2" id="ev-stage-2">
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

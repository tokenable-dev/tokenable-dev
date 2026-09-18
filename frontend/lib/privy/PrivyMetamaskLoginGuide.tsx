"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePrivy } from "@privy-io/react-auth";
import { isMobileBrowserUa } from "@/lib/privy/walletLoginIntent";
import { useAuthStore } from "@/store/authStore";
import { useAuthUiStore } from "@/store/authUiStore";
import "@/styles/tokenable-mm-login-guide.css";

type GuidePhase = "idle" | "in_wallet" | "await_sign" | "finishing";

const FLOW_TTL_MS = 3 * 60_000;

function isMetamaskUiTarget(el: Element): boolean {
  const text = (el.textContent ?? "").toLowerCase();
  const aria = (el.getAttribute("aria-label") ?? "").toLowerCase();
  const title = (el.getAttribute("title") ?? "").toLowerCase();
  return (
    text.includes("metamask") ||
    aria.includes("metamask") ||
    title.includes("metamask")
  );
}

function copyFor(phase: GuidePhase): { title: string; body: string; step: string } {
  if (phase === "in_wallet") {
    return {
      step: "1 / 2",
      title: "Continue in MetaMask",
      body: "Approve the connection, then come back here. We’ll be waiting.",
    };
  }
  if (phase === "await_sign") {
    return {
      step: "2 / 2",
      title: "Almost done",
      body: "Tap Sign with your wallet in the dialog, then confirm once more in MetaMask.",
    };
  }
  return {
    step: "",
    title: "Signing you in",
    body: "Hang tight — finishing your Tokenable session.",
  };
}

/**
 * Soft bridge for mobile MetaMask login (connect → SIWE are two visits).
 * Guides the user through the gap; never auto-clicks Sign / loginOrLink.
 */
export function PrivyMetamaskLoginGuide() {
  const { authenticated } = usePrivy();
  const privySessionSyncing = useAuthStore((s) => s.privySessionSyncing);
  const walletPhase = useAuthUiStore((s) => s.walletActivationPhase);
  const [phase, setPhase] = useState<GuidePhase>("idle");
  const [mounted, setMounted] = useState(false);
  const flowStartedAt = useRef<number | null>(null);
  /** Only advance to step 2 after the tab was actually backgrounded (app switch). */
  const sawHidden = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const reset = () => {
    flowStartedAt.current = null;
    sawHidden.current = false;
    setPhase("idle");
  };

  const beginFlow = () => {
    if (!isMobileBrowserUa()) return;
    flowStartedAt.current = Date.now();
    sawHidden.current = document.hidden;
    setPhase("in_wallet");
  };

  useEffect(() => {
    if (!isMobileBrowserUa()) return;
    const onPointer = (e: Event) => {
      const t = e.target;
      if (!(t instanceof Element)) return;
      const hit = t.closest("button, a, [role='button']");
      if (!hit || !isMetamaskUiTarget(hit)) return;
      beginFlow();
    };
    document.addEventListener("pointerdown", onPointer, true);
    return () => document.removeEventListener("pointerdown", onPointer, true);
  }, []);

  useEffect(() => {
    if (!isMobileBrowserUa()) return;
    if (walletPhase === "waiting_mobile_return" || walletPhase === "activating") {
      beginFlow();
    }
    if (walletPhase === "failed") reset();
  }, [walletPhase]);

  useEffect(() => {
    if (phase === "idle") return;

    const onVis = () => {
      if (flowStartedAt.current && Date.now() - flowStartedAt.current > FLOW_TTL_MS) {
        reset();
        return;
      }
      if (authenticated || privySessionSyncing) {
        setPhase("finishing");
        return;
      }
      if (document.visibilityState === "hidden") {
        sawHidden.current = true;
        setPhase("in_wallet");
        return;
      }
      // Visible again — only step 2 after a real app switch.
      if (!sawHidden.current) return;
      if (walletPhase === "waiting_mobile_return" || walletPhase === "reconciling") {
        setPhase("in_wallet");
        return;
      }
      setPhase("await_sign");
    };

    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [phase, authenticated, privySessionSyncing, walletPhase]);

  useEffect(() => {
    if (phase === "idle") return;
    if (authenticated || privySessionSyncing) setPhase("finishing");
  }, [authenticated, privySessionSyncing, phase]);

  useEffect(() => {
    if (phase !== "finishing") return;
    const id = window.setTimeout(() => reset(), 1100);
    return () => window.clearTimeout(id);
  }, [phase]);

  if (!mounted || phase === "idle") return null;

  const copy = copyFor(phase);
  const soft = phase === "await_sign";

  return createPortal(
    <div
      className={`tk-mm-guide${soft ? " tk-mm-guide--soft" : ""}`}
      role="status"
      aria-live="polite"
    >
      <div className="tk-mm-guide__card">
        {copy.step ? <p className="tk-mm-guide__step">{copy.step}</p> : null}
        <div className="tk-mm-guide__pulse" aria-hidden />
        <h2 className="tk-mm-guide__title">{copy.title}</h2>
        <p className="tk-mm-guide__body">{copy.body}</p>
        {phase === "await_sign" ? (
          <button type="button" className="tk-mm-guide__dismiss" onClick={reset}>
            Dismiss
          </button>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

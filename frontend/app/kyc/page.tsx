"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { TkButton } from "@/components/ds";
import { fetchAuthMe } from "@/lib/auth";
import { fetchKycAccessToken, fetchKycStatus, type KycStatusResponse } from "@/lib/kyc/api";
import { useAuthStore } from "@/store/authStore";
import { useAuthUiStore } from "@/store/authUiStore";

const SumsubWebSdk = dynamic(() => import("@sumsub/websdk-react"), { ssr: false });

const KYC_RETURN_KEY = "tk_kyc_return_to";

function readStoredReturnTo(): string | null {
  try {
    return sessionStorage.getItem(KYC_RETURN_KEY);
  } catch {
    return null;
  }
}

function clearStoredReturnTo() {
  try {
    sessionStorage.removeItem(KYC_RETURN_KEY);
  } catch {
    /* ignore */
  }
}

function hasExplicitReturnTo(
  pending: string | null | undefined,
  captured: string | null | undefined,
): boolean {
  return Boolean(
    (pending && pending.startsWith("/")) ||
      (captured && captured.startsWith("/")) ||
      readStoredReturnTo(),
  );
}

function resolveReturnPath(
  pending: string | null | undefined,
  captured: string | null | undefined,
): string {
  const stored = readStoredReturnTo();
  const path = pending ?? captured ?? stored;
  return path && path.startsWith("/") ? path : "/vault";
}

function formatKycError(e: unknown, fallback: string): string {
  const message = e instanceof Error ? e.message : fallback;
  if (/too many requests|throttler/i.test(message)) {
    return "Too many verification requests. Wait about a minute, then try again.";
  }
  return message || fallback;
}

export default function KycPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);
  const initialized = useAuthStore((s) => s.initialized);
  const setUser = useAuthStore((s) => s.setUser);
  const consumeReturnTo = useAuthUiStore((s) => s.consumeReturnTo);
  const [status, setStatus] = useState<KycStatusResponse | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [booting, setBooting] = useState(false);
  const [returnTo] = useState(
    () => useAuthUiStore.getState().pendingReturnTo ?? readStoredReturnTo(),
  );
  const [autoContinuing, setAutoContinuing] = useState(false);
  const statusLoadedForUser = useRef<string | null>(null);
  const autoStartDone = useRef(false);
  const bootingRef = useRef(false);

  useEffect(() => {
    if (!loading && initialized && !user) {
      router.replace("/login");
    }
  }, [user, loading, initialized, router]);

  const refreshSession = useCallback(async () => {
    const me = await fetchAuthMe();
    if (me) setUser(me);
  }, [setUser]);

  const loadStatus = useCallback(async () => {
    const next = await fetchKycStatus();
    setStatus(next);
    return next;
  }, []);

  const continueAfterApproval = useCallback(() => {
    const path = resolveReturnPath(consumeReturnTo(), returnTo);
    clearStoredReturnTo();
    router.replace(path);
  }, [consumeReturnTo, returnTo, router]);

  const startVerification = useCallback(async () => {
    if (bootingRef.current || accessToken) return;
    bootingRef.current = true;
    setPageError(null);
    setBooting(true);
    try {
      const nextStatus = await loadStatus();
      if (!nextStatus.sumsubConfigured) {
        setPageError("Identity verification is not configured yet. Please try again later.");
        return;
      }
      if (nextStatus.status === "approved") return;
      const { token } = await fetchKycAccessToken();
      setAccessToken(token);
      // Keep local status in sync without re-triggering boot effects.
      setStatus((prev) =>
        prev
          ? { ...prev, status: prev.status === "none" ? "pending" : prev.status }
          : prev,
      );
      void refreshSession().catch(() => undefined);
    } catch (e) {
      setPageError(formatKycError(e, "Could not start verification"));
    } finally {
      bootingRef.current = false;
      setBooting(false);
    }
  }, [accessToken, loadStatus, refreshSession]);

  // Load KYC status once per signed-in user (avoid session refresh loops).
  useEffect(() => {
    if (!user?.id) return;
    if (statusLoadedForUser.current === user.id) return;
    statusLoadedForUser.current = user.id;
    void loadStatus().catch((e) => {
      setPageError(formatKycError(e, "Could not load KYC status"));
    });
  }, [user?.id, loadStatus]);

  // Auto-open Sumsub once for new or abandoned (pending) applicants.
  useEffect(() => {
    if (!user?.id || !status) return;
    if (accessToken || autoStartDone.current) return;
    if (status.status !== "none" && status.status !== "pending") return;
    autoStartDone.current = true;
    void startVerification();
  }, [user?.id, status, accessToken, startVerification]);

  // After approval, return to the screen that launched KYC (e.g. /sell/flow).
  useEffect(() => {
    if (status?.status !== "approved" || autoContinuing) return;
    const pending = useAuthUiStore.getState().pendingReturnTo;
    if (!hasExplicitReturnTo(pending, returnTo)) return;
    setAutoContinuing(true);
    const t = window.setTimeout(() => {
      continueAfterApproval();
    }, 600);
    return () => window.clearTimeout(t);
  }, [status?.status, returnTo, autoContinuing, continueAfterApproval]);

  const expirationHandler = useCallback(async () => {
    const { token } = await fetchKycAccessToken();
    return token;
  }, []);

  const handleSdkMessage = useCallback(
    (type: string, payload: unknown) => {
      if (type === "idCheck.onApplicantSubmitted") {
        void refreshSession();
      }
      if (
        type === "idCheck.onApplicantStatusChanged" ||
        type === "idCheck.onApplicantVerificationCompleted"
      ) {
        const review = payload as {
          reviewStatus?: string;
          reviewResult?: { reviewAnswer?: string };
        };
        const answer = review.reviewResult?.reviewAnswer;
        if (review.reviewStatus === "completed" && answer === "GREEN") {
          void refreshSession().then(() => void loadStatus());
        }
      }
    },
    [loadStatus, refreshSession],
  );

  if (!initialized || loading || !user) {
    return (
      <main className="kyc-page">
        <div className="kyc-page__shell">
          <p className="tk-muted">Loading…</p>
        </div>
      </main>
    );
  }

  const approved = status?.status === "approved";
  const rejected = status?.status === "rejected";
  const pending = status?.status === "pending";
  const sdkActive = Boolean(accessToken) && !approved;

  return (
    <main className="kyc-page">
      <div className={`kyc-page__shell${sdkActive ? " kyc-page__shell--sdk" : ""}`}>
        <header className={`kyc-page__header${sdkActive ? " kyc-page__header--compact" : ""}`}>
          <h1 className="kyc-page__title">Verify your identity</h1>
          {!sdkActive ? (
            <p className="kyc-page__lead">
              We need a quick identity check before you can ship cards to the vault or redeem a
              physical card — ID (passport or driver’s license), a liveness selfie, usually 1–2
              minutes.
            </p>
          ) : (
            <p className="kyc-page__lead">
              Complete the steps below. Camera access may be requested for the liveness check.
            </p>
          )}
        </header>

        {pageError ? (
          <p className="tk-form-error" role="alert">
            {pageError}
          </p>
        ) : null}

        {approved ? (
          <section className="kyc-status-card">
            <p>
              {autoContinuing
                ? "Identity verification is complete. Taking you back…"
                : "Identity verification is complete. You can now ship cards to the vault or redeem a physical card."}
            </p>
            {!autoContinuing ? (
              <TkButton variant="primary" onClick={continueAfterApproval}>
                Continue
              </TkButton>
            ) : null}
          </section>
        ) : null}

        {rejected ? (
          <section className="kyc-status-card">
            <p>
              We need another look
              {status?.rejectionReason ? `: ${status.rejectionReason}` : "."} Please resubmit your
              ID and liveness check.
            </p>
            <TkButton
              variant="primary"
              disabled={booting}
              onClick={() => {
                autoStartDone.current = true;
                void startVerification();
              }}
            >
              {booting ? "Starting…" : "Try again"}
            </TkButton>
          </section>
        ) : null}

        {pending && !accessToken && !rejected ? (
          <section className="kyc-status-card">
            <p>
              {pageError
                ? "You can retry opening Sumsub below once the rate limit clears."
                : "Your verification is under review, or you left mid-flow. Continue to reopen Sumsub."}
            </p>
            <TkButton
              variant="neutral"
              disabled={booting}
              onClick={() => {
                autoStartDone.current = true;
                void startVerification();
              }}
            >
              {booting ? "Loading…" : "Continue verification"}
            </TkButton>
          </section>
        ) : null}

        {sdkActive ? (
          <section className="kyc-sdk" aria-label="Identity verification">
            <SumsubWebSdk
              className="kyc-sdk__frame"
              accessToken={accessToken!}
              expirationHandler={expirationHandler}
              config={{ lang: "en", theme: "dark" }}
              options={{
                addViewportTag: false,
                adaptIframeHeight: true,
                enableScrollIntoView: true,
              }}
              onMessage={handleSdkMessage}
              onError={(err: unknown) => {
                setPageError(
                  typeof err === "object" && err && "error" in err
                    ? String((err as { error?: unknown }).error)
                    : "Verification error",
                );
              }}
            />
          </section>
        ) : null}

        {!accessToken && !approved && !rejected && !pending && booting ? (
          <p className="tk-muted">Preparing verification…</p>
        ) : null}
      </div>
    </main>
  );
}

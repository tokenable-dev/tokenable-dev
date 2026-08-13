"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { TkButton } from "@/components/ds";
import { fetchAuthMe } from "@/lib/auth";
import { fetchKycAccessToken, fetchKycStatus, type KycStatusResponse } from "@/lib/kyc/api";
import {
  clearKycReturnTo,
  peekKycReturnTo,
  rememberKycReturnTo,
  resolveKycReturnPath,
} from "@/lib/kyc/returnPath";
import { useAuthStore } from "@/store/authStore";
import { useAuthUiStore } from "@/store/authUiStore";

const SumsubWebSdk = dynamic(() => import("@sumsub/websdk-react"), { ssr: false });

const POLL_INTERVAL_MS = 2000;
const POLL_MAX_ATTEMPTS = 45;
const AUTO_CONTINUE_DELAY_MS = 1200;

function formatKycError(e: unknown, fallback: string): string {
  const message = e instanceof Error ? e.message : fallback;
  if (/too many requests|throttler/i.test(message)) {
    return "Too many verification requests. Wait about a minute, then try again.";
  }
  return message || fallback;
}

function reviewAnswerFromPayload(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const row = payload as Record<string, unknown>;
  if (typeof row.answer === "string") return row.answer;
  const result = row.reviewResult;
  if (result && typeof result === "object") {
    const answer = (result as { reviewAnswer?: unknown }).reviewAnswer;
    if (typeof answer === "string") return answer;
  }
  return undefined;
}

function reviewStatusFromPayload(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const status = (payload as { reviewStatus?: unknown }).reviewStatus;
  return typeof status === "string" ? status : undefined;
}

export default function KycPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);
  const initialized = useAuthStore((s) => s.initialized);
  const setUser = useAuthStore((s) => s.setUser);
  const [status, setStatus] = useState<KycStatusResponse | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [booting, setBooting] = useState(false);
  const [returnTo] = useState(() => {
    const fromStore = useAuthUiStore.getState().pendingReturnTo;
    if (fromStore) rememberKycReturnTo(fromStore);
    return resolveKycReturnPath(fromStore, peekKycReturnTo());
  });
  const [autoContinuing, setAutoContinuing] = useState(false);
  const continueAfterApprovalRef = useRef<() => void>(() => undefined);
  const statusLoadedForUser = useRef<string | null>(null);
  const autoStartDone = useRef(false);
  const bootingRef = useRef(false);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollAttemptsRef = useRef(0);

  useEffect(() => {
    if (!loading && initialized && !user) {
      router.replace("/login");
    }
  }, [user, loading, initialized, router]);

  const stopStatusPoll = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    pollAttemptsRef.current = 0;
  }, []);

  useEffect(() => () => stopStatusPoll(), [stopStatusPoll]);

  const applyStatus = useCallback(
    async (next: KycStatusResponse) => {
      setStatus(next);
      if (next.status === "approved" || next.status === "rejected") {
        setAccessToken(null);
        stopStatusPoll();
      }
      const current = useAuthStore.getState().user;
      if (current) {
        setUser({
          ...current,
          kycStatus: next.status,
          kycVerifiedAt: next.verifiedAt ?? current.kycVerifiedAt,
          kycProvider: next.provider ?? current.kycProvider,
        });
      }
      return next;
    },
    [setUser, stopStatusPoll],
  );

  const loadStatus = useCallback(async () => {
    const next = await fetchKycStatus();
    return applyStatus(next);
  }, [applyStatus]);

  const continueAfterApproval = useCallback(() => {
    const path = resolveKycReturnPath(returnTo, peekKycReturnTo());
    clearKycReturnTo();
    useAuthUiStore.getState().consumeReturnTo();
    router.replace(path);
  }, [returnTo, router]);

  continueAfterApprovalRef.current = continueAfterApproval;

  const startStatusPoll = useCallback(() => {
    if (pollTimerRef.current) return;
    pollAttemptsRef.current = 0;
    const tick = () => {
      pollAttemptsRef.current += 1;
      void loadStatus()
        .then((next) => {
          if (
            next.status === "approved" ||
            next.status === "rejected" ||
            pollAttemptsRef.current >= POLL_MAX_ATTEMPTS
          ) {
            stopStatusPoll();
          }
        })
        .catch(() => {
          if (pollAttemptsRef.current >= POLL_MAX_ATTEMPTS) stopStatusPoll();
        });
    };
    tick();
    pollTimerRef.current = setInterval(tick, POLL_INTERVAL_MS);
  }, [loadStatus, stopStatusPoll]);

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
      void fetchAuthMe()
        .then((me) => {
          if (me) setUser(me);
        })
        .catch(() => undefined);
    } catch (e) {
      setPageError(formatKycError(e, "Could not start verification"));
    } finally {
      bootingRef.current = false;
      setBooting(false);
    }
  }, [accessToken, loadStatus, setUser]);

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

  // After approval, return to the screen that launched KYC.
  // Do not depend on `autoContinuing` — setState would re-run this effect,
  // clear the timeout in cleanup, and leave the user stuck on "Taking you back…".
  useEffect(() => {
    if (status?.status !== "approved") return;
    setAutoContinuing(true);
    const t = window.setTimeout(() => {
      continueAfterApprovalRef.current();
    }, AUTO_CONTINUE_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [status?.status]);

  useEffect(() => {
    if (!accessToken || status?.status === "approved") return;
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [accessToken, status?.status]);

  const expirationHandler = useCallback(async () => {
    const { token } = await fetchKycAccessToken();
    return token;
  }, []);

  const handleSdkMessage = useCallback(
    (type: string, payload: unknown) => {
      const answer = reviewAnswerFromPayload(payload)?.toUpperCase();
      const reviewStatus = reviewStatusFromPayload(payload)?.toLowerCase();

      if (
        type === "idCheck.onApplicantSubmitted" ||
        type === "idCheck.onApplicantResubmitted"
      ) {
        startStatusPoll();
        return;
      }

      if (
        type === "idCheck.onApplicantStatusChanged" ||
        type === "idCheck.applicantStatus" ||
        type === "idCheck.onApplicantVerificationCompleted" ||
        type === "idCheck.onApplicantReviewComplete" ||
        type === "idCheck.applicantReviewComplete" ||
        type === "idCheck.moduleResultPresented"
      ) {
        void loadStatus().catch(() => undefined);
        if (answer === "GREEN" || reviewStatus === "completed") {
          startStatusPoll();
        } else if (reviewStatus === "pending" || reviewStatus === "onhold" || reviewStatus === "queued") {
          startStatusPoll();
        }
      }
    },
    [loadStatus, startStatusPoll],
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
        {sdkActive ? null : (
          <header className="kyc-page__header">
            <h1 className="kyc-page__title">Verify your identity</h1>
            <p className="kyc-page__lead">
              We need a quick identity check before you can ship cards to the vault or redeem a
              physical card — ID (passport or driver’s license), a liveness selfie, usually 1–2
              minutes.
            </p>
          </header>
        )}

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
            <TkButton variant="primary" onClick={continueAfterApproval}>
              Continue
            </TkButton>
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
                enableScrollIntoView: false,
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

"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { TkButton } from "@/components/ds";
import { fetchAuthMe } from "@/lib/auth";
import { fetchKycAccessToken, fetchKycStatus, type KycStatusResponse } from "@/lib/kyc/api";
import { useAuthStore } from "@/store/authStore";
import { useAuthUiStore } from "@/store/authUiStore";

const SumsubWebSdk = dynamic(() => import("@sumsub/websdk-react"), { ssr: false });

export default function KycPage() {
  const router = useRouter();
  const { user, loading, initialized, setUser } = useAuthStore();
  const consumeReturnTo = useAuthUiStore((s) => s.consumeReturnTo);
  const [status, setStatus] = useState<KycStatusResponse | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [booting, setBooting] = useState(false);
  const [returnTo] = useState(() => useAuthUiStore.getState().pendingReturnTo);

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
    const path = consumeReturnTo() ?? returnTo;
    router.push(path && path.startsWith("/") ? path : "/vault");
  }, [consumeReturnTo, returnTo, router]);

  const startVerification = useCallback(async () => {
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
      await refreshSession();
    } catch (e) {
      setPageError(e instanceof Error ? e.message : "Could not start verification");
    } finally {
      setBooting(false);
    }
  }, [loadStatus, refreshSession]);

  useEffect(() => {
    if (!user) return;
    void loadStatus().catch((e) => {
      setPageError(e instanceof Error ? e.message : "Could not load KYC status");
    });
  }, [user, loadStatus]);

  useEffect(() => {
    if (!user || !status) return;
    if (status.status !== "none") return;
    void startVerification();
  }, [user, status?.status, startVerification]);

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
      <main className="tk-page tk-page--narrow">
        <p className="tk-muted">Loading…</p>
      </main>
    );
  }

  const approved = status?.status === "approved";
  const rejected = status?.status === "rejected";
  const pending = status?.status === "pending";

  return (
    <main className="tk-page tk-page--narrow">
      <header className="tk-page__header">
        <h1 className="tk-page__title">Verify your identity</h1>
        <p className="tk-page__lead">
          We need a quick identity check before you can ship cards to the vault or redeem a
          physical card — ID (passport or driver’s license), a liveness selfie, usually 1–2
          minutes.
        </p>
      </header>

      {pageError ? (
        <p className="tk-form-error" role="alert">
          {pageError}
        </p>
      ) : null}

      {approved ? (
        <section className="tk-card tk-card--pad">
          <p>
            Identity verification is complete. You can now ship cards to the vault or redeem a
            physical card.
          </p>
          <TkButton variant="primary" onClick={continueAfterApproval}>
            Continue
          </TkButton>
        </section>
      ) : null}

      {rejected ? (
        <section className="tk-card tk-card--pad">
          <p>
            We need another look
            {status?.rejectionReason ? `: ${status.rejectionReason}` : "."} Please resubmit your
            ID and liveness check.
          </p>
          <TkButton variant="primary" disabled={booting} onClick={() => void startVerification()}>
            {booting ? "Starting…" : "Try again"}
          </TkButton>
        </section>
      ) : null}

      {pending && !accessToken && !rejected ? (
        <section className="tk-card tk-card--pad">
          <p>Your verification is under review. This usually takes 1–2 minutes.</p>
          <TkButton variant="neutral" disabled={booting} onClick={() => void startVerification()}>
            {booting ? "Loading…" : "Continue verification"}
          </TkButton>
        </section>
      ) : null}

      {accessToken && !approved ? (
        <section className="tk-kyc-sdk">
          <SumsubWebSdk
            accessToken={accessToken}
            expirationHandler={expirationHandler}
            config={{ lang: "en", theme: "dark" }}
            options={{ addViewportTag: false, adaptIframeHeight: true }}
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
    </main>
  );
}

"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { TkButton } from "@/components/ds";
import { getPartnerMe, rq } from "@/lib/core";
import { useAuthStore } from "@/store/authStore";

/** Require an active marketplace partner session; otherwise show a clear CTA. */
export function PartnerGate({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const authReady = useAuthStore((s) => s.initialized && !s.loading);

  const meQuery = useQuery({
    queryKey: rq.partnerMe(),
    queryFn: getPartnerMe,
    enabled: Boolean(user && authReady),
    staleTime: 30_000,
  });

  if (!authReady) {
    return (
      <div className="partner-gate partner-gate--loading" role="status">
        Loading…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="partner-gate">
        <h1 className="partner-gate__title">Partner access</h1>
        <p className="partner-gate__copy">
          Sign in with the wallet registered as a Tokenable partner.
        </p>
        <Link href="/markets">
          <TkButton type="button" variant="primary">
            Back to Markets
          </TkButton>
        </Link>
      </div>
    );
  }

  if (meQuery.isLoading) {
    return (
      <div className="partner-gate partner-gate--loading" role="status">
        Checking partner status…
      </div>
    );
  }

  if (!meQuery.data?.isPartner) {
    return (
      <div className="partner-gate">
        <h1 className="partner-gate__title">Partner vault</h1>
        <p className="partner-gate__copy">
          This area is for companies under contract with Tokenable. Your wallet
          is not registered as an active partner.
        </p>
        <div className="partner-gate__actions">
          <Link href="/portfolio">
            <TkButton type="button" variant="subtle">
              Open portfolio
            </TkButton>
          </Link>
          <Link href="/sell">
            <TkButton type="button" variant="primary">
              Sell with PSA vault
            </TkButton>
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

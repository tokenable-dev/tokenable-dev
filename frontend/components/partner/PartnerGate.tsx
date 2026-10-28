"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { TkButton } from "@/components/ds";
import { getPartnerMe, rq } from "@/lib/core";
import { useAuthStore } from "@/store/authStore";

/** Require an active marketplace partner session; otherwise show a clear CTA. */
export function PartnerGate({ children }: { children: React.ReactNode }) {
  const t = useTranslations("Partner");
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
        {t("loading")}
      </div>
    );
  }

  if (!user) {
    return (
      <div className="partner-gate">
        <h1 className="partner-gate__title">{t("accessTitle")}</h1>
        <p className="partner-gate__copy">{t("accessCopy")}</p>
        <Link href="/markets">
          <TkButton type="button" variant="primary">
            {t("backMarkets")}
          </TkButton>
        </Link>
      </div>
    );
  }

  if (meQuery.isLoading) {
    return (
      <div className="partner-gate partner-gate--loading" role="status">
        {t("checking")}
      </div>
    );
  }

  if (!meQuery.data?.isPartner) {
    return (
      <div className="partner-gate">
        <h1 className="partner-gate__title">{t("vaultTitle")}</h1>
        <p className="partner-gate__copy">{t("vaultCopy")}</p>
        <div className="partner-gate__actions">
          <Link href="/portfolio">
            <TkButton type="button" variant="subtle">
              {t("openPortfolio")}
            </TkButton>
          </Link>
          <Link href="/sell">
            <TkButton type="button" variant="primary">
              {t("sellPsa")}
            </TkButton>
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

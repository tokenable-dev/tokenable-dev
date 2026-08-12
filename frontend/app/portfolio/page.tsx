"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PortfolioPageView } from "@/components/portfolio/PortfolioPageView";
import { useActivePartner } from "@/hooks/partner/useActivePartner";
import { portfolioUrl, PARTNER_PORTFOLIO_PATH } from "@/lib/portfolio/portfolioPaths";
import { useAuthStore } from "@/store/authStore";

/** Active partners are routed to `/partner/portfolio` (Partner-Portfolio.html). */
export default function PortfolioPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useAuthStore((s) => s.user);
  const authInitialized = useAuthStore((s) => s.initialized);
  const authLoading = useAuthStore((s) => s.loading);
  const { isActivePartner, isLoading: partnerLoading } = useActivePartner();

  useEffect(() => {
    if (!authInitialized || authLoading || !user || partnerLoading) return;
    if (!isActivePartner) return;
    const qs = searchParams.toString();
    router.replace(portfolioUrl(PARTNER_PORTFOLIO_PATH, qs || undefined));
  }, [
    authInitialized,
    authLoading,
    user,
    partnerLoading,
    isActivePartner,
    router,
    searchParams,
  ]);

  if (
    authInitialized &&
    user &&
    (partnerLoading || isActivePartner)
  ) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center bg-black">
        <span className="h-7 w-7 animate-spin rounded-full border-2 border-mint/30 border-t-mint" />
      </div>
    );
  }

  return <PortfolioPageView variant="default" />;
}

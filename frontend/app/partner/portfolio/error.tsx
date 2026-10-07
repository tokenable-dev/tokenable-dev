"use client";

import { AppRouteError } from "@/components/ui/AppRouteError";

export default function PartnerPortfolioError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <AppRouteError error={error} reset={reset} kind="portfolio_crash" />;
}

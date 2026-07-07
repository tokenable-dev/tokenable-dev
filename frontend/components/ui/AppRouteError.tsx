"use client";

import { AppPageState } from "@/components/ui/AppPageState";
import {
  formatErrorDetails,
  type AppPageStateKind,
} from "@/lib/ui/page-state-catalog";

type AppRouteErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
  kind: AppPageStateKind;
  message?: string;
};

export function AppRouteError({ error, reset, kind, message }: AppRouteErrorProps) {
  if (process.env.NODE_ENV === "development") {
    console.error(`[route-error:${kind}]`, error);
  }

  const showDetails = process.env.NODE_ENV === "development";
  const secondaryHref =
    kind === "portfolio_crash" ? "/markets" : kind === "markets_crash" ? "/portfolio" : "/markets";
  const secondaryLabel =
    kind === "portfolio_crash" ? "Markets" : kind === "markets_crash" ? "Portfolio" : "Markets";

  return (
    <div className="min-h-[50vh] px-4 py-10 text-white">
      <AppPageState
        kind={kind}
        message={message}
        primaryAction={{ label: "Try again", onClick: reset, variant: "primary" }}
        secondaryAction={{ label: secondaryLabel, href: secondaryHref, variant: "neutral" }}
        details={showDetails ? formatErrorDetails(error) : null}
      />
    </div>
  );
}

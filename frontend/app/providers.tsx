"use client";

import { installPrivyDevAnalyticsSuppressor } from "@/lib/privy/suppressDevAnalytics";
import { PrivyAppProviders } from "@/lib/privy";

installPrivyDevAnalyticsSuppressor();

export function Providers({ children }: { children: React.ReactNode }) {
  return <PrivyAppProviders>{children}</PrivyAppProviders>;
}

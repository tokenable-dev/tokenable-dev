"use client";

import { installPrivyDevAnalyticsSuppressor } from "@/lib/privy/suppressDevAnalytics";
import { PrivyAppProviders } from "@/lib/privy";
import { DisplayPreferencesProvider } from "@/components/i18n/DisplayPreferencesProvider";

installPrivyDevAnalyticsSuppressor();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <DisplayPreferencesProvider>
      <PrivyAppProviders>{children}</PrivyAppProviders>
    </DisplayPreferencesProvider>
  );
}

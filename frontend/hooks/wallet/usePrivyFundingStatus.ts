"use client";

import { useQuery } from "@tanstack/react-query";
import { backendFetch, getApiUrl } from "@/lib/core/api/client";
import type { PrivyFundingSettingsResponse } from "@/lib/privy/funding";

async function fetchPrivyFundingSettings(): Promise<PrivyFundingSettingsResponse> {
  const res = await backendFetch(`${getApiUrl()}/privy/apps/settings`);
  if (!res.ok) {
    throw new Error(`Failed to load Privy funding settings (${res.status})`);
  }
  return res.json() as Promise<PrivyFundingSettingsResponse>;
}

/** Server-backed check of Privy Dashboard funding configuration (via `GET /api/privy/apps/settings`). */
export function usePrivyFundingStatus() {
  const query = useQuery({
    queryKey: ["privy", "funding", "settings"],
    queryFn: fetchPrivyFundingSettings,
    staleTime: 60_000,
    retry: 1,
  });

  return {
    ready: query.data?.fundingReadiness.ready ?? null,
    chainAligned: query.data?.fundingReadiness.chainAligned ?? null,
    moonpayEnabled: query.data?.fundingReadiness.moonpayEnabled ?? null,
    defaultRecommendedChain: query.data?.fundingReadiness.defaultRecommendedChain ?? null,
    checklist: query.data?.fundingReadiness.dashboardChecklist ?? [],
    dashboardUrl: query.data?.fundingReadiness.dashboardUrl ?? "https://dashboard.privy.io/apps?page=funding",
    methods: query.data?.fundingReadiness.methods ?? [],
    providers: query.data?.fundingReadiness.providers ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

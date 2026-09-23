"use client";

import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { isSiteAccessGatePath } from "@/constants/layout";

type SiteAccessStatus = { enabled: boolean; granted: boolean };

async function fetchSiteAccessStatus(): Promise<SiteAccessStatus> {
  const res = await fetch("/api/site-access/status", { credentials: "include" });
  if (!res.ok) {
    return { enabled: true, granted: false };
  }
  return (await res.json()) as SiteAccessStatus;
}

/**
 * Wallet-only email capture and similar modals must not appear on `/site-access`
 * (Privy can stay logged in while the staging password cookie is missing/expired).
 */
export function useSiteAccessAllowsAppModals(): boolean {
  const pathname = usePathname();
  const onGatePage = isSiteAccessGatePath(pathname);

  const { data } = useQuery({
    queryKey: ["site-access-status"],
    queryFn: fetchSiteAccessStatus,
    enabled: !onGatePage,
    staleTime: 30_000,
  });

  if (onGatePage) return false;
  if (!data) return false;
  if (!data.enabled) return true;
  return data.granted;
}

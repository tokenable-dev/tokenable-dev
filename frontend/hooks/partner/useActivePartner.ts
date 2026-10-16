"use client";

import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { shouldHideAppChrome } from "@/constants/layout";
import { getPartnerMe, rq } from "@/lib/core";
import { useTokenableSessionActive } from "@/lib/auth/sessionActive";
import { useAuthStore } from "@/store/authStore";

/** True when the signed-in user has an active partner vault (same gate as PartnerGate). */
export function useActivePartner() {
  const initialized = useAuthStore((s) => s.initialized);
  const sessionActive = useTokenableSessionActive();
  const pathname = usePathname();

  const query = useQuery({
    queryKey: rq.partnerMe(),
    queryFn: getPartnerMe,
    enabled:
      initialized && sessionActive && !shouldHideAppChrome(pathname),
    staleTime: 60_000,
  });

  return {
    ...query,
    isActivePartner: Boolean(query.data?.isPartner),
    partnerId: query.data?.partnerId ?? null,
  };
}

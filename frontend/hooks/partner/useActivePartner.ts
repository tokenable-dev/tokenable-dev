"use client";

import { useQuery } from "@tanstack/react-query";
import { getPartnerMe, rq } from "@/lib/core";
import { useAuthStore } from "@/store/authStore";

/** True when the signed-in user has an active partner vault (same gate as PartnerGate). */
export function useActivePartner() {
  const user = useAuthStore((s) => s.user);
  const initialized = useAuthStore((s) => s.initialized);

  const query = useQuery({
    queryKey: rq.partnerMe(),
    queryFn: getPartnerMe,
    enabled: initialized && Boolean(user),
    staleTime: 60_000,
  });

  return {
    ...query,
    isActivePartner: Boolean(query.data?.isPartner),
    partnerId: query.data?.partnerId ?? null,
  };
}

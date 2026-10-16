"use client";

import { useMutation } from "@tanstack/react-query";
import {
  analyzePsaByCertForAdmin,
  analyzePsaSlabForAdmin,
} from "@/lib/core/api/marketplace-admin-psa";

/** Mint-only PSA hooks — raw Public API proxies are disabled server-side. */
export function useMarketplaceAdminPsaVault() {
  const analyzeByCertMutation = useMutation({
    mutationFn: analyzePsaByCertForAdmin,
  });
  const analyzeSlabMutation = useMutation({
    mutationFn: ({
      slabFront,
      slabBack,
      certHint,
    }: {
      slabFront: File;
      slabBack?: File | null;
      certHint?: string;
    }) => analyzePsaSlabForAdmin(slabFront, slabBack, certHint),
  });

  return {
    analyzeByCertMutation,
    analyzeSlabMutation,
  };
}

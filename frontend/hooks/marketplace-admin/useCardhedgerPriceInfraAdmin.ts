"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getCardhedgerPriceInfraStatus,
  runCardhedgerDeltaImport,
} from "@/lib/core/api/marketplace-admin-cardhedger";

const statusKey = ["admin", "cardhedger", "price-infra", "status"] as const;

export function useCardhedgerPriceInfraAdmin() {
  const queryClient = useQueryClient();

  const statusQuery = useQuery({
    queryKey: statusKey,
    queryFn: getCardhedgerPriceInfraStatus,
  });

  const deltaMutation = useMutation({
    mutationFn: runCardhedgerDeltaImport,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: statusKey }),
  });

  return { statusQuery, deltaMutation };
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getAdminDataInventory,
  getAdminDataInventorySchema,
  getAdminDataInventoryTableRows,
  getAdminResetTargets,
  postAdminResetForNewContract,
  rq,
} from "@/lib/core";

export function useMarketplaceAdminDataInventory() {
  return useQuery({
    queryKey: rq.adminDataInventory(),
    queryFn: getAdminDataInventory,
  });
}

export function useMarketplaceAdminDataInventorySchema() {
  return useQuery({
    queryKey: [...rq.adminDataInventory(), "schema"] as const,
    queryFn: getAdminDataInventorySchema,
  });
}

export function useMarketplaceAdminDataInventoryRows(
  table: string | null,
  page: number,
  pageSize: number,
  enabled: boolean,
  compact = false,
) {
  return useQuery({
    queryKey: [
      ...rq.adminDataInventory(),
      "rows",
      table,
      page,
      pageSize,
      compact,
    ],
    queryFn: () =>
      getAdminDataInventoryTableRows(table!, page, pageSize, compact),
    enabled: Boolean(enabled && table),
  });
}

export function useMarketplaceAdminResetTargets() {
  return useQuery({
    queryKey: [...rq.adminDataInventory(), "reset-targets"] as const,
    queryFn: getAdminResetTargets,
  });
}

export function useMarketplaceAdminResetForNewContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: postAdminResetForNewContract,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: rq.adminDataInventory() });
    },
  });
}

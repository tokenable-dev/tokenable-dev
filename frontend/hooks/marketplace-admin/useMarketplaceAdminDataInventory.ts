import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getAdminDataInventory,
  getAdminDataInventoryTableRows,
  postAdminResetForNewContract,
  rq,
} from "@/lib/core";

export function useMarketplaceAdminDataInventory() {
  return useQuery({
    queryKey: rq.adminDataInventory(),
    queryFn: getAdminDataInventory,
  });
}

export function useMarketplaceAdminDataInventoryRows(
  table: string | null,
  page: number,
  pageSize: number,
  enabled: boolean,
) {
  return useQuery({
    queryKey: [...rq.adminDataInventory(), "rows", table, page, pageSize],
    queryFn: () => getAdminDataInventoryTableRows(table!, page, pageSize),
    enabled: Boolean(enabled && table),
  });
}

export function useMarketplaceAdminResetForNewContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (password: string) => postAdminResetForNewContract(password),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: rq.adminDataInventory() });
    },
  });
}

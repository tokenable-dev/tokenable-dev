"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getActiveAsksByOfferer, rq, marketplaceRqPolicy, type OrderListItem } from "@/lib/core";
import { activeRqChainId } from "@/lib/chains";

const EMPTY_ORDER_LIST: OrderListItem[] = [];

/** Active asks for the portfolio wallet (listings tab + collection-key overrides). */
export function usePortfolioActiveOrders(
  address: string | undefined,
  enabled: boolean,
) {
  const chainId = activeRqChainId();

  const ordersQuery = useQuery({
    queryKey: rq.ordersByOfferer(address ?? "", "ask", chainId),
    queryFn: () => getActiveAsksByOfferer(address!),
    enabled: enabled && Boolean(address?.trim()),
    refetchInterval: marketplaceRqPolicy.ordersRefetchMs,
    staleTime: marketplaceRqPolicy.ordersStaleMs,
  });

  const activeOrders = useMemo(
    () => ordersQuery.data ?? EMPTY_ORDER_LIST,
    [ordersQuery.data],
  );

  return {
    activeOrders,
    refetchActiveOrders: () => ordersQuery.refetch(),
  };
}

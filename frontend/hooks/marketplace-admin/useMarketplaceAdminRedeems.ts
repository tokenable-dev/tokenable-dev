"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  adminPurgeAllRedeems,
  adminRefundRedeemFull,
  adminRefundRedeemUsdc,
  adminReturnRedeemNft,
  adminUpdateRedeemMemo,
  adminUpdateRedeemMemoBatch,
  adminUpdateRedeemTracking,
  adminUpdateRedeemTrackingBatch,
  listAdminRedeems,
  rq,
} from "@/lib/core";

export function useMarketplaceAdminRedeems(status?: string) {
  return useQuery({
    queryKey: rq.adminRedeems(status),
    queryFn: () =>
      listAdminRedeems({
        status: status || undefined,
        limit: 100,
      }),
    staleTime: 10_000,
  });
}

export function useAdminRedeemActions() {
  const queryClient = useQueryClient();
  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: ["admin-redeems"] });

  const updateMemo = useMutation({
    mutationFn: (input: { id: string; memo: string }) =>
      adminUpdateRedeemMemo(input.id, input.memo),
    onSuccess: invalidate,
  });

  const updateMemoBatch = useMutation({
    mutationFn: (input: { batchId: string; memo: string }) =>
      adminUpdateRedeemMemoBatch(input.batchId, input.memo),
    onSuccess: invalidate,
  });

  const updateTracking = useMutation({
    mutationFn: (input: {
      id: string;
      trackingNumber: string;
      trackingCarrier?: string;
    }) =>
      adminUpdateRedeemTracking(input.id, {
        trackingNumber: input.trackingNumber,
        trackingCarrier: input.trackingCarrier,
      }),
    onSuccess: invalidate,
  });

  const updateTrackingBatch = useMutation({
    mutationFn: (input: {
      batchId: string;
      shipmentKey: string;
      trackingNumber: string;
      trackingCarrier?: string;
    }) =>
      adminUpdateRedeemTrackingBatch(input.batchId, {
        shipmentKey: input.shipmentKey,
        trackingNumber: input.trackingNumber,
        trackingCarrier: input.trackingCarrier,
      }),
    onSuccess: invalidate,
  });

  const refundUsdc = useMutation({
    mutationFn: (batchId: string) => adminRefundRedeemUsdc(batchId),
    onSuccess: invalidate,
  });

  const returnNft = useMutation({
    mutationFn: (id: string) => adminReturnRedeemNft(id),
    onSuccess: invalidate,
  });

  const refundFull = useMutation({
    mutationFn: (batchId: string) => adminRefundRedeemFull(batchId),
    onSuccess: invalidate,
  });

  const purgeAll = useMutation({
    mutationFn: () => adminPurgeAllRedeems(),
    onSuccess: invalidate,
  });

  return {
    updateMemo,
    updateMemoBatch,
    updateTracking,
    updateTrackingBatch,
    refundUsdc,
    returnNft,
    refundFull,
    purgeAll,
  };
}

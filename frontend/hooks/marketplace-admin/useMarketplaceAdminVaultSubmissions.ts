"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  adminConfirmPsaArrivalReview,
  adminDismissPsaArrivalReview,
  adminInjectPsaReceivedTestMail,
  adminMarkVaultSubmissionArrived,
  adminMintAndDeliverVaultItem,
  adminSetVaultSubmissionItemStatus,
  adminSetVaultSubmissionStatus,
  getAdminVaultSubmission,
  getAdminVaultSubmissionCounts,
  listAdminPsaArrivalReviews,
  listAdminVaultMintQueue,
  listAdminVaultSubmissions,
  rq,
} from "@/lib/core";

export function useAdminVaultSubmissionCounts() {
  return useQuery({
    queryKey: rq.adminVaultSubmissionCounts(),
    queryFn: () => getAdminVaultSubmissionCounts(),
    staleTime: 10_000,
    refetchInterval: 20_000,
  });
}

export function useAdminPsaArrivalReviews(
  status: "pending" | "confirmed" | "dismissed" = "pending",
) {
  return useQuery({
    queryKey: rq.adminPsaArrivalReviews(status),
    queryFn: () => listAdminPsaArrivalReviews(status),
    staleTime: 8_000,
    refetchInterval: 15_000,
  });
}

export function useAdminVaultMintQueue(q: string) {
  return useQuery({
    queryKey: rq.adminVaultMintQueue(q),
    queryFn: () => listAdminVaultMintQueue({ q: q.trim() || undefined }),
    staleTime: 8_000,
    refetchInterval: 15_000,
  });
}

export function useAdminVaultSubmissions(status: string, q: string) {
  return useQuery({
    queryKey: rq.adminVaultSubmissions(status, q),
    queryFn: () =>
      listAdminVaultSubmissions({
        status: status === "all" ? undefined : status,
        q: q.trim() || undefined,
      }),
    staleTime: 8_000,
    refetchInterval: 15_000,
  });
}

export function useAdminVaultSubmissionDetail(id: string | null) {
  return useQuery({
    queryKey: rq.adminVaultSubmission(id ?? ""),
    queryFn: () => getAdminVaultSubmission(id!),
    enabled: Boolean(id),
    staleTime: 5_000,
  });
}

export function useAdminVaultSubmissionMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["admin-vault-submissions"] });
    void qc.invalidateQueries({ queryKey: ["admin-vault-submission-counts"] });
    void qc.invalidateQueries({ queryKey: ["admin-vault-submission"] });
    void qc.invalidateQueries({ queryKey: ["admin-psa-arrival-reviews"] });
    void qc.invalidateQueries({ queryKey: ["admin-vault-mint-queue"] });
    void qc.invalidateQueries({ queryKey: ["admin-custody-nfts"] });
  };

  const markArrived = useMutation({
    mutationFn: (id: string) => adminMarkVaultSubmissionArrived(id),
    onSuccess: invalidate,
  });
  const setStatus = useMutation({
    mutationFn: (p: { id: string; status: string }) =>
      adminSetVaultSubmissionStatus(p.id, p.status),
    onSuccess: invalidate,
  });
  const setItemStatus = useMutation({
    mutationFn: (p: {
      id: string;
      itemId: string;
      status: string;
      rejectionReason?: string;
    }) =>
      adminSetVaultSubmissionItemStatus(p.id, p.itemId, {
        status: p.status,
        rejectionReason: p.rejectionReason,
      }),
    onSuccess: invalidate,
  });
  const confirmArrivalReview = useMutation({
    mutationFn: (reviewId: string) => adminConfirmPsaArrivalReview(reviewId),
    onSuccess: invalidate,
  });
  const dismissArrivalReview = useMutation({
    mutationFn: (reviewId: string) => adminDismissPsaArrivalReview(reviewId),
    onSuccess: invalidate,
  });
  const injectTestMail = useMutation({
    mutationFn: (input: { cert: string; cardLabel?: string }) =>
      adminInjectPsaReceivedTestMail(input),
    onSuccess: invalidate,
  });
  const mintAndDeliver = useMutation({
    mutationFn: (p: { id: string; itemId: string }) =>
      adminMintAndDeliverVaultItem(p.id, p.itemId),
    onSuccess: invalidate,
  });

  return {
    markArrived,
    setStatus,
    setItemStatus,
    confirmArrivalReview,
    dismissArrivalReview,
    injectTestMail,
    mintAndDeliver,
  };
}

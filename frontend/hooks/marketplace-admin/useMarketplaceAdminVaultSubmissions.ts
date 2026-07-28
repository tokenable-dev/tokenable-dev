"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  adminMarkVaultSubmissionArrived,
  adminSetVaultSubmissionItemStatus,
  adminSetVaultSubmissionStatus,
  getAdminVaultSubmission,
  getAdminVaultSubmissionCounts,
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

  return { markArrived, setStatus, setItemStatus };
}

"use client";

import { useMutation } from "@tanstack/react-query";
import {
  analyzePsaByCertForAdmin,
  analyzePsaSlabForAdmin,
  getPsaOrderProgress,
  getPsaPublicCert,
  getPsaPublicCertFileAppend,
  getPsaPublicCertImages,
  getPsaPublicSpecPopulation,
  getPsaSubmissionProgress,
} from "@/lib/core/api/marketplace-admin-psa";

export function useMarketplaceAdminPsaVault() {
  const orderProgressMutation = useMutation({
    mutationFn: getPsaOrderProgress,
  });
  const submissionProgressMutation = useMutation({
    mutationFn: getPsaSubmissionProgress,
  });
  const certMutation = useMutation({
    mutationFn: getPsaPublicCert,
  });
  const fileAppendMutation = useMutation({
    mutationFn: getPsaPublicCertFileAppend,
  });
  const imagesMutation = useMutation({
    mutationFn: getPsaPublicCertImages,
  });
  const populationMutation = useMutation({
    mutationFn: getPsaPublicSpecPopulation,
  });
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
    orderProgressMutation,
    submissionProgressMutation,
    certMutation,
    fileAppendMutation,
    imagesMutation,
    populationMutation,
    analyzeByCertMutation,
    analyzeSlabMutation,
  };
}

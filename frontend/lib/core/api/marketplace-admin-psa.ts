import { throwIfPsaResponseNotOk } from "@/lib/psa/psaApiErrors";
import type { PsaOrderProgressLookupResponse } from "@/lib/psa/psaOrderProgressDisplay";
import type { PsaAnalyzeResult } from "./psa";
import { backendFetch, getApiUrl } from "./client";

export type PsaCertPublicApiLookupResponse = {
  status: "success" | "error" | "disabled" | "skipped";
  certNumber?: string;
  raw?: unknown;
  psaPath?: string;
  reason?: string;
  message?: string;
  httpStatus?: number;
};

export type PsaCertImagesLookupResponse = {
  status: "success" | "error" | "disabled" | "skipped";
  certNumber?: string;
  raw?: unknown;
  psaPath?: string;
  reason?: string;
  message?: string;
  httpStatus?: number;
};

export type PsaSpecPopulationLookupResponse = {
  status: "success" | "error" | "disabled" | "skipped";
  specId?: string;
  pop?: {
    grade10: number | null;
    total: number | null;
    byGrade: Record<string, number>;
  };
  raw?: unknown;
  psaPath?: string;
  reason?: string;
  message?: string;
  httpStatus?: number;
};

async function psaGet<T>(path: string): Promise<T> {
  const res = await backendFetch(`${getApiUrl()}${path}`);
  await throwIfPsaResponseNotOk(res);
  return res.json() as Promise<T>;
}

export function getPsaPublicCert(certNumber: string): Promise<PsaCertPublicApiLookupResponse> {
  const cert = encodeURIComponent(certNumber.trim());
  return psaGet(`/psa/public/cert/${cert}`);
}

export function getPsaPublicCertFileAppend(
  certNumber: string,
): Promise<PsaCertPublicApiLookupResponse> {
  const cert = encodeURIComponent(certNumber.trim());
  return psaGet(`/psa/public/cert/${cert}/file-append`);
}

export function getPsaPublicCertImages(
  certNumber: string,
): Promise<PsaCertImagesLookupResponse> {
  const cert = encodeURIComponent(certNumber.trim());
  return psaGet(`/psa/public/cert/${cert}/images`);
}

export function getPsaPublicSpecPopulation(
  specId: string,
): Promise<PsaSpecPopulationLookupResponse> {
  const id = encodeURIComponent(specId.trim());
  return psaGet(`/psa/public/pop/${id}`);
}

export function getPsaOrderProgress(
  orderNumber: string,
): Promise<PsaOrderProgressLookupResponse> {
  const num = encodeURIComponent(orderNumber.trim());
  return psaGet(`/psa/order/progress/${num}`);
}

export function getPsaSubmissionProgress(
  submissionNumber: string,
): Promise<PsaOrderProgressLookupResponse> {
  const num = encodeURIComponent(submissionNumber.trim());
  return psaGet(`/psa/order/submission-progress/${num}`);
}

export async function analyzePsaByCertForAdmin(
  certNumber: string,
): Promise<PsaAnalyzeResult> {
  const res = await backendFetch(`${getApiUrl()}/psa/analyze-by-cert`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ certNumber: certNumber.trim() }),
  });
  await throwIfPsaResponseNotOk(res);
  return res.json() as Promise<PsaAnalyzeResult>;
}

export async function analyzePsaSlabForAdmin(
  slabFront: File,
  slabBack?: File | null,
  certHint?: string,
): Promise<PsaAnalyzeResult> {
  const fd = new FormData();
  fd.append("slabFront", slabFront);
  if (slabBack) fd.append("slabBack", slabBack);
  if (certHint?.trim()) fd.append("certNumber", certHint.trim());
  const res = await backendFetch(`${getApiUrl()}/psa/analyze`, {
    method: "POST",
    body: fd,
  });
  await throwIfPsaResponseNotOk(res);
  return res.json() as Promise<PsaAnalyzeResult>;
}

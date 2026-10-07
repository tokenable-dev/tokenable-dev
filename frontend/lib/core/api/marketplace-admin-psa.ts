import { throwIfPsaResponseNotOk } from "@/lib/psa/psaApiErrors";
import type { PsaAnalyzeResult } from "./psa";
import { backendFetch, getApiUrl } from "./client";

export async function analyzePsaByCertForAdmin(
  certNumber: string,
): Promise<PsaAnalyzeResult> {
  const res = await backendFetch(`${getApiUrl()}/psa/analyze-by-cert`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ certNumber: certNumber.trim() }),
    timeoutMs: 55_000,
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
    timeoutMs: 55_000,
  });
  await throwIfPsaResponseNotOk(res);
  return res.json() as Promise<PsaAnalyzeResult>;
}

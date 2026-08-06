import { throwIfPsaResponseNotOk } from "@/lib/psa/psaApiErrors";
import { backendFetch, getApiUrl } from "./client";

export type PsaPublicApiLookup =
  | { status: "disabled"; reason: "no_token" }
  | { status: "skipped"; reason: "no_cert" | "invalid_cert" }
  | { status: "success"; certNumber: string; raw: unknown }
  | {
      status: "error";
      certNumber: string;
      message: string;
      httpStatus?: number;
    };

export interface PsaAnalyzeResult {
  ocr: {
    combinedText: string;
    frontText?: string;
    backText?: string;
  };
  psa: {
    certNumber?: string;
    gradeLabel?: string;
    gradeScore?: number;
    gradeDescription?: string;
    year?: string;
    cardNameHint?: string;
    cardNumberHint?: string;
    setHint?: string;
    certVerifyUrl?: string;
    labelType?: string;
    category?: string;
    autographGrade?: string;
    totalPopulation?: number;
    populationHigher?: number;
    totalPopulationWithQualifier?: number;
    reverseBarcode?: boolean;
    specId?: number;
    /** PSA Public API — PSACert.Variety (parallel / insert line) */
    varietyHint?: string;
    /** PSA Public API PSACert 병합 여부 */
    enrichedFromOfficialApi?: boolean;
  };
  psaApi: {
    lookup: PsaPublicApiLookup;
  };
  /** Cardhedger catalog id — persist as graded.cardhedger on mint */
  cardhedgerMint?: {
    matchConfidence: "verified" | "approximate";
    cardId?: string;
    searchQuery?: string;
    imageUrl?: string;
    /** Headline USD when resolved via prices-by-cert-ocr (Phase 5). */
    priceUsd?: number;
    priceSource?: "cardhedger_prices_by_cert_ocr";
  };
  /** PSA cert-images 등 — 앞면 URL은 민팅 시 imageUrl로 쓸 수 있음 */
  psaCertImages?: { front?: string; back?: string };
}

/** 슬랩 앞면 필수 — OCR 후 PSA 공식 메타 병합 */
export async function analyzePsaSlab(
  slabFront: File,
  slabBack?: File | null,
  /** OCR이 Cert를 못 읽을 때: 숫자 또는 psacard.com/cert/… URL (PSA API 조회 우선) */
  certHint?: string
): Promise<PsaAnalyzeResult> {
  const fd = new FormData();
  fd.append("slabFront", slabFront);
  if (slabBack) fd.append("slabBack", slabBack);
  if (certHint?.trim()) fd.append("certNumber", certHint.trim());
  // Slab OCR + Cardhedger can exceed the default 25s API budget; nginx allows 60s.
  const res = await backendFetch(`${getApiUrl()}/psa/analyze`, {
    method: "POST",
    body: fd,
    timeoutMs: 55_000,
  });
  await throwIfPsaResponseNotOk(res);
  return res.json() as Promise<PsaAnalyzeResult>;
}

/** 슬랩 사진 없이 Cert 번호(또는 psacard.com/cert/ URL)만으로 PSA 조회 */
export async function analyzePsaByCertNumber(
  certNumberOrUrl: string
): Promise<PsaAnalyzeResult> {
  const res = await backendFetch(`${getApiUrl()}/psa/analyze-by-cert`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ certNumber: certNumberOrUrl.trim() }),
    timeoutMs: 55_000,
  });
  await throwIfPsaResponseNotOk(res);
  return res.json() as Promise<PsaAnalyzeResult>;
}

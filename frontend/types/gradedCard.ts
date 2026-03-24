/** Grading companies supported by the marketplace */
export type GradingCompany =
  | "PSA"
  | "BGS"
  | "CGC"
  | "SGC"
  | "TAG"
  | "AGS";

/** Metadata structure for graded trading card NFTs (ready for Web3/IPFS) */
export interface GradedCardMetadata {
  name: string;
  description?: string;
  image: string;
  gradingCompany?: string;
  card?: {
    name?: string;
    player?: string;
    year?: number;
    set?: string;
    number?: string;
  };
  grade?: {
    score?: number;
    certNumber?: string;
    subgrades?: Record<string, string | number | boolean>;
  };
  verification?: {
    certUrl?: string;
    slabFront?: string;
    slabBack?: string;
  };
  /** JustTCG 검색 스냅샷 (민팅 시점) */
  justtcg?: {
    queryUsed: string;
    topMatch?: unknown;
  };
  /** PSA 파이프라인에서 채운 필드 (cert, gradeLabel 등) */
  psa?: {
    certNumber?: string;
    gradeLabel?: string;
    gradeScore?: number;
    gradeDescription?: string;
    certVerifyUrl?: string;
    cardNameHint?: string;
    setHint?: string;
    cardNumberHint?: string;
    year?: string;
    labelType?: string;
    category?: string;
    autographGrade?: string;
    totalPopulation?: number;
    populationHigher?: number;
    totalPopulationWithQualifier?: number;
    reverseBarcode?: boolean;
    specId?: number;
    /** 서버에 PSA_PUBLIC_API_TOKEN이 있고 Cert 조회에 성공한 경우 */
    enrichedFromOfficialApi?: boolean;
  };
  /** PSA 공식 API 조회 요약 (토큰 없으면 disabled) */
  psaApi?: {
    status: string;
    certNumber?: string;
    message?: string;
  };
}

/** Form state for the mint form (includes File objects before upload) */
export interface GradedCardFormState {
  name: string;
  description: string;
  image: File | string | null;
  gradingCompany: GradingCompany | "";
  card: {
    name: string;
    player: string;
    year: string;
    set: string;
    number: string;
  };
  grade: {
    certNumber: string;
    score: string;
    subgrades: Record<string, string | number | boolean>;
  };
  verification: {
    certUrl: string;
    slabFront: File | string | null;
    slabBack: File | string | null;
  };
}

/** Company-specific field configs */
/** 플랫폼 기본: PSA 슬랩 카드만 등록 */
export const GRADING_COMPANIES: { value: GradingCompany; label: string }[] = [
  { value: "PSA", label: "PSA (default)" },
  { value: "BGS", label: "BGS (Beckett Grading Services)" },
  { value: "CGC", label: "CGC Cards" },
  { value: "SGC", label: "SGC" },
  { value: "TAG", label: "TAG" },
  { value: "AGS", label: "AGS" },
];

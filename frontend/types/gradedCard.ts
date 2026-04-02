/** Grading companies supported by the marketplace */
export type GradingCompany =
  | "PSA"
  | "BGS"
  | "CGC"
  | "SGC"
  | "TAG"
  | "AGS";

/** Metadata structure for graded trading card RWAs (ready for Web3/IPFS) */
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
  /** JustTCG search snapshot at mint time */
  justtcg?: {
    queryUsed: string;
    topMatch?: unknown;
  };
  /** Collection cover on IPFS after server trims slab top (mint response) */
  collectionCoverImage?: string;
  /** Fields filled by the PSA pipeline (cert, gradeLabel, etc.) */
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
    /** True when PSA_PUBLIC_API_TOKEN is set and cert lookup succeeded */
    enrichedFromOfficialApi?: boolean;
    /** Source URL for PSA cert image before IPFS upload (mint RWA image) */
    certImageSourceUrl?: string;
  };
  /** PSA public API lookup summary (disabled without token) */
  psaApi?: {
    status: string;
    certNumber?: string;
    message?: string;
  };
}

/** Fields populated from PSA analysis — read-only in mint form when locked */
export type PsaFieldLocks = {
  certNumber: boolean;
  score: boolean;
  cardName: boolean;
  player: boolean;
  year: boolean;
  set: boolean;
  number: boolean;
  certUrl: boolean;
  assetName: boolean;
  labelType: boolean;
  psaCategory: boolean;
  autographGrade: boolean;
  psaPopulation: boolean;
  psaPopHigher: boolean;
  /** Lock after successful analysis so grading company cannot change */
  gradingCompany: boolean;
};

export const EMPTY_PSA_FIELD_LOCKS: PsaFieldLocks = {
  certNumber: false,
  score: false,
  cardName: false,
  player: false,
  year: false,
  set: false,
  number: false,
  certUrl: false,
  assetName: false,
  labelType: false,
  psaCategory: false,
  autographGrade: false,
  psaPopulation: false,
  psaPopHigher: false,
  gradingCompany: false,
};

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

/** Mint UI: only PSA is offered today (other GradingCompany values kept for metadata compatibility) */
export const GRADING_COMPANIES: { value: GradingCompany; label: string }[] = [
  { value: "PSA", label: "PSA" },
];

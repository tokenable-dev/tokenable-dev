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
export const GRADING_COMPANIES: { value: GradingCompany; label: string }[] = [
  { value: "PSA", label: "PSA" },
  { value: "BGS", label: "BGS (Beckett Grading Services)" },
  { value: "CGC", label: "CGC Cards" },
  { value: "SGC", label: "SGC" },
  { value: "TAG", label: "TAG" },
  { value: "AGS", label: "AGS" },
];

import type { GradedCardFormState } from "@/types/gradedCard";

export type MintFormStep = "idle" | "uploading" | "minting" | "success" | "error";

export type PsaInputMode = "slab" | "cert";

/** Sell page: hide Mint image / Asset listing / Card and PSA accordions. */
export const SHOW_VAULT_COLLAPSIBLE_SECTIONS = false;

export const MINT_FORM_INITIAL_STATE: GradedCardFormState = {
  name: "",
  description: "",
  image: null,
  gradingCompany: "PSA",
  card: {
    name: "",
    player: "",
    year: "",
    set: "",
    number: "",
  },
  grade: {
    certNumber: "",
    score: "",
    subgrades: {},
  },
  verification: {
    certUrl: "",
    slabFront: null,
    slabBack: null,
  },
};

export type MintFriendlyError = {
  title: string;
  message: string;
  hints: string[];
};

import type { VaultStepDef } from "@/lib/vault/vaultStepSpec";

export type VaultDetailScenarioKey = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "early";

export type VaultDetailHeroTone = "muted" | "amber" | "info" | "success" | "danger";

export type VaultPackageCardStatus =
  | "reviewing"
  | "approved"
  | "rejected"
  | "completed"
  | "failed";

export type VaultPackageCard = {
  id: number;
  name: string;
  imageUrl: string;
  grade: string;
  cert: string;
  status: VaultPackageCardStatus;
  token?: string;
  reason?: string;
  submittedGrade?: string;
};

export type VaultDetailScenario = {
  key: VaultDetailScenarioKey;
  layout: "A" | "B";
  stage?: "vault" | "mint";
  pillCols?: 2 | 3;
  hero: {
    tone: VaultDetailHeroTone;
    icon: "draft" | "clock" | "spin" | "check" | "x";
    title: string;
    sub: string;
  };
  steps: VaultStepDef[];
  ship?: "pending" | "intransit" | null;
  notif: string;
  cta: { label: string; href: string; primary?: boolean }[];
};

const P = "pending" as const;
const POS = "pos" as const;
const AZ = "azure" as const;
const NEG = "neg" as const;
const DIM = "dim" as const;

export const VAULT_DETAIL_SCENARIOS: Record<Exclude<VaultDetailScenarioKey, "early">, VaultDetailScenario> = {
  A: {
    key: "A",
    layout: "A",
    hero: {
      tone: "muted",
      icon: "draft",
      title: "Draft Submission",
      sub: "Saved — not submitted yet. Continue when you're ready.",
    },
    steps: [
      { label: "Submit", state: "active", sub: "DRAFT", subColor: DIM },
      { label: "Ship", state: P },
      { label: "Vault", state: P },
      { label: "Mint", state: P },
    ],
    notif: "We'll save your progress until you submit.",
    cta: [
      { label: "Continue Submission →", href: "/vault/submit", primary: true },
      { label: "Back to Vault", href: "/vault" },
    ],
  },
  B: {
    key: "B",
    layout: "A",
    hero: {
      tone: "amber",
      icon: "clock",
      title: "Awaiting Shipment",
      sub: "Register a tracking number to move your submission forward.",
    },
    steps: [
      { label: "Submit", state: "done", sub: "SUBMITTED", subColor: POS },
      { label: "Ship", state: "active", sub: "PENDING", subColor: DIM },
      { label: "Vault", state: P },
      { label: "Mint", state: P },
    ],
    ship: "pending",
    notif: "We'll notify you by email once we receive your package.",
    cta: [{ label: "Back to Vault", href: "/vault" }],
  },
  C: {
    key: "C",
    layout: "A",
    hero: {
      tone: "info",
      icon: "spin",
      title: "In Transit",
      sub: "Your package is on the way to our vault facility.",
    },
    steps: [
      { label: "Submit", state: "done", sub: "SUBMITTED", subColor: POS },
      { label: "Ship", state: "active", sub: "IN TRANSIT", subColor: AZ },
      { label: "Vault", state: P },
      { label: "Mint", state: P },
    ],
    ship: "intransit",
    notif: "We'll notify you by email when your package arrives.",
    cta: [{ label: "Back to Vault", href: "/vault" }],
  },
  D: {
    key: "D",
    layout: "B",
    stage: "vault",
    pillCols: 3,
    hero: {
      tone: "info",
      icon: "spin",
      title: "PSA Reviewing Cards",
      sub: "Submission under review",
    },
    steps: [
      { label: "Submit", state: "done", sub: "VERIFIED", subColor: POS },
      { label: "Ship", state: "done" },
      {
        label: "Vault",
        state: "active",
        sub: "REVIEWING",
        subColor: AZ,
        spin: true,
      },
      { label: "Mint", state: P },
    ],
    notif: "We'll notify you by email as each card is verified.",
    cta: [{ label: "Back to Vault", href: "/vault" }],
  },
  E: {
    key: "E",
    layout: "B",
    stage: "vault",
    pillCols: 3,
    hero: {
      tone: "success",
      icon: "check",
      title: "Cards Approved & Vaulted",
      sub: "3 cards · verified and insured",
    },
    steps: [
      { label: "Submit", state: "done", sub: "VERIFIED", subColor: POS },
      { label: "Ship", state: "done" },
      { label: "Vault", state: "done", sub: "APPROVED", subColor: POS },
      {
        label: "Mint",
        state: "active",
        sub: "QUEUED",
        subColor: AZ,
        spin: true,
      },
    ],
    notif: "Token minting will begin shortly.",
    cta: [
      { label: "View in Portfolio →", href: "/portfolio", primary: true },
      { label: "Submit Another Card →", href: "/vault/submit" },
    ],
  },
  F: {
    key: "F",
    layout: "B",
    stage: "vault",
    pillCols: 3,
    hero: {
      tone: "danger",
      icon: "x",
      title: "Cards Rejected",
      sub: "3 cards did not meet our requirements",
    },
    steps: [
      { label: "Submit", state: "done", sub: "VERIFIED", subColor: POS },
      { label: "Ship", state: "done" },
      {
        label: "Vault",
        state: "failed",
        sub: "REJECTED",
        subColor: NEG,
      },
      { label: "Mint", state: P },
    ],
    notif: "Rejected cards will be returned at your expense.",
    cta: [
      { label: "Contact Support →", href: "#", primary: true },
      { label: "Submit Another Card →", href: "/vault/submit" },
    ],
  },
  G: {
    key: "G",
    layout: "B",
    stage: "mint",
    pillCols: 2,
    hero: {
      tone: "success",
      icon: "check",
      title: "Minting Complete",
      sub: "Tokens minted to your wallet",
    },
    steps: [
      { label: "Submit", state: "done", sub: "VERIFIED", subColor: POS },
      { label: "Ship", state: "done" },
      { label: "Vault", state: "done", sub: "APPROVED", subColor: POS },
      { label: "Mint", state: "done", sub: "COMPLETED", subColor: POS },
    ],
    notif: "All tokens are now visible in your Portfolio.",
    cta: [
      { label: "View in Portfolio →", href: "/portfolio", primary: true },
      { label: "Submit Another Card →", href: "/vault/submit" },
    ],
  },
  H: {
    key: "H",
    layout: "B",
    stage: "mint",
    pillCols: 2,
    hero: {
      tone: "danger",
      icon: "x",
      title: "Mint Failed",
      sub: "1 of 3 tokens failed to mint",
    },
    steps: [
      { label: "Submit", state: "done", sub: "VERIFIED", subColor: POS },
      { label: "Ship", state: "done" },
      { label: "Vault", state: "done", sub: "APPROVED", subColor: POS },
      { label: "Mint", state: "failed", sub: "FAILED", subColor: NEG },
    ],
    notif: "We're retrying the failed mint automatically.",
    cta: [
      { label: "Contact Support →", href: "#", primary: true },
      { label: "Submit Another Card →", href: "/vault/submit" },
    ],
  },
};

/** No mock package cards — live submission cards will populate this later. */
export function buildPackageCards(_scenario: VaultDetailScenario): VaultPackageCard[] {
  return [];
}

export function resolveDetailScenarioKey(
  scenario?: string | null,
  legacyView?: string | null,
): VaultDetailScenarioKey {
  const s = scenario?.toUpperCase();
  if (s && s in VAULT_DETAIL_SCENARIOS) return s as Exclude<VaultDetailScenarioKey, "early">;
  if (legacyView === "rejected") return "early";
  if (legacyView === "completed") return "G";
  return "A";
}

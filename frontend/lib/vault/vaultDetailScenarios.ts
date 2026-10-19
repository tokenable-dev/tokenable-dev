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
  cardNumber?: string | null;
  year?: string | null;
  setName?: string | null;
  language?: string | null;
  variant?: string | null;
  status: VaultPackageCardStatus;
  token?: string;
  reason?: string;
  submittedGrade?: string;
};

export type VaultDetailScenario = {
  key: VaultDetailScenarioKey;
  layout: "A" | "B";
  stage?: "vault" | "mint";
  hero: {
    tone: VaultDetailHeroTone;
    icon: "draft" | "clock" | "spin" | "check" | "x";
    title: string;
    sub: string;
  };
  steps: VaultStepDef[];
  ship?: "pending" | "intransit" | null;
  cta: { label: string; href: string; primary?: boolean }[];
};

const P = "pending" as const;
const POS = "pos" as const;
const AZ = "azure" as const;
const NEG = "neg" as const;
const DIM = "dim" as const;

/**
 * Vault-Detail.html A~H — all keys are produced by
 * `VaultSubmissionService.resolveScenario` (draft→A … mint fail→H).
 * Copy/layout aligned to the design HTML; routes stay app paths.
 * Hidden-in-HTML bits (lm-pills, notifBanner) are intentionally omitted.
 */
export const VAULT_DETAIL_SCENARIOS: Record<Exclude<VaultDetailScenarioKey, "early">, VaultDetailScenario> = {
  A: {
    key: "A",
    layout: "A",
    hero: {
      tone: "muted",
      icon: "draft",
      title: "Draft Submission",
      sub: "These items have not been submitted yet.",
    },
    steps: [
      { label: "Submit to PSA vault", state: "active", sub: "DRAFT", subColor: DIM },
      { label: "Ship", state: P },
      { label: "Received", state: P },
      { label: "Complete", state: P },
    ],
    cta: [{ label: "Continue", href: "/sell/flow", primary: true }],
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
      { label: "Submit to PSA vault", state: "done", sub: "SUBMITTED", subColor: POS },
      { label: "Ship", state: "active", sub: "PENDING", subColor: DIM },
      { label: "Received", state: P },
      { label: "Complete", state: P },
    ],
    ship: "pending",
    cta: [],
  },
  C: {
    key: "C",
    layout: "A",
    hero: {
      tone: "info",
      icon: "spin",
      title: "In Transit",
      sub: "Your package is on the way to PSA.",
    },
    steps: [
      { label: "Submit to PSA vault", state: "done", sub: "SUBMITTED", subColor: POS },
      { label: "Ship", state: "active", sub: "IN TRANSIT", subColor: AZ },
      { label: "Received", state: P },
      { label: "Complete", state: P },
    ],
    ship: "intransit",
    cta: [],
  },
  D: {
    key: "D",
    layout: "B",
    stage: "vault",
    hero: {
      tone: "info",
      icon: "spin",
      title: "PSA Reviewing Cards",
      sub: "PSA is authenticating your cards",
    },
    steps: [
      { label: "Submit to PSA vault", state: "done", sub: "VERIFIED", subColor: POS },
      { label: "Ship", state: "done" },
      { label: "Received", state: "active", sub: "REVIEWING", subColor: AZ },
      { label: "Complete", state: P },
    ],
    cta: [],
  },
  E: {
    key: "E",
    layout: "B",
    stage: "vault",
    hero: {
      tone: "success",
      icon: "check",
      title: "Cards approved and stored",
      sub: "Verified and insured",
    },
    steps: [
      { label: "Submit to PSA vault", state: "done", sub: "VERIFIED", subColor: POS },
      { label: "Ship", state: "done" },
      { label: "Received", state: "done", sub: "APPROVED", subColor: POS },
      { label: "Complete", state: "active", sub: "QUEUED", subColor: AZ, spin: true },
    ],
    cta: [
      { label: "View in Collection", href: "/portfolio", primary: true },
      { label: "Submit Another Card", href: "/sell/flow" },
    ],
  },
  F: {
    key: "F",
    layout: "B",
    stage: "vault",
    hero: {
      tone: "danger",
      icon: "x",
      title: "Cards Rejected",
      sub: "Cards did not meet our requirements",
    },
    steps: [
      { label: "Submit to PSA vault", state: "done", sub: "VERIFIED", subColor: POS },
      { label: "Ship", state: "done" },
      { label: "Received", state: "failed", sub: "REJECTED", subColor: NEG },
      { label: "Complete", state: P },
    ],
    cta: [
      { label: "Contact Support", href: "/faq", primary: true },
      { label: "Submit Another Card", href: "/sell/flow" },
    ],
  },
  G: {
    key: "G",
    layout: "B",
    stage: "mint",
    hero: {
      tone: "success",
      icon: "check",
      title: "Your cards are live",
      sub: "Now in your portfolio",
    },
    steps: [
      { label: "Submit to PSA vault", state: "done", sub: "VERIFIED", subColor: POS },
      { label: "Ship", state: "done" },
      { label: "Received", state: "done", sub: "APPROVED", subColor: POS },
      { label: "Complete", state: "done", sub: "LISTED", subColor: POS },
    ],
    cta: [
      { label: "View in Collection", href: "/portfolio", primary: true },
      { label: "Submit Another Card", href: "/sell/flow" },
    ],
  },
  H: {
    key: "H",
    layout: "B",
    stage: "mint",
    hero: {
      tone: "danger",
      icon: "x",
      title: "Something went wrong",
      sub: "Some cards couldn't be listed",
    },
    steps: [
      { label: "Submit to PSA vault", state: "done", sub: "VERIFIED", subColor: POS },
      { label: "Ship", state: "done" },
      { label: "Received", state: "done", sub: "APPROVED", subColor: POS },
      { label: "Complete", state: "failed", sub: "FAILED", subColor: NEG },
    ],
    cta: [
      { label: "Contact Support", href: "/faq", primary: true },
      { label: "Submit Another Card", href: "/sell/flow" },
    ],
  },
};

/** Map API item status → detail UI status. */
export function mapApiItemStatus(status: string): VaultPackageCardStatus {
  if (status === "approved" || status === "minting") return "approved";
  if (status === "rejected") return "rejected";
  if (status === "completed") return "completed";
  if (status === "failed") return "failed";
  return "reviewing";
}

/** Prefer API scenario; never invent a demo package. */
export function resolveDetailScenarioKey(
  scenario?: string | null,
): Exclude<VaultDetailScenarioKey, "early"> {
  const s = scenario?.toUpperCase();
  if (s && s in VAULT_DETAIL_SCENARIOS) {
    return s as Exclude<VaultDetailScenarioKey, "early">;
  }
  return "C";
}

export function withLiveHero(
  scenario: VaultDetailScenario,
  submissionId: string,
  cardCount: number,
): VaultDetailScenario {
  const n = Math.max(0, cardCount);
  const word = n === 1 ? "card" : "cards";
  let sub = scenario.hero.sub;
  switch (scenario.key) {
    case "D":
      sub = `${submissionId} · ${n} ${word}`;
      break;
    case "E":
      sub = `${n} ${word} · verified and insured`;
      break;
    case "F":
      sub = `${n} ${word} did not meet our requirements`;
      break;
    case "G":
      sub =
        n === 1
          ? "1 card is now in your collection"
          : `${n} ${word} are now in your collection`;
      break;
    case "H":
      sub =
        n === 1
          ? "1 card couldn't be listed"
          : `Some of ${n} ${word} couldn't be listed`;
      break;
    default:
      break;
  }
  if (sub === scenario.hero.sub) return scenario;
  return { ...scenario, hero: { ...scenario.hero, sub } };
}

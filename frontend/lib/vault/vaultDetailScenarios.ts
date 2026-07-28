import { ASSETS } from "@/constants/assets";
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

export const MOCK_SUBMISSION_ID = "SUB-20260616-00421";

const PKG_CHAR = {
  name: "1999 POKEMON BASE SET 1ST EDITION #4 CHARIZARD HOLO",
  imageUrl: ASSETS.ds.cards.charizard,
  grade: "PSA 10",
  cert: "12345678",
};
const PKG_PIKA = {
  name: "2023 POKEMON PROMO SVP #085 PIKACHU VAN GOGH",
  imageUrl: ASSETS.ds.cards.pikachu,
  grade: "PSA 9",
  cert: "22938102",
};
const PKG_LEB = {
  name: "2003 TOPPS CHROME #111 LEBRON JAMES ROOKIE",
  imageUrl: ASSETS.ds.cards.lebron,
  grade: "PSA 10",
  cert: "55501248",
};

export const PKG_DEMO_CARDS = [PKG_CHAR, PKG_PIKA, PKG_LEB] as const;

/** Vault-Detail.html A~H — design system-2 (PSA / Live labels). */
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
      { label: "PSA", state: P },
      { label: "Live", state: P },
    ],
    notif: "We'll save your progress until you submit.",
    cta: [
      { label: "Continue Submission →", href: "/sell/flow", primary: true },
      { label: "Back to Sell", href: "/vault" },
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
      { label: "PSA", state: P },
      { label: "Live", state: P },
    ],
    ship: "pending",
    notif: "We'll notify you by email once we receive your package.",
    cta: [{ label: "Back to Sell", href: "/vault" }],
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
      { label: "Submit", state: "done", sub: "SUBMITTED", subColor: POS },
      { label: "Ship", state: "active", sub: "IN TRANSIT", subColor: AZ },
      { label: "PSA", state: P },
      { label: "Live", state: P },
    ],
    ship: "intransit",
    notif: "We'll notify you by email when your package arrives.",
    cta: [{ label: "Back to Sell", href: "/vault" }],
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
      sub: `${MOCK_SUBMISSION_ID} · 3 cards`,
    },
    steps: [
      { label: "Submit", state: "done", sub: "VERIFIED", subColor: POS },
      { label: "Ship", state: "done" },
      { label: "PSA", state: "active", sub: "REVIEWING", subColor: AZ, spin: true },
      { label: "Live", state: P },
    ],
    notif: "We'll notify you by email as each card is verified.",
    cta: [{ label: "Back to Sell", href: "/vault" }],
  },
  E: {
    key: "E",
    layout: "B",
    stage: "vault",
    pillCols: 3,
    hero: {
      tone: "success",
      icon: "check",
      title: "Cards approved & stored",
      sub: "3 cards · verified and insured",
    },
    steps: [
      { label: "Submit", state: "done", sub: "VERIFIED", subColor: POS },
      { label: "Ship", state: "done" },
      { label: "PSA", state: "done", sub: "APPROVED", subColor: POS },
      { label: "Live", state: "active", sub: "QUEUED", subColor: AZ, spin: true },
    ],
    notif: "Your listings will go live shortly.",
    cta: [
      { label: "View in Portfolio →", href: "/portfolio", primary: true },
      { label: "Submit Another Card →", href: "/sell/flow" },
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
      { label: "PSA", state: "failed", sub: "REJECTED", subColor: NEG },
      { label: "Live", state: P },
    ],
    notif: "Rejected cards will be returned at your expense.",
    cta: [
      { label: "Contact Support →", href: "#", primary: true },
      { label: "Submit Another Card →", href: "/sell/flow" },
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
      title: "Your cards are live",
      sub: "3 cards are now in your portfolio",
    },
    steps: [
      { label: "Submit", state: "done", sub: "VERIFIED", subColor: POS },
      { label: "Ship", state: "done" },
      { label: "PSA", state: "done", sub: "APPROVED", subColor: POS },
      { label: "Live", state: "done", sub: "LISTED", subColor: POS },
    ],
    notif: "All your cards are now visible in your Portfolio.",
    cta: [
      { label: "View in Portfolio →", href: "/portfolio", primary: true },
      { label: "Submit Another Card →", href: "/sell/flow" },
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
      title: "Something went wrong",
      sub: "1 of 3 cards couldn't be listed",
    },
    steps: [
      { label: "Submit", state: "done", sub: "VERIFIED", subColor: POS },
      { label: "Ship", state: "done" },
      { label: "PSA", state: "done", sub: "APPROVED", subColor: POS },
      { label: "Live", state: "failed", sub: "FAILED", subColor: NEG },
    ],
    notif: "We're retrying automatically.",
    cta: [
      { label: "Contact Support →", href: "#", primary: true },
      { label: "Submit Another Card →", href: "/sell/flow" },
    ],
  },
};

export function buildPackageCards(scenario: VaultDetailScenario): VaultPackageCard[] {
  const base = [...PKG_DEMO_CARDS];
  switch (scenario.key) {
    case "D":
      return base.map((c, i) => ({ id: i, ...c, status: "reviewing" as const }));
    case "E":
      return base.map((c, i) => ({ id: i, ...c, status: "approved" as const }));
    case "F": {
      const reasons = [
        "Holder shows signs of tampering",
        "Card doesn't match the cert number",
        "Doesn't meet PSA Vault terms",
      ];
      return base.map((c, i) => ({
        id: i,
        ...c,
        status: "rejected" as const,
        reason: reasons[i] ?? "Does not meet requirements",
      }));
    }
    case "G":
      return base.map((c, i) => ({
        id: i,
        ...c,
        status: "completed" as const,
        token: `#0${421 + i}`,
      }));
    case "H":
      return base.map((c, i) => ({
        id: i,
        ...c,
        status: i < 2 ? ("completed" as const) : ("failed" as const),
        token: i < 2 ? `#0${421 + i}` : undefined,
      }));
    default:
      return [];
  }
}

/** Layout A package preview cards (draft / ship stages). */
export function buildLayoutAPackageCards(): Omit<VaultPackageCard, "status">[] {
  return PKG_DEMO_CARDS.map((c, i) => ({ id: i, ...c }));
}

export function resolveDetailScenarioKey(
  scenario?: string | null,
  legacyView?: string | null,
): VaultDetailScenarioKey {
  const s = scenario?.toUpperCase();
  if (s && s in VAULT_DETAIL_SCENARIOS) return s as Exclude<VaultDetailScenarioKey, "early">;
  if (legacyView === "rejected") return "early";
  if (legacyView === "completed") return "G";
  if (legacyView === "minting") return "D";
  return "C";
}

export const SCENARIO_SWITCHER: { key: Exclude<VaultDetailScenarioKey, "early">; label: string }[] = [
  { key: "A", label: "A·Draft" },
  { key: "B", label: "B·Pending" },
  { key: "C", label: "C·Transit" },
  { key: "D", label: "D·Review" },
  { key: "E", label: "E·Approved" },
  { key: "F", label: "F·Rejected" },
  { key: "G", label: "G·Minted" },
  { key: "H", label: "H·Failed" },
];

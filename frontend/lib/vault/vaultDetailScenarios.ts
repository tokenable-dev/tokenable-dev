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
 * `title`/`sub`/`label` values are `VaultDetail.*` translation keys.
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
      title: "heroATitle",
      sub: "heroASub",
    },
    steps: [
      { label: "stepSubmit", state: "active", sub: "subDraft", subColor: DIM },
      { label: "stepShip", state: P },
      { label: "stepReceived", state: P },
      { label: "stepComplete", state: P },
    ],
    cta: [{ label: "ctaContinue", href: "/sell/flow", primary: true }],
  },
  B: {
    key: "B",
    layout: "A",
    hero: {
      tone: "amber",
      icon: "clock",
      title: "heroBTitle",
      sub: "heroBSub",
    },
    steps: [
      { label: "stepSubmit", state: "done", sub: "subSubmitted", subColor: POS },
      { label: "stepShip", state: "active", sub: "subPending", subColor: DIM },
      { label: "stepReceived", state: P },
      { label: "stepComplete", state: P },
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
      title: "heroCTitle",
      sub: "heroCSub",
    },
    steps: [
      { label: "stepSubmit", state: "done", sub: "subSubmitted", subColor: POS },
      { label: "stepShip", state: "active", sub: "subInTransit", subColor: AZ },
      { label: "stepReceived", state: P },
      { label: "stepComplete", state: P },
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
      title: "heroDTitle",
      sub: "heroDSub",
    },
    steps: [
      { label: "stepSubmit", state: "done", sub: "subVerified", subColor: POS },
      { label: "stepShip", state: "done" },
      { label: "stepReceived", state: "active", sub: "subReviewing", subColor: AZ },
      { label: "stepComplete", state: P },
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
      title: "heroETitle",
      sub: "heroESub",
    },
    steps: [
      { label: "stepSubmit", state: "done", sub: "subVerified", subColor: POS },
      { label: "stepShip", state: "done" },
      { label: "stepReceived", state: "done", sub: "subApproved", subColor: POS },
      { label: "stepComplete", state: "active", sub: "subQueued", subColor: AZ, spin: true },
    ],
    cta: [
      { label: "ctaViewCollection", href: "/portfolio", primary: true },
      { label: "ctaSubmitAnother", href: "/sell/flow" },
    ],
  },
  F: {
    key: "F",
    layout: "B",
    stage: "vault",
    hero: {
      tone: "danger",
      icon: "x",
      title: "heroFTitle",
      sub: "heroFSub",
    },
    steps: [
      { label: "stepSubmit", state: "done", sub: "subVerified", subColor: POS },
      { label: "stepShip", state: "done" },
      { label: "stepReceived", state: "failed", sub: "subRejected", subColor: NEG },
      { label: "stepComplete", state: P },
    ],
    cta: [{ label: "ctaSubmitAnother", href: "/sell/flow" }],
  },
  G: {
    key: "G",
    layout: "B",
    stage: "mint",
    hero: {
      tone: "success",
      icon: "check",
      title: "heroGTitle",
      sub: "heroGSub",
    },
    steps: [
      { label: "stepSubmit", state: "done", sub: "subVerified", subColor: POS },
      { label: "stepShip", state: "done" },
      { label: "stepReceived", state: "done", sub: "subApproved", subColor: POS },
      { label: "stepComplete", state: "done", sub: "subListed", subColor: POS },
    ],
    cta: [
      { label: "ctaViewCollection", href: "/portfolio", primary: true },
      { label: "ctaSubmitAnother", href: "/sell/flow" },
    ],
  },
  H: {
    key: "H",
    layout: "B",
    stage: "mint",
    hero: {
      tone: "danger",
      icon: "x",
      title: "heroHTitle",
      sub: "heroHSub",
    },
    steps: [
      { label: "stepSubmit", state: "done", sub: "subVerified", subColor: POS },
      { label: "stepShip", state: "done" },
      { label: "stepReceived", state: "done", sub: "subApproved", subColor: POS },
      { label: "stepComplete", state: "failed", sub: "subFailed", subColor: NEG },
    ],
    cta: [{ label: "ctaSubmitAnother", href: "/sell/flow" }],
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

/** Translation key + values for the hero subline built from live counts. */
export function liveHeroSub(
  key: VaultDetailScenarioKey,
  submissionId: string,
  cards: Pick<VaultPackageCard, "status">[],
): { key: string; values?: Record<string, string | number> } | null {
  const count = Math.max(0, cards.length);
  if (count === 0) return null;
  switch (key) {
    case "D":
      return { key: "heroDLive", values: { id: submissionId, count } };
    case "E":
      return { key: "heroELive", values: { count } };
    case "F":
      return { key: "heroFLive", values: { count } };
    case "G":
      return { key: "heroGLive", values: { count } };
    case "H": {
      const failed = cards.filter((c) => c.status !== "completed").length;
      return { key: "heroHLive", values: { failed, count } };
    }
    default:
      return null;
  }
}

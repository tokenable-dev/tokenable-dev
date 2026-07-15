/** Vault step indicator — matches Vault-Step-Indicator.html / Vault-Detail.html stepBar. */

export type VaultStepState = "done" | "active" | "action" | "failed" | "pending" | "inactive";

export type VaultStepSubColor = "pos" | "azure" | "amber" | "neg" | "dim";

export type VaultStepDetail =
  | string
  | { text: string; href: string };

export type VaultStepDef = {
  label: string;
  state: VaultStepState;
  sub?: string;
  subColor?: VaultStepSubColor;
  detail?: VaultStepDetail;
  cta?: { label: string; href: string };
  spin?: boolean;
};

const LABELS = ["Submit", "Ship", "Vault", "Mint"] as const;

/** Simple numeric active step (Submit=1, Ship=2, …) for flow pages. */
export function buildSimpleVaultSteps(activeStep: number): VaultStepDef[] {
  return LABELS.map((label, index) => {
    const num = index + 1;
    if (num < activeStep) return { label, state: "done" as const };
    if (num === activeStep) return { label, state: "active" as const };
    return { label, state: "inactive" as const };
  });
}

export function subColorCss(color?: VaultStepSubColor): string {
  switch (color) {
    case "pos":
      return "var(--pos)";
    case "azure":
      return "var(--azure)";
    case "amber":
      return "var(--amber)";
    case "neg":
      return "var(--neg)";
    case "dim":
      return "rgba(255,255,255,0.35)";
    default:
      return "rgba(255,255,255,0.35)";
  }
}

import {
  marketHistoryTierFromPsaGradeInput,
  psaGradePolicyInputFromComponents,
  psaGradePolicyInputFromGraded,
} from "./psaGradePolicy";
import type { CollectionComponents } from "@/lib/marketplace/collectionDetailComponents";

export function marketHistoryTierFromComponents(
  components: CollectionComponents | null | undefined,
): string {
  return marketHistoryTierFromPsaGradeInput(
    psaGradePolicyInputFromComponents(components),
  );
}

export function marketHistoryTierFromRwaMetadata(
  metadata: { properties?: unknown } | null | undefined,
): string {
  const props = metadata?.properties as Record<string, unknown> | undefined;
  const graded = props?.graded as Record<string, unknown> | undefined;
  if (!graded || typeof graded !== "object") return "PSA_10";
  return marketHistoryTierFromPsaGradeInput(
    psaGradePolicyInputFromGraded(graded),
  );
}

export function marketTierDisplayLabel(tier: string): string {
  const t = String(tier).trim().toUpperCase();
  if (t === "PSA_AUTH") return "PSA AUTH";
  const m = /^PSA_(\d+)$/.exec(t);
  if (m) return `PSA ${m[1]}`;
  return "PSA 10";
}

export function isAuthQualifierGradeScore(
  gradeScoreStr: string | undefined | null,
): boolean {
  return String(gradeScoreStr ?? "").trim().toLowerCase() === "auth";
}

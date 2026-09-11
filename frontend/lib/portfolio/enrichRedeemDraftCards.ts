import { postRwaMetadataBatchBatched } from "@/lib/core/api/rwa-blockchain";
import { certNumberFromMetadata, type RedeemDraftCard } from "@/lib/portfolio/redeemDraft";
import {
  formatPortfolioGradeLabel,
  formatRedeemCardLine1FromMetadata,
} from "@/lib/portfolio/portfolioTableHelpers";

/** Fill name / image / grade / cert from metadata when resume/preparing lacks draft thumbs. */
export async function enrichRedeemDraftCards(
  cards: RedeemDraftCard[],
): Promise<RedeemDraftCard[]> {
  if (cards.length === 0) return cards;
  const needs = cards.some(
    (c) =>
      !c.imageUrl ||
      !c.name ||
      /^RWA #\d+$/i.test(c.name) ||
      !c.grade ||
      !c.certNumber ||
      (Boolean(c.grade) && !c.name.includes(c.grade!)),
  );
  if (!needs) return cards;

  try {
    const { items } = await postRwaMetadataBatchBatched(
      cards.map((c) => c.tokenId),
    );
    const byId = new Map(items.map((it) => [it.tokenId, it]));
    return cards.map((c) => {
      const it = byId.get(c.tokenId);
      if (!it) return c;
      const meta = it.metadata;
      const grade = c.grade ?? formatPortfolioGradeLabel(meta ?? null);
      const fallback =
        meta && typeof meta.name === "string" && meta.name.trim()
          ? meta.name.trim()
          : c.name;
      return {
        ...c,
        name: formatRedeemCardLine1FromMetadata(meta, fallback, grade),
        imageUrl: it.imageUrl ?? c.imageUrl,
        grade,
        certNumber: c.certNumber ?? certNumberFromMetadata(meta),
      };
    });
  } catch {
    return cards;
  }
}

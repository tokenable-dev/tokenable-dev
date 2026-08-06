import { postRwaMetadataBatchBatched } from "@/lib/core/api/rwa-blockchain";
import { certNumberFromMetadata, type RedeemDraftCard } from "@/lib/portfolio/redeemDraft";
import { formatPortfolioGradeLabel } from "@/lib/portfolio/portfolioTableHelpers";

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
      !c.certNumber,
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
      const name =
        meta && typeof meta.name === "string" && meta.name.trim()
          ? meta.name.trim()
          : c.name;
      return {
        ...c,
        name,
        imageUrl: it.imageUrl ?? c.imageUrl,
        grade: c.grade ?? formatPortfolioGradeLabel(meta),
        certNumber: c.certNumber ?? certNumberFromMetadata(meta),
      };
    });
  } catch {
    return cards;
  }
}

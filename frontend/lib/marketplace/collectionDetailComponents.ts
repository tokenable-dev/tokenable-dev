export type CollectionDetailComponents = Record<string, unknown> & {
  cardName?: string;
  cardNameDisplay?: string;
  gradingCompany?: string;
  gradingCompanyDisplay?: string;
  gradeScore?: string;
  cardSet?: string;
  cardSetDisplay?: string;
  cardNumber?: string;
  variant?: string;
  psaCategory?: string;
  listingDisplayTitle?: string;
  psaTotalPopulation?: number;
};

export function parseCollectionDetailComponents(
  raw: unknown,
): CollectionDetailComponents {
  if (!raw || typeof raw !== "object") return {};
  return raw as CollectionDetailComponents;
}

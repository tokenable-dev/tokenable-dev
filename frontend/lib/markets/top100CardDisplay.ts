import { joinCardDisplaySegments, resolveCardDisplayGrade } from "@/lib/marketplace/cardDisplayName";
import { formatHeadlineCardNumber } from "@/lib/marketplace/collectionFullDetailsTitle";

type Top100CardLike = {
  description: string;
  player: string | null;
  set: string | null;
  number: string | null;
  variant: string | null;
  set_type?: string | null;
  grade?: string | null;
};

export function resolveTop100ImageUrl(raw: string | null): string | null {
  if (!raw) return null;
  if (raw.startsWith("//")) return `https:${raw}`;
  return raw;
}

export function formatTop100Usd(price: number): string {
  return price.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function top100CardSubText(card: Top100CardLike): string {
  const subParts: string[] = [];
  if (card.set) subParts.push(card.set);
  if (card.number) {
    const num = formatHeadlineCardNumber(card.number);
    if (num) subParts.push(num);
  }
  if (card.variant) subParts.push(card.variant);
  return subParts.join(" · ");
}

export function top100CardTitle(card: Top100CardLike): string {
  const name = (card.player ?? card.description)?.trim() || "";
  const grade = resolveCardDisplayGrade(card.grade);
  return joinCardDisplaySegments([name, grade]);
}

/** eBay search — card name plus set type (and set when distinct). */
export function buildTop100EbaySearchQuery(card: Top100CardLike): string {
  const parts: string[] = [];
  const name = top100CardTitle(card).trim();
  if (name) parts.push(name);

  const haystack = name.toLowerCase();
  const appendIfMissing = (value: string | null | undefined) => {
    const trimmed = value?.trim();
    if (!trimmed) return;
    if (haystack.includes(trimmed.toLowerCase())) return;
    if (parts.some((p) => p.toLowerCase() === trimmed.toLowerCase())) return;
    parts.push(trimmed);
  };

  appendIfMissing(card.set_type);
  appendIfMissing(card.set);

  return parts.join(" ");
}

export function parseTop100Price(price: string | null): number | null {
  if (price == null) return null;
  const n = parseFloat(price);
  return Number.isFinite(n) ? n : null;
}

export type Top100DetailField = {
  label: string;
  value: string;
};

/** Detail rows that are not already shown in the page header (title / subtitle). */
export function buildTop100DetailFields(params: {
  card: Top100CardLike & {
    category?: string | null;
    category_group?: string | null;
    set_type?: string | null;
    description?: string;
  } | null;
  fallbackCategory: string;
  title: string;
  subText: string;
}): Top100DetailField[] {
  const { card, fallbackCategory, title, subText } = params;
  if (!card) return [];

  const rows: Top100DetailField[] = [];
  const category = card.category?.trim();
  const categoryGroup = card.category_group?.trim();
  const setType = card.set_type?.trim();
  const description = card.description?.trim();
  const normalizedTitle = title.trim();

  if (category) {
    rows.push({ label: "Category", value: category });
  } else if (fallbackCategory) {
    rows.push({ label: "Category", value: fallbackCategory });
  }

  if (categoryGroup) {
    rows.push({ label: "Category group", value: categoryGroup });
  }

  if (setType) {
    rows.push({ label: "Set type", value: setType });
  }

  if (
    description &&
    description !== normalizedTitle &&
    !(card.player && description === card.player.trim())
  ) {
    rows.push({ label: "Description", value: description });
  }

  return rows;
}

export function formatSnapshotDateLabel(dateKst: string): string {
  const [y, m, d] = dateKst.split("-").map((v) => parseInt(v, 10));
  if (!y || !m || !d) return dateKst;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

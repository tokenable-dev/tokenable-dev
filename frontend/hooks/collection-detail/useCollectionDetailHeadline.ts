"use client";

import { useMemo } from "react";
import type { CollectionMarketPreview } from "@/lib/core";
import type { CollectionDetailCard } from "@/lib/marketplace/collectionDetailTypes";
import {
  buildAssetDetailHeadlineParts,
  computeAssetDetailWovenTitle,
  formatCardDisplayMeta,
  formatCardDisplayName,
  type AssetDetailHeadlineParts,
} from "@/lib/marketplace/assetDetailHeadline";
import { buildCollectionMarketDetailCards } from "@/lib/marketplace/buildCollectionMarketDetailCards";
import type { CollectionComponents } from "@/lib/marketplace/collectionDetailComponents";
import { listingDisplayTitleFromComp } from "@/lib/marketplace/collectionListingUtils";
import { resolveCollectionDisplayLanguage } from "@/lib/marketplace/collectionEditionLanguage";
import {
  bucketCardNameForDisplay,
  bucketCardSetForDisplay,
  bucketGradingCompanyForDisplay,
} from "@/lib/marketplace/bucketKey";
import {
  buildCollectionHeadlineMetaStrip,
  leadingYearFromSetLine,
  toCardDisplayCase,
  yearFromComponents,
} from "@/lib/marketplace/collectionFullDetailsTitle";
import {
  formatCardDisplayLanguageShort,
  resolveCardDisplayGrade,
  formatDetailBreadcrumbTrail,
} from "@/lib/marketplace/cardDisplayName";
import {
  resolveCollectionSlabCardTitle,
  resolveCollectionSlabSetLine,
} from "@/lib/marketplace/slabDisplayTitle";
import { resolveCollectionComponentVariant } from "@/lib/marketplace/resolveCardVariantLabel";
import {
  buildCollectionHeadlineInfoTags,
  resolveHeadlineFormattedCardNumber,
  type CollectionHeadlineInfoTag,
} from "@/lib/marketplace/collectionHeadlineTags";
import {
  formatSportCategoryDisplayLabel,
  inferSportBucketFromHaystack,
} from "@/lib/market";
import { marketsHrefForDetailRow } from "@/lib/markets/marketsUrlFilters";

export function useCollectionDetailHeadline(params: {
  key: string;
  comp: CollectionComponents;
  marketPreview: CollectionMarketPreview | null;
  pokeTierLabel: string;
  displayLabel: string | null | undefined;
  hasCollection: boolean;
  activeGradeLabel?: string | null;
}) {
  const {
    key,
    comp,
    marketPreview,
    pokeTierLabel,
    displayLabel,
    hasCollection,
    activeGradeLabel,
  } = params;

  const metadataRows = useMemo(() => [] as { label: string; value: string }[], [key]);

  const subtitle = useMemo(() => {
    const setShown = bucketCardSetForDisplay(comp);
    const parts = [setShown, comp.cardNumber].filter(
      (x): x is string => typeof x === "string" && x.trim().length > 0,
    );
    if (!parts.length) return null;
    return toCardDisplayCase(parts.join(" · "));
  }, [comp]);

  const headlineSetLine = useMemo(() => {
    const slabSet = resolveCollectionSlabSetLine(comp);
    if (slabSet) return slabSet;

    const bucketSet = bucketCardSetForDisplay(comp).trim();
    const listingTitle = listingDisplayTitleFromComp(comp);
    const setMerged =
      listingTitle.length > 0
        ? bucketSet || marketPreview?.card?.setName?.trim() || ""
        : marketPreview?.card?.setName?.trim() || bucketSet;
    if (!setMerged.length) return null;
    const yFromSet = leadingYearFromSetLine(setMerged);
    const yComp = yearFromComponents(comp);
    const y = yFromSet ?? yComp;
    const line =
      y != null && !/^\s*\d{4}\b/.test(setMerged) ? `${y} ${setMerged}` : setMerged;
    return toCardDisplayCase(line);
  }, [marketPreview?.card?.setName, comp]);

  const collectionCategoryBadge = useMemo(() => {
    const name = bucketCardNameForDisplay(comp);
    const setN = bucketCardSetForDisplay(comp);
    const listingTitle = listingDisplayTitleFromComp(comp);
    const psaCat = typeof comp.psaCategory === "string" ? comp.psaCategory.trim() : "";
    const previewCat = marketPreview?.card?.category?.trim() ?? "";
    const corpus = `${listingTitle} ${name} ${setN} ${psaCat} ${previewCat} ${marketPreview?.card?.setName ?? ""}`;
    const bucket = inferSportBucketFromHaystack(corpus);
    if (bucket === "onepiece") return toCardDisplayCase("One Piece");
    if (bucket === "pokemon") return toCardDisplayCase("Pokemon");
    if (bucket === "basketball") return "NBA";
    if (bucket === "baseball") return "MLB";
    if (previewCat) {
      return toCardDisplayCase(formatSportCategoryDisplayLabel(previewCat));
    }
    if (psaCat) {
      return toCardDisplayCase(formatSportCategoryDisplayLabel(psaCat));
    }
    return toCardDisplayCase("Trading cards");
  }, [
    marketPreview?.card?.category,
    marketPreview?.card?.setName,
    comp.cardNameDisplay,
    comp.cardName,
    comp.cardSet,
    comp.cardSetDisplay,
    comp.psaCategory,
  ]);

  const collectionHeadlineCardName = useMemo(
    () =>
      resolveCollectionSlabCardTitle(comp, {
        displayLabel,
        collectionKey: key,
      }),
    [comp, displayLabel, key],
  );

  const headlineCardNumberToken = useMemo(
    () => resolveHeadlineFormattedCardNumber(marketPreview, comp),
    [marketPreview, comp],
  );

  const headlineVarietyLabel = useMemo(
    () =>
      resolveCollectionComponentVariant(comp, marketPreview?.card?.variant ?? null),
    [comp, marketPreview?.card?.variant],
  );

  const headlineLanguageLabel = useMemo(() => {
    const listingTitle = listingDisplayTitleFromComp(comp);
    const raw = resolveCollectionDisplayLanguage({
      comp,
      marketPreview,
      corpusLines: [
        listingTitle,
        headlineSetLine,
        marketPreview?.card?.setName,
        marketPreview?.card?.name,
        bucketCardSetForDisplay(comp),
      ],
    });
    if (!raw) return null;
    return formatCardDisplayLanguageShort(raw) ?? raw;
  }, [comp, marketPreview, headlineSetLine]);

  const collectionHeadlineParts = useMemo((): AssetDetailHeadlineParts => {
    const explicitYear = yearFromComponents(comp);
    let year: number | string | null = explicitYear;

    if (year == null) {
      const dlRaw = typeof displayLabel === "string" ? displayLabel : "";
      const m = /(\d{4})/.exec(dlRaw ?? "");
      if (m) {
        const yNum = Number(m[1]);
        if (Number.isFinite(yNum) && yNum >= 1880 && yNum <= 2100) {
          year = yNum;
        }
      }
    }

    return buildAssetDetailHeadlineParts({
      setLine: headlineSetLine,
      year,
      cardName: collectionHeadlineCardName,
      cardNumber: headlineCardNumberToken,
      variety: headlineVarietyLabel,
      language: headlineLanguageLabel,
    });
  }, [
    headlineSetLine,
    comp,
    collectionHeadlineCardName,
    headlineCardNumberToken,
    headlineVarietyLabel,
    headlineLanguageLabel,
    displayLabel,
  ]);

  const headlineGrade = useMemo(() => {
    const label = activeGradeLabel?.trim() || pokeTierLabel?.trim();
    return label ? toCardDisplayCase(label) : resolveCardDisplayGrade(null);
  }, [activeGradeLabel, pokeTierLabel]);

  const collectionHeadlineDisplayTitle = useMemo(
    () =>
      formatCardDisplayName(collectionHeadlineParts, {
        grade: headlineGrade,
      }),
    [collectionHeadlineParts, headlineGrade],
  );

  const collectionBreadcrumbTrail = useMemo(
    () =>
      formatDetailBreadcrumbTrail({
        setLine: headlineSetLine,
        setName: collectionHeadlineParts.setName,
        categoryLabel: collectionCategoryBadge,
        language: headlineLanguageLabel,
      }),
    [
      collectionHeadlineParts.setName,
      headlineSetLine,
      collectionCategoryBadge,
      headlineLanguageLabel,
    ],
  );

  const collectionHeadlineMetaStrip = useMemo(() => {
    const catalog = formatCardDisplayMeta(collectionHeadlineParts);
    const collab = buildCollectionHeadlineMetaStrip({
      setLine: headlineSetLine,
      comp,
      marketPreview,
      displayLabel: typeof displayLabel === "string" ? displayLabel.trim() : null,
    });
    const collabCased = collab?.trim() ? toCardDisplayCase(collab) : null;
    if (!catalog) return collabCased;
    if (!collabCased) return catalog;

    const catalogSegs = new Set(
      catalog
        .split(/\s*·\s*/)
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    );
    const collabExtra = collabCased
      .split(/\s*·\s*/)
      .map((s) => s.trim())
      .filter((s) => s && !catalogSegs.has(s.toLowerCase()));
    if (collabExtra.length === 0) return catalog;
    return `${catalog} · ${collabExtra.join(" · ")}`;
  }, [
    collectionHeadlineParts,
    headlineSetLine,
    comp,
    marketPreview,
    displayLabel,
  ]);

  const collectionPopulationBadge = useMemo(() => {
    const popRaw = comp.psaTotalPopulation;
    if (popRaw == null || !Number.isFinite(popRaw) || popRaw <= 0) return null;
    return `Pop · ${Number(popRaw).toLocaleString("en-US")}`;
  }, [comp.psaTotalPopulation]);

  const collectionWovenTitle = useMemo(
    () =>
      computeAssetDetailWovenTitle(
        collectionHeadlineParts,
        collectionHeadlineMetaStrip,
        null,
        { grade: headlineGrade },
      ),
    [collectionHeadlineParts, collectionHeadlineMetaStrip, headlineGrade],
  );

  const headlineInfoTags = useMemo((): CollectionHeadlineInfoTag[] | null => {
    const raw = buildCollectionHeadlineInfoTags({
      headlineSetLine,
      comp,
      marketPreview,
      collectionHeadlineTitle: collectionHeadlineDisplayTitle,
      collectionHeadlineMetaStrip,
      pokeTierLabel,
    });
    if (!raw) return null;
    return raw.map((t) => ({
      ...t,
      text: t.id === "cardno" ? t.text : toCardDisplayCase(t.text),
      title: t.title ? toCardDisplayCase(t.title) : undefined,
    }));
  }, [
    headlineSetLine,
    collectionHeadlineDisplayTitle,
    collectionHeadlineMetaStrip,
    marketPreview,
    pokeTierLabel,
    comp,
  ]);

  const collectionMarketDetailCards = useMemo(
    () =>
      buildCollectionMarketDetailCards({
        key,
        hasCollection,
        marketPreview,
        comp,
        headlineCardNumberToken,
        headlineSetLine,
        collectionCategoryBadge,
      }),
    [
      key,
      hasCollection,
      marketPreview,
      comp,
      headlineCardNumberToken,
      headlineSetLine,
      collectionCategoryBadge,
    ],
  );

  const detailsCatalogLine = null;

  const heroDetailsKvRows = useMemo((): CollectionDetailCard[] => {
    const player = collectionHeadlineCardName?.trim();
    const priority = [
      "card-number",
      "variant",
      "set",
      "year",
      "category",
      "grade",
      "grader",
      "language",
    ] as const;
    const byId = new Map(collectionMarketDetailCards.map((c) => [c.id, c]));
    const out: CollectionDetailCard[] = [];
    if (player) {
      out.push({
        id: "character",
        label: "Card name",
        value: toCardDisplayCase(player),
      });
    }
    for (const id of priority) {
      const row = byId.get(id);
      if (row) out.push(row);
    }
    for (const row of collectionMarketDetailCards) {
      if (row.id === "cert") continue;
      if (!out.some((r) => r.id === row.id)) {
        out.push(row);
      }
    }

    const grader =
      byId.get("grader")?.value?.trim() ||
      bucketGradingCompanyForDisplay(comp).trim() ||
      null;
    const gradeScore =
      byId.get("grade")?.value?.trim() ||
      (typeof comp.gradeScore === "string" ? comp.gradeScore.trim() : null);

    return out.map((row) => {
      const href = marketsHrefForDetailRow(row.id, row.value, {
        categoryBadge: collectionCategoryBadge,
        gradeScore,
        grader,
      });
      return href ? { ...row, href } : row;
    });
  }, [
    collectionMarketDetailCards,
    collectionHeadlineCardName,
    collectionCategoryBadge,
    comp,
  ]);

  return {
    metadataRows,
    subtitle,
    headlineSetLine,
    collectionCategoryBadge,
    collectionBreadcrumbTrail,
    collectionHeadlineParts,
    collectionHeadlineDisplayTitle,
    collectionHeadlineMetaStrip,
    headlineGrade,
    collectionPopulationBadge,
    collectionWovenTitle,
    headlineInfoTags,
    detailsCatalogLine,
    heroDetailsKvRows,
  };
}

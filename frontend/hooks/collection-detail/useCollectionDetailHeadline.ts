"use client";

import { useMemo } from "react";
import type { CollectionMarketPreview } from "@/lib/core";
import type { CollectionDetailCard } from "@/lib/marketplace/collectionDetailTypes";
import {
  buildAssetDetailHeadlineParts,
  computeAssetDetailWovenTitle,
  formatAssetDetailHeadlineText,
  type AssetDetailHeadlineParts,
} from "@/lib/marketplace/assetDetailHeadline";
import { buildCollectionMarketDetailCards } from "@/lib/marketplace/buildCollectionMarketDetailCards";
import type { CollectionComponents } from "@/lib/marketplace/collectionDetailComponents";
import { listingDisplayTitleFromComp } from "@/lib/marketplace/collectionListingUtils";
import {
  bucketCardNameForDisplay,
  bucketCardSetForDisplay,
} from "@/lib/marketplace/bucketKey";
import {
  buildCollectionHeadlineMetaStrip,
  leadingYearFromSetLine,
  toCardDisplayUppercase,
  yearFromComponents,
} from "@/lib/marketplace/collectionFullDetailsTitle";
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
  isPokemonTcgCategoryLabel,
} from "@/lib/market";

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
    return toCardDisplayUppercase(parts.join(" · "));
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
    return toCardDisplayUppercase(line);
  }, [marketPreview?.card?.setName, comp]);

  const collectionCategoryBadge = useMemo(() => {
    const name = bucketCardNameForDisplay(comp);
    const setN = bucketCardSetForDisplay(comp);
    const listingTitle = listingDisplayTitleFromComp(comp);
    const psaCat = typeof comp.psaCategory === "string" ? comp.psaCategory.trim() : "";
    const corpus = `${listingTitle} ${name} ${setN} ${psaCat} ${marketPreview?.card?.setName ?? ""}`;
    const previewCat = marketPreview?.card?.category?.trim() ?? "";
    if (
      /\bpokemon\b/i.test(corpus) ||
      isPokemonTcgCategoryLabel(previewCat) ||
      isPokemonTcgCategoryLabel(psaCat)
    ) {
      return toCardDisplayUppercase("Pokemon");
    }
    if (previewCat) {
      return toCardDisplayUppercase(formatSportCategoryDisplayLabel(previewCat));
    }
    if (psaCat) {
      return toCardDisplayUppercase(formatSportCategoryDisplayLabel(psaCat));
    }
    return toCardDisplayUppercase("Trading cards");
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
      uppercase: true,
    });
  }, [
    headlineSetLine,
    comp,
    collectionHeadlineCardName,
    headlineCardNumberToken,
    headlineVarietyLabel,
    displayLabel,
  ]);

  const collectionHeadlineDisplayTitle = useMemo(
    () => formatAssetDetailHeadlineText(collectionHeadlineParts),
    [collectionHeadlineParts],
  );

  const collectionHeadlineMetaStrip = useMemo(() => {
    const raw = buildCollectionHeadlineMetaStrip({
      setLine: headlineSetLine,
      comp,
      marketPreview,
      displayLabel: typeof displayLabel === "string" ? displayLabel.trim() : null,
    });
    if (raw == null || !String(raw).trim()) return null;
    return toCardDisplayUppercase(raw);
  }, [headlineSetLine, comp, marketPreview, displayLabel]);

  const headlineGradeBadge = useMemo(() => {
    const label = activeGradeLabel?.trim() || pokeTierLabel;
    return label ? toCardDisplayUppercase(label) : null;
  }, [activeGradeLabel, pokeTierLabel]);

  const collectionPopulationBadge = useMemo(() => {
    const popRaw = comp.psaTotalPopulation;
    if (popRaw == null || !Number.isFinite(popRaw) || popRaw <= 0) return null;
    return toCardDisplayUppercase(`Pop · ${Number(popRaw).toLocaleString("en-US")}`);
  }, [comp.psaTotalPopulation]);

  const collectionWovenTitle = useMemo(
    () =>
      toCardDisplayUppercase(
        computeAssetDetailWovenTitle(
          collectionHeadlineParts,
          collectionHeadlineMetaStrip,
          null,
        ),
      ),
    [collectionHeadlineParts, collectionHeadlineMetaStrip],
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
      text: toCardDisplayUppercase(t.text),
      title: t.title ? toCardDisplayUppercase(t.title) : undefined,
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

  const detailsCatalogLine = useMemo(() => {
    const fromTags = headlineInfoTags?.find((t) => t.id === "cardno")?.text?.trim();
    if (fromTags) {
      const titleHasCardNo = collectionHeadlineDisplayTitle
        .toLowerCase()
        .includes(fromTags.toLowerCase());
      return titleHasCardNo ? null : fromTags;
    }
    const raw = headlineCardNumberToken?.trim();
    if (!raw) return null;
    const normalized = raw.startsWith("#") ? raw : `#${raw}`;
    const titleHasCardNo = collectionHeadlineDisplayTitle
      .toLowerCase()
      .includes(normalized.toLowerCase());
    return titleHasCardNo ? null : normalized;
  }, [headlineInfoTags, headlineCardNumberToken, collectionHeadlineDisplayTitle]);

  const heroDetailsKvRows = useMemo((): CollectionDetailCard[] => {
    const player = collectionHeadlineCardName?.trim();
    const priority = [
      "card-number",
      "variant",
      "set",
      "category",
      "grade",
      "grader",
      "year",
      "language",
    ] as const;
    const byId = new Map(collectionMarketDetailCards.map((c) => [c.id, c]));
    const out: CollectionDetailCard[] = [];
    if (player) {
      out.push({
        id: "player",
        label: "Player",
        value: toCardDisplayUppercase(player),
      });
    }
    for (const id of priority) {
      const row = byId.get(id);
      if (row) out.push(row);
    }
    for (const row of collectionMarketDetailCards) {
      if (!out.some((r) => r.id === row.id)) {
        out.push(row);
      }
    }
    return out;
  }, [collectionMarketDetailCards, collectionHeadlineCardName]);

  return {
    metadataRows,
    subtitle,
    headlineSetLine,
    collectionCategoryBadge,
    collectionHeadlineParts,
    collectionHeadlineDisplayTitle,
    collectionHeadlineMetaStrip,
    headlineGradeBadge,
    collectionPopulationBadge,
    collectionWovenTitle,
    headlineInfoTags,
    detailsCatalogLine,
    heroDetailsKvRows,
  };
}

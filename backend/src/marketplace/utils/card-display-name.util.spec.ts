import {
  cardDisplayPartsFromAssetDetail,
  CARD_DISPLAY_GRADE_RAW,
  formatCardDisplayLanguageShort,
  formatCardDisplayLine1,
  formatCardDisplayLine2,
  formatCardDisplayName,
  formatDetailBreadcrumbTrail,
  formatCardDisplaySetLabel,
  joinCardDisplaySegments,
  preferCatalogExpansionInBrandDisplay,
  stripLeadingTcgSeriesFromSetDisplay,
  resolveCardDisplaySetName,
  isDisplayVariantDuplicateOfSet,
  shouldHideDuplicateVariant,
  resolveCardDisplayGrade,
  stripCategoryPrefixFromSet,
} from "@/lib/marketplace/cardDisplayName";
import {
  buildAssetDetailHeadlineParts,
  buildRwaAssetDetailHeadlineParts,
  resolveRwaHeadlineGrade,
} from "@/lib/marketplace/assetDetailHeadline";
import { extractCardNumberFromDisplayText } from "@/lib/marketplace/collectionFullDetailsTitle";

describe("cardDisplayName SSOT", () => {
  it("joinCardDisplaySegments skips empty segments", () => {
    expect(joinCardDisplaySegments(["A", "", "B"])).toBe("A · B");
    expect(joinCardDisplaySegments([])).toBe("");
  });

  it("resolveCardDisplayGrade defaults to Raw", () => {
    expect(resolveCardDisplayGrade(null)).toBe(CARD_DISPLAY_GRADE_RAW);
    expect(resolveCardDisplayGrade("  ")).toBe(CARD_DISPLAY_GRADE_RAW);
    expect(resolveCardDisplayGrade("PSA 10")).toBe("PSA 10");
  });

  it("formatCardDisplaySetLabel drops hyphens and uppercases OP", () => {
    expect(formatCardDisplaySetLabel("Op13-Carrying On His Will")).toBe(
      "OP13 Carrying On His Will",
    );
  });

  it("formatCardDisplayLanguageShort maps catalog tokens", () => {
    expect(formatCardDisplayLanguageShort("english")).toBe("EN");
    expect(formatCardDisplayLanguageShort("JP")).toBe("JP");
    expect(formatCardDisplayLanguageShort("")).toBeNull();
  });

  it("formats Line 1 with middots and mandatory grade", () => {
    const line1 = formatCardDisplayLine1({
      cardName: "Charizard ex",
      cardNumber: "199/165",
      grade: null,
      year: null,
      setName: null,
      language: null,
      variant: null,
    });
    expect(line1).toBe("Charizard ex · 199/165 · Raw");
  });

  it("omits grade on asset-detail Line 1", () => {
    expect(
      formatCardDisplayLine1(
        {
          cardName: "Charizard ex",
          cardNumber: "199/165",
          grade: "PSA 10",
          year: "2023",
          setName: "151",
          language: "EN",
          variant: "Special Illustration Rare",
        },
        { omitGrade: true },
      ),
    ).toBe("Charizard ex · 199/165");
  });

  it("extracts collector number from a listing title", () => {
    expect(
      extractCardNumberFromDisplayText(
        "2023 Pokemon 151 Charizard ex #199/165 PSA 10",
      ),
    ).toBe("199/165");
    expect(extractCardNumberFromDisplayText("Monkey D. Luffy OP13-118")).toBe(
      "OP13118",
    );
    expect(
      extractCardNumberFromDisplayText("Master Ball Reverse Holo · 094"),
    ).toBe("094");
  });

  it("puts Gengar collector number on line 1 and Master Ball variant on line 2", () => {
    const parts = buildAssetDetailHeadlineParts({
      setLine: "2023 POKEMON JAPANESE SV2a-POKEMON CARD 151",
      year: 2023,
      cardName: "Gengar",
      cardNumber: null,
      variety: "Master Ball Reverse Holo · 094",
      language: "JP",
    });
    expect(parts.cardNumber).toBe("094");
    expect(parts.variety).toBe("Master Ball Reverse Holo");
    expect(
      formatCardDisplayLine1(cardDisplayPartsFromAssetDetail(parts), {
        omitGrade: true,
      }),
    ).toBe("Gengar · 094");
    const line2 = formatCardDisplayLine2(cardDisplayPartsFromAssetDetail(parts));
    expect(line2).toContain("Master Ball Reverse Holo");
    expect(line2).not.toMatch(/\b094\b/);
    expect(line2.startsWith("2023")).toBe(true);
  });

  it("buildRwaAssetDetailHeadlineParts uses the same Gengar layout as collection detail", () => {
    const parts = buildRwaAssetDetailHeadlineParts(
      {
        name: "Gengar",
        properties: {
          graded: {
            psa: {
              Year: "2023",
              brand: "2023 POKEMON JAPANESE SV2a-POKEMON CARD 151",
              subject: "Gengar",
              variety: "Master Ball Reverse Holo · 094",
            },
            card: { name: "Gengar" },
          },
        },
      },
      "RWA #1",
    );
    expect(
      formatCardDisplayLine1(cardDisplayPartsFromAssetDetail(parts), {
        omitGrade: true,
      }),
    ).toBe("Gengar · 094");
    const line2 = formatCardDisplayLine2(cardDisplayPartsFromAssetDetail(parts));
    expect(line2).toBe(
      "2023 · SV2a Pokemon Card 151 JP · Master Ball Reverse Holo",
    );
  });

  it("formats Line 2 as Year · Set Language · Variant", () => {
    const line2 = formatCardDisplayLine2({
      cardName: null,
      cardNumber: null,
      grade: null,
      year: "2023",
      setName: "151",
      language: "EN",
      variant: "Special Illustration Rare",
    });
    expect(line2).toBe("2023 · 151 EN · Special Illustration Rare");
  });

  it("formats One Piece Line 1 with uppercase number token", () => {
    const line1 = formatCardDisplayLine1({
      cardName: "Monkey D. Luffy",
      cardNumber: "#OP13-118",
      grade: "PSA 10",
      year: null,
      setName: null,
      language: null,
      variant: null,
    });
    expect(line1).toBe("Monkey D. Luffy · OP13118 · PSA 10");
    expect(
      formatCardDisplayLine1({
        cardName: "Pikachu",
        cardNumber: "#085",
        grade: "PSA 10",
        year: null,
        setName: null,
        language: null,
        variant: null,
      }),
    ).toBe("Pikachu · 085 · PSA 10");
  });

  it("abbrev Line 1 drops number", () => {
    const { line1 } = formatCardDisplayName(
      {
        cardName: "Charizard ex",
        cardNumber: "199/165",
        grade: "PSA 10",
        year: "2023",
        setName: "151",
        language: "EN",
        variant: "SIR",
      },
      { mode: "line1Abbrev" },
    );
    expect(line1).toBe("Charizard ex · PSA 10");
  });

  it("stripCategoryPrefixFromSet removes duplicate category", () => {
    expect(
      stripCategoryPrefixFromSet(
        "2025 One Piece Op13-Carrying On His Will",
        "One Piece",
      ),
    ).toBe("2025 · Op13-Carrying On His Will");
  });

  it("formatDetailBreadcrumbTrail is Set (Language) without year", () => {
    expect(
      formatDetailBreadcrumbTrail({
        setLine: "2025 One Piece OP13 Carrying On His Will",
        categoryLabel: "One Piece",
        language: "JP",
      }),
    ).toBe("OP13 Carrying On His Will (JP)");
    expect(
      formatDetailBreadcrumbTrail({
        setName: "OP13 Carrying On His Will",
        categoryLabel: "One Piece",
        language: null,
      }),
    ).toBe("OP13 Carrying On His Will");
  });

  it("Line 2 always keeps set even when breadcrumb also shows set", () => {
    const parts = {
      cardName: null,
      cardNumber: null,
      grade: null,
      year: "2025",
      setName: "OP13 Carrying On His Will",
      language: "JP",
      variant: "Red Manga Alternate Art",
    };
    expect(formatCardDisplayLine2(parts)).toBe(
      "2025 · OP13 Carrying On His Will JP · Red Manga Alternate Art",
    );
  });

  it("Line 1 excludes variant (variant is Line 2 only)", () => {
    expect(
      formatCardDisplayLine1({
        cardName: "Charizard ex",
        cardNumber: "199/165",
        grade: "PSA 10",
        year: "2023",
        setName: "151 EN",
        language: "EN",
        variant: "Special Illustration Rare",
      }),
    ).toBe("Charizard ex · 199/165 · PSA 10");
  });

  it("preferCatalogExpansionInBrandDisplay uses catalog expansion inside PSA Brand", () => {
    expect(
      preferCatalogExpansionInBrandDisplay(
        "Pokemon Japanese Sword & Shield Eevee Heroes",
        "Eevee Heroes",
      ),
    ).toBe("Pokemon Japanese Eevee Heroes");
    expect(
      preferCatalogExpansionInBrandDisplay(
        "Pokemon Japanese Sword & Shield Eevee Heroes",
        "s6a Eevee Heroes",
      ),
    ).toBe("Pokemon Japanese Eevee Heroes");
  });

  it("stripLeadingTcgSeriesFromSetDisplay drops Word & Word series when expansion remains", () => {
    expect(
      stripLeadingTcgSeriesFromSetDisplay(
        "Pokemon Japanese Sword & Shield Eevee Heroes",
      ),
    ).toBe("Pokemon Japanese Eevee Heroes");
    expect(
      stripLeadingTcgSeriesFromSetDisplay(
        "Pokemon Japanese Scarlet & Violet 151",
      ),
    ).toBe("Pokemon Japanese 151");
    expect(
      stripLeadingTcgSeriesFromSetDisplay(
        "Japanese Sword & Shield Eevee Heroes",
      ),
    ).toBe("Japanese Eevee Heroes");
    expect(
      stripLeadingTcgSeriesFromSetDisplay("Pokemon HeartGold & SoulSilver"),
    ).toBe("Pokemon HeartGold & SoulSilver");
    expect(
      stripLeadingTcgSeriesFromSetDisplay("OP13 Carrying On His Will"),
    ).toBe("OP13 Carrying On His Will");
  });

  it("resolveCardDisplaySetName drops series even when catalog includes it", () => {
    expect(
      resolveCardDisplaySetName(
        "Pokemon Japanese Sword & Shield Eevee Heroes",
        "Sword & Shield Eevee Heroes",
      ),
    ).toBe("Pokemon Japanese Eevee Heroes");
    expect(
      resolveCardDisplaySetName(
        "Pokemon Japanese Sword & Shield Eevee Heroes",
        null,
      ),
    ).toBe("Pokemon Japanese Eevee Heroes");
  });

  it("preferCatalogExpansionInBrandDisplay leaves Brand unchanged without a catalog match", () => {
    const brand = "Pokemon Japanese Sword & Shield Eevee Heroes";
    expect(preferCatalogExpansionInBrandDisplay(brand, null)).toBe(brand);
    expect(preferCatalogExpansionInBrandDisplay(brand, "Lost Origin")).toBe(brand);
    expect(
      preferCatalogExpansionInBrandDisplay("2023 Topps Chrome", "Topps Chrome"),
    ).toBe("2023 Topps Chrome");
  });

  it("buildAssetDetailHeadlineParts prefers catalog set on Line 2 without dropping variant or number", () => {
    const parts = buildAssetDetailHeadlineParts({
      setLine: "2021 Pokemon Japanese Sword & Shield Eevee Heroes",
      year: 2021,
      cardName: "Eevee",
      cardNumber: "085",
      variety: "Eevee Heroes",
      language: "JP",
      catalogSetName: "Eevee Heroes",
    });
    expect(parts.cardNumber).toBe("085");
    expect(parts.variety).toBe("Eevee Heroes");
    expect(formatCardDisplayLine2(cardDisplayPartsFromAssetDetail(parts))).toBe(
      "2021 · Eevee Heroes JP",
    );
    const noCatalog = buildAssetDetailHeadlineParts({
      setLine: "2021 Pokemon Japanese Sword & Shield Eevee Heroes",
      year: 2021,
      cardName: "Fa Umbreon Vmax",
      cardNumber: "095",
      variety: "Eevee Heroes",
      language: "JP",
    });
    expect(formatCardDisplayLine2(cardDisplayPartsFromAssetDetail(noCatalog))).toBe(
      "2021 · Eevee Heroes JP",
    );
    expect(
      formatDetailBreadcrumbTrail({
        setName: "Pokemon Japanese Sword & Shield Eevee Heroes",
        categoryLabel: "Pokemon",
        language: "JP",
      }),
    ).toBe("Japanese Eevee Heroes (JP)");
  });

  it("hides Line 2 variant when it is a set-name phrase", () => {
    expect(
      isDisplayVariantDuplicateOfSet(
        "Eevee Heroes",
        "Pokemon Japanese Eevee Heroes",
      ),
    ).toBe(true);
    expect(
      formatCardDisplayLine2({
        cardName: null,
        cardNumber: null,
        grade: null,
        year: "2021",
        setName: "Pokemon Japanese Eevee Heroes",
        language: "JP",
        variant: "Eevee Heroes",
      }),
    ).toBe("2021 · Eevee Heroes JP");
    expect(
      formatCardDisplayLine2({
        cardName: null,
        cardNumber: null,
        grade: null,
        year: "2022",
        setName: "Pokemon Japanese VSTAR Universe",
        language: "JP",
        variant: "VSTAR Universe",
      }),
    ).toBe("2022 · VSTAR Universe JP");
  });

  it("shouldHideDuplicateVariant hides only expansion-name repeats", () => {
    expect(
      shouldHideDuplicateVariant({
        variant: "Eevee Heroes-Hyper",
        displayedSetName: "Pokemon Japanese Eevee Heroes",
      }),
    ).toBe(true);
    expect(
      shouldHideDuplicateVariant({
        variant: "Eevee Heroes",
        displayedSetName: "Pokemon Japanese Eevee Heroes",
      }),
    ).toBe(true);
    expect(
      shouldHideDuplicateVariant({
        variant: "VSTAR Universe",
        displayedSetName: "Pokemon Japanese VSTAR Universe",
        psaBrand: "Pokemon Japanese Sword & Shield VSTAR Universe",
      }),
    ).toBe(true);
    expect(
      shouldHideDuplicateVariant({
        variant: "Reverse Holo",
        displayedSetName: "Pokemon Japanese SV2a Pokemon Card 151",
      }),
    ).toBe(false);
    expect(
      shouldHideDuplicateVariant({
        variant: "Master Ball Reverse Holo",
        displayedSetName: "Pokemon Japanese SV2a Pokemon Card 151",
      }),
    ).toBe(false);
    expect(
      shouldHideDuplicateVariant({
        variant: "Special Illustration Rare",
        displayedSetName: "Pokemon Japanese 151",
      }),
    ).toBe(false);
    expect(
      shouldHideDuplicateVariant({
        variant: "Silver Prizm",
        displayedSetName: "Panini Prizm",
      }),
    ).toBe(false);
    expect(
      shouldHideDuplicateVariant({
        variant: "Red Manga Alternate Art",
        displayedSetName: "OP13 Carrying On His Will",
      }),
    ).toBe(false);
  });

  it("keeps finish variants when the catalog set line also names the finish", () => {
    expect(
      shouldHideDuplicateVariant({
        variant: "Reverse Holo",
        displayedSetName: "Pokemon Japanese SV2a Pokemon Card 151 Reverse Holo",
        psaBrand: "POKEMON JAPANESE SV2a POKEMON CARD 151",
      }),
    ).toBe(false);
    expect(
      formatCardDisplayLine2({
        cardName: null,
        cardNumber: null,
        grade: null,
        year: "2023",
        setName: "Pokemon Japanese SV2a Pokemon Card 151",
        language: "JP",
        variant: "Reverse Holo",
      }),
    ).toBe("2023 · SV2a Pokemon Card 151 JP · Reverse Holo");
    expect(
      formatCardDisplayLine2({
        cardName: null,
        cardNumber: null,
        grade: null,
        year: "2023",
        setName: "Pokemon Japanese SV2a Pokemon Card 151",
        language: "JP",
        variant: "Master Ball Reverse Holo",
      }),
    ).toBe("2023 · SV2a Pokemon Card 151 JP · Master Ball Reverse Holo");
  });

  it("keeps real parallel and rarity variants on Line 2", () => {
    expect(
      formatCardDisplayLine2({
        cardName: null,
        cardNumber: null,
        grade: null,
        year: "2023",
        setName: "Pokemon Japanese 151",
        language: "JP",
        variant: "Special Illustration Rare",
      }),
    ).toBe("2023 · 151 JP · Special Illustration Rare");
    expect(
      formatCardDisplayLine2({
        cardName: null,
        cardNumber: null,
        grade: null,
        year: "2023",
        setName: "Panini Prizm",
        language: null,
        variant: "Silver Prizm",
      }),
    ).toBe("2023 · Panini Prizm · Silver Prizm");
    expect(
      formatCardDisplayLine2({
        cardName: null,
        cardNumber: null,
        grade: null,
        year: "2025",
        setName: "OP13 Carrying On His Will",
        language: "JP",
        variant: "Red Manga Alternate Art",
      }),
    ).toBe("2025 · OP13 Carrying On His Will JP · Red Manga Alternate Art");
    expect(
      formatCardDisplayLine2({
        cardName: null,
        cardNumber: null,
        grade: null,
        year: "2025",
        setName: "One Piece OP13 Carrying On His Will",
        language: "JP",
        variant: "Red Manga Alternate Art",
      }),
    ).toBe("2025 · OP13 Carrying On His Will JP · Red Manga Alternate Art");
    expect(
      formatCardDisplayLine2({
        cardName: null,
        cardNumber: null,
        grade: null,
        year: "2025",
        setName: "2025 One Piece Carrying On His Will",
        language: null,
        variant: "Red Manga Alternate Art",
      }),
    ).toBe("2025 · Carrying On His Will · Red Manga Alternate Art");
    expect(
      isDisplayVariantDuplicateOfSet("RED", "Panini Prizm Red"),
    ).toBe(false);
  });

  it("cardDisplayPartsFromAssetDetail maps variety to variant", () => {
    const parts = cardDisplayPartsFromAssetDetail(
      {
        cardName: "Test",
        variety: "Holo",
      },
      "PSA 9",
    );
    expect(parts.variant).toBe("Holo");
    expect(parts.grade).toBe("PSA 9");
  });

  it("resolveRwaHeadlineGrade uses PSA score not GEM MT label", () => {
    expect(
      resolveRwaHeadlineGrade({
        properties: {
          graded: {
            gradingCompany: "PSA",
            psa: {
              gradeLabel: "GEM MT 10",
              gradeScore: 10,
            },
          },
        },
      }),
    ).toBe("PSA 10");
    expect(
      resolveRwaHeadlineGrade({
        graded: {
          psa: { gradeLabel: "GEM MT 10" },
        },
      }),
    ).toBe("PSA 10");
  });
});

import {
  cardDisplayPartsFromAssetDetail,
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
  resolveCardDisplayLine1Collisions,
} from "@/lib/marketplace/cardDisplayName";
import {
  buildAssetDetailHeadlineParts,
  buildRwaAssetDetailHeadlineParts,
  resolveRwaHeadlineGrade,
} from "@/lib/marketplace/assetDetailHeadline";
import { buildCollectionMarketDetailCards } from "@/lib/marketplace/buildCollectionMarketDetailCards";
import { extractCardNumberFromDisplayText } from "@/lib/marketplace/collectionFullDetailsTitle";
import type { CollectionComponents } from "@/lib/marketplace/collectionDetailComponents";

describe("cardDisplayName SSOT", () => {
  it("joinCardDisplaySegments skips empty segments", () => {
    expect(joinCardDisplaySegments(["A", "", "B"])).toBe("A · B");
    expect(joinCardDisplaySegments([])).toBe("");
  });

  it("resolveCardDisplayGrade returns Raw for empty or unknown grades", () => {
    expect(resolveCardDisplayGrade(null)).toBe("Raw");
    expect(resolveCardDisplayGrade("  ")).toBe("Raw");
    expect(resolveCardDisplayGrade("Raw")).toBe("Raw");
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

  it("formats Line 1 with Raw for unknown grade", () => {
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
    expect(
      formatCardDisplayLine1({
        cardName: "Kobe Bryant",
        cardNumber: null,
        grade: "Raw",
        year: null,
        setName: null,
        language: null,
        variant: null,
      }),
    ).toBe("Kobe Bryant · Raw");
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
      "OP13-118",
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

  it("moves a mid-set language code to after the set name", () => {
    const line2 = formatCardDisplayLine2({
      cardName: "Pikachu Grey Felt Hat",
      cardNumber: "085",
      grade: "PSA 10",
      year: "2023",
      setName: "Svp EN Sv Black Star Promo",
      language: "EN",
      variant: "Pokemon X Van Gogh",
    });
    expect(line2).toBe(
      "2023 · Svp Sv Black Star Promo EN · Pokemon X Van Gogh",
    );
  });

  it("formats One Piece Line 1 with collector number only (set code stays on Line 2)", () => {
    const line1 = formatCardDisplayLine1({
      cardName: "Monkey D. Luffy",
      cardNumber: "#OP13-118",
      grade: "PSA 10",
      year: null,
      setName: null,
      language: null,
      variant: null,
    });
    expect(line1).toBe("Monkey D. Luffy · 118 · PSA 10");
    expect(
      formatCardDisplayLine1({
        cardName: "Monkey D. Luffy",
        cardNumber: "ST01-009",
        grade: "PSA 10",
        year: null,
        setName: null,
        language: null,
        variant: null,
      }),
    ).toBe("Monkey D. Luffy · 009 · PSA 10");
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

  it("resolves Line 1 list collisions with the smallest differentiator", () => {
    const collisionItems = [
      {
        id: "sir",
        parts: {
          cardName: "Charizard ex",
          cardNumber: "199/165",
          grade: "PSA 10",
          year: "2023",
          setName: "Pokemon 151",
          language: "EN",
          variant: "Special Illustration Rare",
        },
      },
      {
        id: "hyper",
        parts: {
          cardName: "Charizard ex",
          cardNumber: "199/165",
          grade: "PSA 10",
          year: "2023",
          setName: "Pokemon 151",
          language: "EN",
          variant: "Hyper Rare",
        },
      },
      {
        id: "pikachu",
        parts: {
          cardName: "Pikachu",
          cardNumber: "025",
          grade: "PSA 10",
          year: "2023",
          setName: "Pokemon 151",
          language: "EN",
          variant: null,
        },
      },
    ];
    const resolved = resolveCardDisplayLine1Collisions(collisionItems);
    expect(resolved.get("sir")).toBe(
      "Charizard ex · 199/165 · PSA 10 · Special Illustration Rare",
    );
    expect(resolved.get("hyper")).toBe(
      "Charizard ex · 199/165 · PSA 10 · Hyper Rare",
    );
    expect(resolved.get("pikachu")).toBe("Pikachu · 025 · PSA 10");
  });

  it("falls back to year then set for Line 1 collisions", () => {
    const byYear = resolveCardDisplayLine1Collisions([
      {
        id: "2022",
        parts: {
          cardName: "Pikachu",
          cardNumber: "001",
          grade: "PSA 10",
          year: "2022",
          setName: "Pokemon Promo",
          language: "EN",
          variant: null,
        },
      },
      {
        id: "2023",
        parts: {
          cardName: "Pikachu",
          cardNumber: "001",
          grade: "PSA 10",
          year: "2023",
          setName: "Pokemon Promo",
          language: "EN",
          variant: null,
        },
      },
    ]);
    expect(byYear.get("2022")).toBe("Pikachu · 001 · PSA 10 · 2022");
    expect(byYear.get("2023")).toBe("Pikachu · 001 · PSA 10 · 2023");

    const bySet = resolveCardDisplayLine1Collisions([
      {
        id: "151",
        parts: {
          cardName: "Pikachu",
          cardNumber: "025",
          grade: "PSA 10",
          year: "2023",
          setName: "Pokemon 151",
          language: "EN",
          variant: null,
        },
      },
      {
        id: "promo",
        parts: {
          cardName: "Pikachu",
          cardNumber: "025",
          grade: "PSA 10",
          year: "2023",
          setName: "Pokemon Promo",
          language: "EN",
          variant: null,
        },
      },
    ]);
    expect(bySet.get("151")).toBe("Pikachu · 025 · PSA 10 · 151");
    expect(bySet.get("promo")).toBe("Pikachu · 025 · PSA 10 · Promo");
  });

  it("stripCategoryPrefixFromSet removes duplicate category", () => {
    expect(
      stripCategoryPrefixFromSet(
        "2025 One Piece Op13-Carrying On His Will",
        "One Piece",
      ),
    ).toBe("2025 · Op13-Carrying On His Will");
  });

  it("formatDetailBreadcrumbTrail is SetCode Set (Language) without year", () => {
    expect(
      formatDetailBreadcrumbTrail({
        setLine: "2025 One Piece OP13 Carrying On His Will",
        categoryLabel: "One Piece",
        language: "JP",
        cardNumber: "OP13-118",
      }),
    ).toBe("OP13 Carrying On His Will (JP)");
    expect(
      formatDetailBreadcrumbTrail({
        setName: "OP13 Carrying On His Will",
        categoryLabel: "One Piece",
        language: null,
        cardNumber: "OP13-118",
      }),
    ).toBe("OP13 Carrying On His Will");
    expect(
      formatDetailBreadcrumbTrail({
        setLine: "2023 POKEMON JAPANESE SV2a-POKEMON CARD 151",
        setCode: "SV2a",
        categoryLabel: "Pokemon",
        language: "JP",
        cardNumber: "006",
      }),
    ).toBe("SV2a 151 (JP)");
  });

  it("Line 2 omits set when breadcrumb already shows it", () => {
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
    expect(
      formatCardDisplayLine2(parts, {
        breadcrumbSetName: "OP13 Carrying On His Will",
      }),
    ).toBe("2025 · Red Manga Alternate Art");
    expect(formatCardDisplayName(parts, {
      mode: "line1+line2",
      breadcrumbSetName: "OP13 Carrying On His Will",
    }).line2).toBe("2025 · Red Manga Alternate Art");
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
    ).toBe("Eevee Heroes (JP)");
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

  it("Details Set / Card number split One Piece compound ids", () => {
    const baseComp = {
      cardSet: "2025 One Piece Carrying On His Will",
      psaBrand: "2025 One Piece Carrying On His Will",
    } as CollectionComponents;

    const withCatalog = buildCollectionMarketDetailCards({
      key: "test-key",
      hasCollection: true,
      marketPreview: {
        card: { setName: "One Piece OP13 Carrying On His Will" },
      } as never,
      comp: baseComp,
      headlineCardNumberToken: "OP13-118",
      headlineSetLine: "2025 One Piece Carrying On His Will",
      collectionCategoryBadge: "One Piece",
    });
    expect(withCatalog.find((r) => r.id === "set")?.value).toBe(
      "Carrying On His Will",
    );
    expect(withCatalog.find((r) => r.id === "set")?.filterValue).toBe(
      "One Piece Carrying On His Will",
    );
    expect(withCatalog.find((r) => r.id === "set-code")).toBeUndefined();
    expect(withCatalog.find((r) => r.id === "card-number")?.value).toBe("#118");

    const fromLine = buildCollectionMarketDetailCards({
      key: "test-key",
      hasCollection: true,
      marketPreview: null,
      comp: baseComp,
      headlineCardNumberToken: null,
      headlineSetLine: "2025 One Piece Carrying On His Will",
      collectionCategoryBadge: "One Piece",
    });
    const setLine = fromLine.find((r) => r.id === "set");
    expect(setLine?.value).toBe("Carrying On His Will");
    expect(setLine?.filterValue).toBe("One Piece Carrying On His Will");
  });

  it("Details Series from normalizedPokemon (no Set code row)", () => {
    const rows = buildCollectionMarketDetailCards({
      key: "test-key",
      hasCollection: true,
      marketPreview: null,
      comp: {
        cardNumber: "6",
        cardSet: "POKEMON JAPANESE SV2a-POKEMON CARD 151",
        psaBrand: "POKEMON JAPANESE SV2a-POKEMON CARD 151",
        normalizedPokemon: {
          game: "pokemon",
          series: "Scarlet & Violet",
          setName: "Pokémon Card 151",
          setCode: "SV2a",
          cardNumber: "6",
        },
      } as CollectionComponents,
      headlineCardNumberToken: "006",
      headlineSetLine: "POKEMON JAPANESE SV2a-POKEMON CARD 151",
      collectionCategoryBadge: "Pokemon",
      languageLabel: "JP",
    });
    expect(rows.find((r) => r.id === "series")?.value).toBe("Scarlet & Violet");
    expect(rows.find((r) => r.id === "set")?.value).toBe("151");
    expect(rows.find((r) => r.id === "set-code")).toBeUndefined();
    expect(rows.find((r) => r.id === "card-number")?.value).toBe("#6");
    expect(rows.find((r) => r.id === "language")?.value).toBe("Japanese");
  });

  it("Details Language omitted when unknown (no English default)", () => {
    const rows = buildCollectionMarketDetailCards({
      key: "test-key",
      hasCollection: true,
      marketPreview: null,
      comp: {
        cardSet: "2023 Panini Prizm",
      } as CollectionComponents,
      headlineCardNumberToken: "001",
      headlineSetLine: "2023 Panini Prizm",
      collectionCategoryBadge: "NBA",
      languageLabel: null,
    });
    expect(rows.find((r) => r.id === "language")).toBeUndefined();
  });

  it("Details Card number matches Card.html printed / set size", () => {
    const rows = buildCollectionMarketDetailCards({
      key: "test-key",
      hasCollection: true,
      marketPreview: null,
      comp: {
        cardNumber: "199/165",
        normalizedPokemon: {
          game: "pokemon",
          series: "Scarlet & Violet",
          setName: "151",
          cardNumber: "199/165",
        },
      } as CollectionComponents,
      headlineCardNumberToken: "199/165",
      headlineSetLine: "2023 Pokemon 151 EN",
      collectionCategoryBadge: "Pokemon",
      languageLabel: "EN",
    });
    expect(rows.find((r) => r.id === "card-number")?.value).toBe("#199 / 165");
    expect(rows.find((r) => r.id === "language")?.value).toBe("English");
    expect(rows.find((r) => r.id === "series")?.value).toBe("Scarlet & Violet");
  });
});

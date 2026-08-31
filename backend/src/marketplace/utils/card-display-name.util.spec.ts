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
  resolveCardDisplayGrade,
  stripCategoryPrefixFromSet,
} from "@/lib/marketplace/cardDisplayName";

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
});

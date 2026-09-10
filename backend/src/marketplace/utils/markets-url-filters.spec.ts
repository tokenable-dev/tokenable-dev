import {
  marketsHrefForDetailRow,
  parseMarketsUrlFilters,
} from "@/lib/markets/marketsUrlFilters";

describe("marketsHrefForDetailRow (Card.html Details → Markets)", () => {
  const pokemon = { categoryBadge: "Pokémon" };

  it("Card name → cat + character", () => {
    expect(marketsHrefForDetailRow("character", "Charizard", pokemon)).toBe(
      "/markets?cat=tcg%2Fpokemon&character=Charizard",
    );
  });

  it("Category → cat only", () => {
    expect(marketsHrefForDetailRow("category", "Pokémon")).toBe(
      "/markets?cat=tcg%2Fpokemon",
    );
  });

  it("Series → cat + series", () => {
    expect(marketsHrefForDetailRow("series", "Scarlet & Violet", pokemon)).toBe(
      "/markets?cat=tcg%2Fpokemon&series=Scarlet+%26+Violet",
    );
  });

  it("Set → cat + set (Markets facet token)", () => {
    expect(marketsHrefForDetailRow("set", "151 EN", pokemon)).toBe(
      "/markets?cat=tcg%2Fpokemon&set=151+EN",
    );
  });

  it("Year → cat + year_min/max", () => {
    expect(marketsHrefForDetailRow("year", "2023", pokemon)).toBe(
      "/markets?cat=tcg%2Fpokemon&year_min=2023&year_max=2023",
    );
  });

  it("Grade / grader omit cat (Card.html ?grade=PSA%2010)", () => {
    expect(
      marketsHrefForDetailRow("grade", "10", { ...pokemon, grader: "PSA" }),
    ).toBe("/markets?grade=PSA+10");
    expect(
      marketsHrefForDetailRow("grader", "PSA", {
        ...pokemon,
        gradeScore: "10",
      }),
    ).toBe("/markets?grade=PSA+10");
  });

  it("Card number / variant / language are not linked", () => {
    expect(marketsHrefForDetailRow("card-number", "#199 / 165", pokemon)).toBeNull();
    expect(
      marketsHrefForDetailRow("variant", "Special Illustration Rare", pokemon),
    ).toBeNull();
    expect(marketsHrefForDetailRow("language", "English", pokemon)).toBeNull();
  });

  it("parseMarketsUrlFilters reads series and default sort", () => {
    const f = parseMarketsUrlFilters(
      new URLSearchParams("cat=tcg/pokemon&series=Scarlet%20%26%20Violet"),
    );
    expect(f.categories).toEqual(["pokemon"]);
    expect(f.series).toEqual(["Scarlet & Violet"]);
    expect(f.sortId).toBe("high_price");
  });
});

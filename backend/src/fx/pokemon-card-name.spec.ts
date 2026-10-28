import { formatCardDisplayLine1, formatCardDisplayLine2 } from "@/lib/marketplace/cardDisplayName";
import {
  localizeDisplayedCardName,
  rememberCatalogTranslation,
  resetCatalogTranslations,
} from "@/lib/marketplace/catalogNameTranslation";
import {
  catalogSearchQuery,
  localizePokemonCardName,
  setDisplayLocaleSnapshot,
} from "@/lib/marketplace/localizePokemonCardName";

const PARTS = {
  cardName: "Mega Gengar ex",
  cardNumber: "240",
  grade: "PSA 10",
  year: null,
  setName: "Phantasmal Flames",
  language: "EN",
  variant: null,
};

describe("pokemon card name display", () => {
  afterEach(() => {
    setDisplayLocaleSnapshot("en");
    resetCatalogTranslations();
  });

  it("keeps the English name, number, and grade", () => {
    expect(formatCardDisplayLine1(PARTS)).toBe("Mega Gengar ex · 240 · PSA 10");
  });

  it("searches a localized species name as the stored English name", () => {
    expect(catalogSearchQuery("ピカチュウ")).toBe("pikachu");
    expect(catalogSearchQuery("皮卡丘")).toBe("pikachu");
    expect(catalogSearchQuery("メガゲンガー")).toBe("mega gengar");
    expect(catalogSearchQuery("ピカチュウ 25")).toBe("pikachu 25");
    expect(catalogSearchQuery("Pikachu")).toBe("Pikachu");
    expect(catalogSearchQuery("ピカ")).toBe("pikachu");
  });

  it("translates only the species and form prefix", () => {
    setDisplayLocaleSnapshot("ja");
    expect(formatCardDisplayLine1(PARTS)).toBe("メガゲンガー ex · 240 · PSA 10");
    expect(localizePokemonCardName("Charizard ex", "zh-CN")).toBe("喷火龙 ex");
    expect(localizePokemonCardName("Alolan Ninetales", "zh-TW")).toBe("阿羅拉九尾");
    expect(localizePokemonCardName("Mega Gengar ex", "zh-CN")).toBe("超级耿鬼 ex");
  });

  it("keeps a name with no species match until a translation is cached", () => {
    setDisplayLocaleSnapshot("ja");
    expect(localizePokemonCardName("Monkey D. Luffy")).toBe("Monkey D. Luffy");
    expect(formatCardDisplayLine1({ ...PARTS, cardName: "Shohei Ohtani" })).toBe(
      "Shohei Ohtani · 240 · PSA 10",
    );
  });

  it("uses a cached catalog translation for names outside the species list", () => {
    setDisplayLocaleSnapshot("ja");
    rememberCatalogTranslation("ja", "Monkey D. Luffy", "モンキー・D・ルフィ");
    rememberCatalogTranslation("ja", "Shohei Ohtani", "大谷翔平");
    rememberCatalogTranslation("ja", "Phantasmal Flames", "幻想的な炎");
    rememberCatalogTranslation("ja", "Mega Gengar ex", "WRONG");
    expect(formatCardDisplayLine1({ ...PARTS, cardName: "Monkey D. Luffy" })).toBe(
      "モンキー・D・ルフィ · 240 · PSA 10",
    );
    expect(localizeDisplayedCardName("Shohei Ohtani", "ja")).toBe("大谷翔平");
    expect(localizeDisplayedCardName("Mega Gengar ex", "ja")).toBe("メガゲンガー ex");
    expect(formatCardDisplayLine2(PARTS)).toBe("幻想的な炎 EN");
  });
});

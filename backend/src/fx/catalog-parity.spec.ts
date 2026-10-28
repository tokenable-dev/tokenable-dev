import fs from "fs";
import path from "path";
import { canonicalizeLocale, SUPPORTED_LOCALES } from "./supported-currencies";

const LOCALES = ["en", "zh-CN", "ja", "zh-TW"] as const;

function readCatalog(locale: (typeof LOCALES)[number]): unknown {
  const file = path.join(process.cwd(), "../frontend/messages", `${locale}.json`);
  return JSON.parse(fs.readFileSync(file, "utf8")) as unknown;
}

function keyTree(value: unknown, prefix = ""): string[] {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return [prefix];
  }
  return Object.keys(value)
    .sort()
    .flatMap((key) => {
      const next = prefix ? `${prefix}.${key}` : key;
      return keyTree((value as Record<string, unknown>)[key], next);
    });
}

describe("translation catalogs", () => {
  const catalogs = Object.fromEntries(LOCALES.map((locale) => [locale, readCatalog(locale)])) as Record<
    (typeof LOCALES)[number],
    unknown
  >;
  const englishKeys = keyTree(catalogs.en);

  it("keeps the same key tree in every locale", () => {
    for (const locale of LOCALES) {
      expect(keyTree(catalogs[locale])).toEqual(englishKeys);
    }
  });

  it("has a non-empty string for every leaf", () => {
    for (const locale of LOCALES) {
      const missing = englishKeys.filter((key) => {
        const value = key.split(".").reduce<unknown>((node, part) => {
          if (node === null || typeof node !== "object") return undefined;
          return (node as Record<string, unknown>)[part];
        }, catalogs[locale]);
        return typeof value !== "string" || value.trim() === "";
      });
      expect(missing).toEqual([]);
    }
  });

  it("translates collection detail labels without copying one locale onto another", () => {
    const last = LOCALES.map(
      (locale) =>
        (catalogs[locale] as { CollectionDetail: { lastPrice: string; period180d: string } })
          .CollectionDetail,
    );
    expect(new Set(last.map((row) => row.lastPrice)).size).toBe(4);
    expect(last[0]?.period180d).toBe("180d");
    expect(last.map((row) => row.period180d)).toEqual(["180d", "180天", "180日", "180天"]);
  });

  it("translates the markets category chips", () => {
    const labels = LOCALES.map(
      (locale) =>
        (catalogs[locale] as {
          Markets: { pokemon: string; onepiece: string; basketball: string; baseball: string };
        }).Markets,
    );
    expect(labels.map((row) => row.pokemon)).toEqual(["Pokémon", "宝可梦", "ポケモン", "寶可夢"]);
    expect(labels.map((row) => row.onepiece)).toEqual(["One Piece", "海贼王", "ワンピース", "航海王"]);
    expect(labels.map((row) => row.basketball)).toEqual(["NBA", "篮球", "バスケ", "籃球"]);
    expect(labels.map((row) => row.baseball)).toEqual(["MLB", "棒球", "メジャー", "棒球"]);
  });

  it("does not copy Simplified Chinese into Traditional Chinese", () => {
    const simplified = JSON.stringify(catalogs["zh-CN"]);
    const traditional = JSON.stringify(catalogs["zh-TW"]);
    expect(traditional).not.toBe(simplified);
    expect(JSON.stringify(catalogs.ja)).not.toBe(simplified);
  });
});

describe("supported locales", () => {
  it("accepts the four customer locales and canonicalizes case", () => {
    expect([...SUPPORTED_LOCALES]).toEqual(["en", "zh-CN", "ja", "zh-TW"]);
    expect(canonicalizeLocale("en")).toBe("en");
    expect(canonicalizeLocale("zh-cn")).toBe("zh-CN");
    expect(canonicalizeLocale("ZH-TW")).toBe("zh-TW");
    expect(canonicalizeLocale("JA")).toBe("ja");
  });

  it("rejects locales that are not in the allowlist", () => {
    for (const raw of ["ko", "zh", "en-US", "en-us", ""]) {
      expect(canonicalizeLocale(raw)).toBeNull();
    }
  });

  it("keeps an idempotent preferred_locale check in the unapplied SQL", () => {
    for (const rel of ["sql/schema/080_fx.sql", "sql/maintenance/deploy-sync.sql"]) {
      const sql = fs.readFileSync(path.join(process.cwd(), rel), "utf8");
      expect(sql).toContain(
        "DROP CONSTRAINT IF EXISTS users_preferred_locale_check",
      );
      expect(sql).toContain(
        "preferred_locale IS NULL OR preferred_locale IN ('en', 'zh-CN', 'ja', 'zh-TW')",
      );
    }
  });
});

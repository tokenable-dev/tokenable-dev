import speciesNames from "@/lib/marketplace/pokemonSpeciesNames.json";
import { resolveLocale, type AppLocale } from "@/lib/i18n/preferences";

type LocalizedName = { ja: string; "zh-CN": string; "zh-TW": string };

const SPECIES = speciesNames as Record<string, LocalizedName>;

/** Official game prefixes. The TCG suffix (`ex`, `VMAX`) stays as printed. */
const PREFIX: Record<string, LocalizedName> = {
  mega: { ja: "メガ", "zh-CN": "超级", "zh-TW": "超級" },
  alolan: { ja: "アローラ", "zh-CN": "阿罗拉", "zh-TW": "阿羅拉" },
  galarian: { ja: "ガラル", "zh-CN": "伽勒尔", "zh-TW": "伽勒爾" },
  hisuian: { ja: "ヒスイ", "zh-CN": "洗翠", "zh-TW": "洗翠" },
  paldean: { ja: "パルデア", "zh-CN": "帕底亚", "zh-TW": "帕底亞" },
};

const MAX_SPECIES_WORDS = 4;

let localeSnapshot: AppLocale = "en";

export function setDisplayLocaleSnapshot(next: string | null | undefined): void {
  localeSnapshot = resolveLocale(next);
}

export function getDisplayLocale(): AppLocale {
  return localeSnapshot;
}

function tokenKey(token: string): string {
  return token
    .toLowerCase()
    .replace(/['’.:]/g, "")
    .replace(/-/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function label(row: LocalizedName, locale: Exclude<AppLocale, "en">): string {
  return row[locale];
}

/**
 * Display-only. Replaces a Pokemon species (and a leading form prefix) inside
 * the card-name segment. Number, grade, set, and unknown names stay as stored.
 */
export function localizePokemonCardName(name: string, locale: AppLocale = getDisplayLocale()): string {
  if (locale === "en" || !name.trim()) return name;
  const tokens = name.trim().split(/\s+/);
  const keys = tokens.map(tokenKey);
  const out: string[] = [];

  for (let i = 0; i < tokens.length; ) {
    const prefix = PREFIX[keys[i] ?? ""];
    const speciesAt = prefix ? i + 1 : i;
    let span = 0;
    let species: LocalizedName | undefined;
    const room = Math.min(MAX_SPECIES_WORDS, tokens.length - speciesAt);
    for (let width = room; width >= 1; width -= 1) {
      const phrase = keys.slice(speciesAt, speciesAt + width).join(" ");
      const hit = phrase ? SPECIES[phrase] : undefined;
      if (!hit) continue;
      species = hit;
      span = width;
      break;
    }

    if (species && prefix && speciesAt < tokens.length) {
      out.push(`${label(prefix, locale)}${label(species, locale)}`);
      i = speciesAt + span;
      continue;
    }
    if (species && !prefix) {
      out.push(label(species, locale));
      i += span;
      continue;
    }
    out.push(tokens[i] ?? "");
    i += 1;
  }

  return out.join(" ");
}

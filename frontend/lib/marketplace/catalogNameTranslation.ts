import { useSyncExternalStore } from "react";
import type { AppLocale } from "@/lib/i18n/preferences";
import {
  getDisplayLocale,
  localizePokemonCardName,
} from "@/lib/marketplace/localizePokemonCardName";

/**
 * Display-only catalog phrases. Pokemon species stay on the official list.
 * Everything else is filled from `POST /api/fx/catalog-names` and kept in memory.
 * Number, grade, and stored names are not sent.
 */

const KEEP = new Set(["ex", "gx", "vmax", "vstar", "v", "x", "y"]);
const LANG = new Set(["en", "jp", "kr", "cn"]);

const cache = new Map<string, string>();
const pending = new Map<AppLocale, Set<string>>();
const inflight = new Set<string>();
const failedUntil = new Map<string, number>();
const listeners = new Set<() => void>();

let revision = 0;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let flushing = false;

function cacheKey(locale: AppLocale, source: string): string {
  return `${locale}\0${source}`;
}

function coreToken(token: string): string {
  return token.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, "");
}

function isTranslatableToken(token: string): boolean {
  if (/[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/.test(token)) return false;
  const core = coreToken(token);
  if (!core || !/[A-Za-z]/.test(core)) return false;
  const lower = core.toLowerCase();
  if (KEEP.has(lower) || LANG.has(lower)) return false;
  if (/^(?:[a-z]{1,5}\d[\w.-]*|\d+[a-z]{0,3})$/i.test(core)) return false;
  return true;
}

function needsPhrase(text: string): boolean {
  return text.split(/\s+/).some(isTranslatableToken);
}

function bump(): void {
  revision += 1;
  for (const listener of listeners) listener();
}

function noteMiss(source: string, locale: AppLocale): void {
  const key = cacheKey(locale, source);
  if (cache.has(key) || inflight.has(key)) return;
  if ((failedUntil.get(key) ?? 0) > Date.now()) return;
  const bucket = pending.get(locale) ?? new Set<string>();
  bucket.add(source);
  pending.set(locale, bucket);
  scheduleFlush();
}

function scheduleFlush(): void {
  if (typeof window === "undefined" || flushTimer || flushing) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushPending();
  }, 30);
}

async function flushPending(): Promise<void> {
  if (flushing) return;
  const locale = [...pending.keys()].find((code) => (pending.get(code)?.size ?? 0) > 0);
  if (!locale) return;
  const bucket = pending.get(locale);
  if (!bucket || bucket.size === 0) return;
  const texts = [...bucket].slice(0, 40);
  for (const text of texts) {
    bucket.delete(text);
    inflight.add(cacheKey(locale, text));
  }
  if (bucket.size === 0) pending.delete(locale);
  flushing = true;
  let changed = false;
  try {
    const res = await fetch("/api/fx/catalog-names", {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify({ locale, texts }),
    });
    if (!res.ok) {
      markFailed(locale, texts);
      return;
    }
    const body = (await res.json()) as { translations?: Record<string, string> };
    const translations = body.translations ?? {};
    for (const source of texts) {
      const translated = translations[source];
      if (typeof translated !== "string" || !translated.trim()) {
        markFailed(locale, [source]);
        continue;
      }
      cache.set(cacheKey(locale, source), translated.trim());
      if (translated.trim() !== source) changed = true;
    }
  } catch {
    markFailed(locale, texts);
  } finally {
    for (const text of texts) inflight.delete(cacheKey(locale, text));
    flushing = false;
    if (changed) bump();
    if ([...pending.values()].some((set) => set.size > 0)) scheduleFlush();
  }
}

function markFailed(locale: AppLocale, texts: string[]): void {
  const until = Date.now() + 60_000;
  for (const text of texts) failedUntil.set(cacheKey(locale, text), until);
}

export function subscribeCatalogNames(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getCatalogNameRevision(): number {
  return revision;
}

export function useCatalogNameRevision(): number {
  return useSyncExternalStore(subscribeCatalogNames, getCatalogNameRevision, () => 0);
}

/** Test and warm-cache helper. Does not notify listeners. */
export function rememberCatalogTranslation(
  locale: AppLocale,
  source: string,
  translated: string,
): void {
  cache.set(cacheKey(locale, source.trim()), translated);
}

export function resetCatalogTranslations(): void {
  cache.clear();
  pending.clear();
  inflight.clear();
  failedUntil.clear();
  revision = 0;
}

/** Translate one display phrase. A cache miss returns the source and queues a fetch. */
export function localizeCatalogPhrase(
  text: string,
  locale: AppLocale = getDisplayLocale(),
): string {
  const source = text.trim();
  if (!source || locale === "en" || !needsPhrase(source)) return text;
  const hit = cache.get(cacheKey(locale, source));
  if (hit != null) return hit;
  noteMiss(source, locale);
  return text;
}

/**
 * Official Pokemon species first. Leftover Latin words are translated as phrases
 * so `メガゲンガー ex` stays official and `Monkey D. Luffy` can still change.
 */
export function localizeDisplayedCardName(
  name: string,
  locale: AppLocale = getDisplayLocale(),
): string {
  const official = localizePokemonCardName(name, locale);
  if (locale === "en" || !official.trim() || !needsPhrase(official)) return official;
  return applyCatalogSpans(official, locale);
}

function applyCatalogSpans(text: string, locale: AppLocale): string {
  const parts = text.split(/(\s+)/);
  let out = "";
  let span = "";
  const flush = () => {
    if (!span) return;
    const leading = span.match(/^\s*/)?.[0] ?? "";
    const trailing = span.match(/\s*$/)?.[0] ?? "";
    const phrase = span.trim();
    out += phrase ? `${leading}${localizeCatalogPhrase(phrase, locale)}${trailing}` : span;
    span = "";
  };
  for (const part of parts) {
    if (!part) continue;
    if (/^\s+$/.test(part)) {
      if (span) span += part;
      else out += part;
      continue;
    }
    if (isTranslatableToken(part)) {
      span += part;
      continue;
    }
    flush();
    out += part;
  }
  flush();
  return out;
}

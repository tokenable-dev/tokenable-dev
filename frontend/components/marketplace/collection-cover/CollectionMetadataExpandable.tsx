"use client";

import { useMemo, useState } from "react";
import {
  COLLECTION_DETAILS_BG_CLASS,
  COLLECTION_DETAILS_BORDER_ALL,
  COLLECTION_DETAILS_BORDER_T,
} from "@/components/marketplace/collectionOverviewChrome";
import { toCardDisplayUppercase } from "@/lib/marketplace/collectionFullDetailsTitle";
import type { CollectionDetailCard } from "@/lib/marketplace/collectionDetailTypes";

export type { CollectionDetailCard } from "@/lib/marketplace/collectionDetailTypes";

const PRIMARY_KEYS = new Set([
  "cardName",
  "cardSet",
  "cardNumber",
  "variant",
  "gradingCompany",
  "gradeScore",
]);

function formatMaybeDate(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return iso;
  try {
    return new Date(t).toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function truncateUrl(s: string, max = 48): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

function DetailCardsGrid({ cards }: { cards: CollectionDetailCard[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 sm:gap-3 sm:p-3">
      {cards.map((card) => (
        <article
          key={card.id}
          className={`flex min-h-[92px] flex-col rounded-lg border border-black ${COLLECTION_DETAILS_BG_CLASS} px-3 py-3`}
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-zinc-500">
            {card.label}
          </p>
          <p className="mt-2 min-h-0 flex-1 text-[15px] font-bold uppercase leading-snug tracking-tight text-white [overflow-wrap:anywhere]">
            {card.value}
          </p>
        </article>
      ))}
    </div>
  );
}

export interface CollectionMetadataExpandableProps {
  metadataRows: { label: string; value: string }[];
  collectionKey: string;
  displayLabel?: string;
  queryUsed?: string | null;
  createdAt?: string | null;
  representativeImageUrl?: string | null;
  components: import("@/lib/marketplace/collectionDetailComponents").CollectionComponents;
  marketSeriesMeta?: {
    categoryLabel: string | null;
  } | null;
  cardhedgerCardId?: string | null;
  /**
   * Slender hero rail: optional extra catalog cards only (no toggle).
   * Omit redundant fields already shown in the page header.
   */
  compactHero?: boolean;
  detailCards?: CollectionDetailCard[];
  /** When `compactHero`, whether the detail card grid is visible (hero Details button). */
  detailsOpen?: boolean;
}

/**
 * Primary card fields — optional compact rail / full metadata + technical JSON expand.
 */
export function CollectionMetadataExpandable({
  metadataRows,
  collectionKey,
  displayLabel,
  queryUsed,
  createdAt,
  representativeImageUrl,
  components,
  marketSeriesMeta,
  cardhedgerCardId,
  compactHero = false,
  detailCards,
  detailsOpen: detailsOpenControlled,
}: CollectionMetadataExpandableProps) {
  const [expanded, setExpanded] = useState(false);
  const detailsOpen = Boolean(detailsOpenControlled);

  const extraComponentRows = useMemo(() => {
    const out: { k: string; v: string }[] = [];
    for (const [k, v] of Object.entries(components)) {
      if (PRIMARY_KEYS.has(k)) continue;
      if (k.endsWith("Display")) continue;
      if (v === undefined || v === null) continue;
      const s = typeof v === "string" ? v : JSON.stringify(v);
      if (!s.trim()) continue;
      out.push({ k, v: s });
    }
    return out.sort((a, b) => a.k.localeCompare(b.k));
  }, [components]);

  const hasExpandable = collectionKey.trim().length > 0;

  const componentsJson = useMemo(() => {
    try {
      return JSON.stringify(components, null, 2);
    } catch {
      return "{}";
    }
  }, [components]);

  const technicalInner = (omitTopDivider = false) => (
    <div
      className={`space-y-3 px-3 pb-3 pt-3 text-[12px] leading-snug ${omitTopDivider ? "" : COLLECTION_DETAILS_BORDER_T}`}
    >
      <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className={`rounded-lg ${COLLECTION_DETAILS_BORDER_ALL} bg-black px-2.5 py-2 sm:col-span-2`}>
          <dt className="text-[10px] font-medium uppercase tracking-wide text-gray-500">
            Collection key
          </dt>
          <dd className="mt-0.5 font-mono text-[11px] text-zinc-200 break-all">{collectionKey}</dd>
        </div>
        {displayLabel ? (
          <div className={`rounded-lg ${COLLECTION_DETAILS_BORDER_ALL} bg-black px-2.5 py-2 sm:col-span-2`}>
            <dt className="text-[10px] font-medium uppercase tracking-wide text-gray-500">Label</dt>
            <dd className="mt-0.5 text-zinc-100 break-words">{toCardDisplayUppercase(displayLabel)}</dd>
          </div>
        ) : null}
        {createdAt ? (
          <div className={`rounded-lg ${COLLECTION_DETAILS_BORDER_ALL} bg-black px-2.5 py-2 sm:col-span-2`}>
            <dt className="text-[10px] font-medium uppercase tracking-wide text-gray-500">
              Registered
            </dt>
            <dd className="mt-0.5 text-zinc-200 tabular-nums">{formatMaybeDate(createdAt)}</dd>
          </div>
        ) : null}
        {queryUsed?.trim() ? (
          <div className={`rounded-lg ${COLLECTION_DETAILS_BORDER_ALL} bg-black px-2.5 py-2 sm:col-span-2`}>
            <dt className="text-[10px] font-medium uppercase tracking-wide text-gray-500">
              Match query
            </dt>
            <dd className="mt-0.5 font-mono text-[11px] text-zinc-200 break-all">
              {toCardDisplayUppercase(queryUsed)}
            </dd>
          </div>
        ) : null}
        {cardhedgerCardId?.trim() ? (
          <div className={`rounded-lg ${COLLECTION_DETAILS_BORDER_ALL} bg-black px-2.5 py-2 sm:col-span-2`}>
            <dt className="text-[10px] font-medium uppercase tracking-wide text-gray-500">
              Cardhedger card ID
            </dt>
            <dd className="mt-0.5 font-mono text-[11px] text-zinc-200 break-all">
              {cardhedgerCardId}
            </dd>
          </div>
        ) : null}
        {marketSeriesMeta?.categoryLabel ? (
          <div className={`rounded-lg ${COLLECTION_DETAILS_BORDER_ALL} bg-black px-2.5 py-2 sm:col-span-2`}>
            <dt className="text-[10px] font-medium uppercase tracking-wide text-gray-500">
              Category
            </dt>
            <dd className="mt-0.5 text-zinc-100 break-words">{marketSeriesMeta.categoryLabel}</dd>
          </div>
        ) : null}
        {representativeImageUrl?.trim() ? (
          <div className={`rounded-lg ${COLLECTION_DETAILS_BORDER_ALL} bg-black px-2.5 py-2 sm:col-span-2`}>
            <dt className="text-[10px] font-medium uppercase tracking-wide text-gray-500">
              Cover URL
            </dt>
            <dd className="mt-0.5 font-mono text-[11px] text-zinc-300 break-all" title={representativeImageUrl}>
              {truncateUrl(representativeImageUrl, 56)}
            </dd>
          </div>
        ) : null}
        {extraComponentRows.map(({ k, v }) => (
          <div
            key={k}
            className={`rounded-lg ${COLLECTION_DETAILS_BORDER_ALL} bg-black px-2.5 py-2 sm:col-span-1`}
          >
            <dt className="text-[10px] font-medium uppercase tracking-wide text-gray-500">{k}</dt>
            <dd className="mt-0.5 text-zinc-100 break-words">{v}</dd>
          </div>
        ))}
      </dl>

      <details className={`rounded-lg ${COLLECTION_DETAILS_BORDER_ALL} ${COLLECTION_DETAILS_BG_CLASS} px-2 py-2`}>
        <summary className="cursor-pointer text-[11px] font-medium text-zinc-400 select-none">
          Raw components (JSON)
        </summary>
        <pre className={`mt-2 max-h-40 overflow-auto rounded-md border border-black ${COLLECTION_DETAILS_BG_CLASS} p-2 text-[10px] leading-relaxed text-zinc-400`}>
          {componentsJson}
        </pre>
      </details>
    </div>
  );

  if (compactHero) {
    if (!detailCards?.length) return null;
    return (
      <div
        id="collection-hero-details-panel"
        className={`scroll-mt-28 w-full min-w-0 transition-[opacity,transform] duration-200 ease-out ${
          detailsOpen
            ? `overflow-hidden rounded-xl ${COLLECTION_DETAILS_BORDER_ALL} ${COLLECTION_DETAILS_BG_CLASS}`
            : "h-0 overflow-hidden border-0 p-0 opacity-0"
        }`}
        aria-hidden={!detailsOpen}
      >
        {detailsOpen ? <DetailCardsGrid cards={detailCards} /> : null}
      </div>
    );
  }

  return (
    <div className="w-full space-y-3">
      {metadataRows.length > 0 ? (
        <dl className="w-full grid grid-cols-2 gap-2 text-[13px]">
          {metadataRows.map((row) => (
            <div
              key={row.label}
              className={`rounded-lg ${COLLECTION_DETAILS_BORDER_ALL} bg-black px-2.5 py-2 col-span-2 sm:col-span-1`}
            >
              <dt className="text-[10px] font-medium uppercase tracking-wide text-gray-500">{row.label}</dt>
              <dd className="mt-0.5 text-gray-100 leading-snug break-words">{row.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {hasExpandable ? (
        <div className={`rounded-xl ${COLLECTION_DETAILS_BORDER_ALL} ${COLLECTION_DETAILS_BG_CLASS}`}>
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-[12px] font-medium text-zinc-300 hover:bg-white/[0.03] transition-colors rounded-xl"
            aria-expanded={expanded}
          >
            <span>Additional details</span>
            <span className="text-[11px] text-zinc-500 tabular-nums">
              {expanded ? "Collapse" : "Expand"}
            </span>
          </button>

          <div
            className={`grid transition-[grid-template-rows] duration-200 ease-out ${
              expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
            }`}
          >
            <div className="min-h-0 overflow-hidden">{technicalInner(false)}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";

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

export interface CollectionMetadataExpandableProps {
  metadataRows: { label: string; value: string }[];
  collectionKey: string;
  displayLabel?: string;
  queryUsed?: string | null;
  createdAt?: string | null;
  representativeImageUrl?: string | null;
  components: Record<string, unknown>;
  marketSeriesMeta?: {
    categoryLabel: string | null;
  } | null;
  /** Cardhedger catalog id when server matched a card */
  cardhedgerCardId?: string | null;
}

/**
 * Primary card fields + expandable block for IDs, timestamps, query, and extra component keys.
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
}: CollectionMetadataExpandableProps) {
  const [expanded, setExpanded] = useState(false);

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

  /** Always show block when we have a collection id — at minimum key + JSON */
  const hasExpandable = collectionKey.trim().length > 0;

  const componentsJson = useMemo(() => {
    try {
      return JSON.stringify(components, null, 2);
    } catch {
      return "{}";
    }
  }, [components]);

  return (
    <div className="w-full space-y-3">
      {metadataRows.length > 0 ? (
        <dl className="w-full grid grid-cols-2 gap-2 text-[13px]">
          {metadataRows.map((row) => (
            <div
              key={row.label}
              className="rounded-lg border border-gray-800/80 bg-black/25 px-2.5 py-2 col-span-2 sm:col-span-1"
            >
              <dt className="text-[10px] font-medium uppercase tracking-wide text-gray-500">
                {row.label}
              </dt>
              <dd className="mt-0.5 text-gray-100 leading-snug break-words">{row.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {hasExpandable ? (
        <div className="rounded-xl border border-zinc-800/90 bg-zinc-950/60">
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
            <div className="min-h-0 overflow-hidden">
              <div className="space-y-3 border-t border-zinc-800/80 px-3 pb-3 pt-2 text-[12px] leading-snug">
                <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div className="rounded-lg border border-gray-800/70 bg-black/20 px-2.5 py-2 sm:col-span-2">
                    <dt className="text-[10px] font-medium uppercase tracking-wide text-gray-500">
                      Collection key
                    </dt>
                    <dd className="mt-0.5 font-mono text-[11px] text-zinc-200 break-all">
                      {collectionKey}
                    </dd>
                  </div>
                  {displayLabel ? (
                    <div className="rounded-lg border border-gray-800/70 bg-black/20 px-2.5 py-2 sm:col-span-2">
                      <dt className="text-[10px] font-medium uppercase tracking-wide text-gray-500">
                        Label
                      </dt>
                      <dd className="mt-0.5 text-zinc-100 break-words">{displayLabel}</dd>
                    </div>
                  ) : null}
                  {createdAt ? (
                    <div className="rounded-lg border border-gray-800/70 bg-black/20 px-2.5 py-2 sm:col-span-2">
                      <dt className="text-[10px] font-medium uppercase tracking-wide text-gray-500">
                        Registered
                      </dt>
                      <dd className="mt-0.5 text-zinc-200 tabular-nums">
                        {formatMaybeDate(createdAt)}
                      </dd>
                    </div>
                  ) : null}
                  {queryUsed?.trim() ? (
                    <div className="rounded-lg border border-gray-800/70 bg-black/20 px-2.5 py-2 sm:col-span-2">
                      <dt className="text-[10px] font-medium uppercase tracking-wide text-gray-500">
                        Match query
                      </dt>
                      <dd className="mt-0.5 font-mono text-[11px] text-zinc-200 break-all">
                        {queryUsed}
                      </dd>
                    </div>
                  ) : null}
                  {cardhedgerCardId?.trim() ? (
                    <div className="rounded-lg border border-gray-800/70 bg-black/20 px-2.5 py-2 sm:col-span-2">
                      <dt className="text-[10px] font-medium uppercase tracking-wide text-gray-500">
                        Cardhedger card ID
                      </dt>
                      <dd className="mt-0.5 font-mono text-[11px] text-zinc-200 break-all">
                        {cardhedgerCardId}
                      </dd>
                    </div>
                  ) : null}
                  {marketSeriesMeta?.categoryLabel ? (
                    <div className="rounded-lg border border-gray-800/70 bg-black/20 px-2.5 py-2 sm:col-span-2">
                      <dt className="text-[10px] font-medium uppercase tracking-wide text-gray-500">
                        Category
                      </dt>
                      <dd className="mt-0.5 text-zinc-100 break-words">
                        {marketSeriesMeta.categoryLabel}
                      </dd>
                    </div>
                  ) : null}
                  {representativeImageUrl?.trim() ? (
                    <div className="rounded-lg border border-gray-800/70 bg-black/20 px-2.5 py-2 sm:col-span-2">
                      <dt className="text-[10px] font-medium uppercase tracking-wide text-gray-500">
                        Cover URL
                      </dt>
                      <dd
                        className="mt-0.5 font-mono text-[11px] text-zinc-300 break-all"
                        title={representativeImageUrl}
                      >
                        {truncateUrl(representativeImageUrl, 56)}
                      </dd>
                    </div>
                  ) : null}
                  {extraComponentRows.map(({ k, v }) => (
                    <div
                      key={k}
                      className="rounded-lg border border-gray-800/70 bg-black/20 px-2.5 py-2 sm:col-span-1"
                    >
                      <dt className="text-[10px] font-medium uppercase tracking-wide text-gray-500">
                        {k}
                      </dt>
                      <dd className="mt-0.5 text-zinc-100 break-words">{v}</dd>
                    </div>
                  ))}
                </dl>

                <details className="rounded-lg border border-zinc-800/80 bg-black/30 px-2 py-2">
                  <summary className="cursor-pointer text-[11px] font-medium text-zinc-400 select-none">
                    Raw components (JSON)
                  </summary>
                  <pre className="mt-2 max-h-40 overflow-auto rounded-md bg-black/40 p-2 text-[10px] leading-relaxed text-zinc-400 scrollbar-platform">
                    {componentsJson}
                  </pre>
                </details>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

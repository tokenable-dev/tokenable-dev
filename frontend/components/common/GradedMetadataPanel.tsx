"use client";

import { useMemo } from "react";

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function normalizeScalar(v: unknown): string {
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (typeof v === "string") {
    return v.toLowerCase().replace(/,/g, "").replace(/\s+/g, " ").trim();
  }
  if (typeof v === "boolean") return v ? "true" : "false";
  return String(v).toLowerCase().trim();
}

/** Traits에 나온 값과 동일한 스칼라는 구조화 블록에서 생략 */
function buildSkipValueSet(
  attributes?: Array<{ trait_type: string; value: string }>,
): Set<string> {
  const s = new Set<string>();
  if (!attributes?.length) return s;
  for (const a of attributes) {
    s.add(normalizeScalar(a.value));
    const n = parseFloat(String(a.value).replace(/,/g, ""));
    if (!Number.isNaN(n)) s.add(String(n));
  }
  return s;
}

function filterDuplicateScalars(
  obj: Record<string, unknown>,
  skipSet: Set<string>,
): Record<string, unknown> | null {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null || v === "") continue;
    if (k === "justtcg") {
      out[k] = v;
      continue;
    }
    if (isPlainObject(v)) {
      const nested = filterDuplicateScalars(v, skipSet);
      if (nested && Object.keys(nested).length) out[k] = nested;
    } else if (Array.isArray(v)) {
      out[k] = v;
    } else {
      if (!skipSet.has(normalizeScalar(v))) out[k] = v;
    }
  }
  return Object.keys(out).length ? out : null;
}

/** justtcg: queryUsed만 상단에, 나머지는 접이식 */
function trimJusttcg(j: unknown): {
  summary: Record<string, unknown> | null;
  raw: unknown;
} {
  if (!isPlainObject(j)) return { summary: null, raw: null };
  const { queryUsed, topMatch, rawResponse, ...rest } = j;
  const summary: Record<string, unknown> = {};
  if (typeof queryUsed === "string" && queryUsed.trim()) {
    summary.queryUsed = queryUsed;
  }
  const rawPayload = { ...rest, ...(topMatch !== undefined ? { topMatch } : {}), ...(rawResponse !== undefined ? { rawResponse } : {}) };
  const hasRaw = Object.keys(rawPayload).some((key) => rawPayload[key as keyof typeof rawPayload] !== undefined);
  return {
    summary: Object.keys(summary).length ? summary : null,
    raw: hasRaw ? rawPayload : null,
  };
}

function formatKey(key: string): string {
  const spaced = key.replace(/([A-Z])/g, " $1").replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function CompactRows({
  data,
  depth,
}: {
  data: Record<string, unknown>;
  depth: number;
}) {
  return (
    <>
      {Object.entries(data).map(([key, value]) => (
        <CompactRow key={key} k={key} value={value} depth={depth} />
      ))}
    </>
  );
}

function CompactRow({
  k,
  value,
  depth,
}: {
  k: string;
  value: unknown;
  depth: number;
}) {
  const label = formatKey(k);

  if (k === "justtcg" && isPlainObject(value)) {
    const { summary, raw } = trimJusttcg(value);
    const hasRaw =
      raw != null &&
      typeof raw === "object" &&
      Object.keys(raw as object).length > 0;
    return (
      <div className="space-y-2">
        <p className="text-[11px] font-medium text-gray-500">JustTCG</p>
        {summary ? <CompactRows data={summary} depth={depth} /> : null}
        {hasRaw ? (
          <details className="group rounded-lg border border-gray-800/80 bg-gray-950/40">
            <summary className="cursor-pointer list-none px-3 py-2 text-xs text-gray-500 hover:text-gray-400 [&::-webkit-details-marker]:hidden flex items-center justify-between gap-2">
              <span>JustTCG raw</span>
              <span className="text-gray-600 group-open:rotate-180 transition-transform">▼</span>
            </summary>
            <pre className="scrollbar-hide px-3 pb-3 text-[10px] leading-relaxed text-gray-500 overflow-x-auto max-h-36 overflow-y-auto border-t border-gray-800/60">
              {JSON.stringify(raw, null, 2)}
            </pre>
          </details>
        ) : null}
      </div>
    );
  }

  if (depth >= 5) {
    return (
      <div className="py-1.5 border-b border-gray-800/50">
        <p className="text-[11px] text-gray-500 mb-1">{label}</p>
        <pre className="scrollbar-hide text-[10px] text-gray-400 bg-gray-950/50 rounded px-2 py-1.5 overflow-x-auto max-h-32 overflow-y-auto">
          {typeof value === "string" ? value : JSON.stringify(value, null, 2)}
        </pre>
      </div>
    );
  }

  if (isPlainObject(value)) {
    const keys = Object.keys(value);
    if (!keys.length) return null;
    return (
      <div className={depth > 0 ? "pl-2.5 border-l border-gray-700/50 space-y-1" : "space-y-1"}>
        <p className="text-[11px] font-medium text-gray-500 pt-1">{label}</p>
        <CompactRows data={value} depth={depth + 1} />
      </div>
    );
  }

  if (Array.isArray(value)) {
    const text =
      value.length === 0
        ? "—"
        : typeof value[0] === "object"
          ? JSON.stringify(value)
          : value.join(", ");
    return (
      <div className="flex justify-between gap-3 py-1.5 border-b border-gray-800/50 text-xs">
        <span className="text-gray-500 shrink-0">{label}</span>
        <span className="text-gray-300 text-right break-all font-mono">{text}</span>
      </div>
    );
  }

  return (
    <div className="flex justify-between gap-3 py-1.5 border-b border-gray-800/50 text-xs">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span className="text-gray-300 text-right break-all">
        {typeof value === "boolean" ? (value ? "Yes" : "No") : String(value)}
      </span>
    </div>
  );
}

/**
 * `properties.graded` — Traits와 겹치는 값은 제외하고, 접이식으로만 표시.
 */
export function GradedMetadataPanel({
  properties,
  attributes,
}: {
  properties?: Record<string, unknown>;
  attributes?: Array<{ trait_type: string; value: string }>;
}) {
  const graded = properties?.graded;
  const skipSet = useMemo(() => buildSkipValueSet(attributes), [attributes]);

  const filtered = useMemo(() => {
    if (!graded || !isPlainObject(graded)) return null;
    return filterDuplicateScalars(graded, skipSet);
  }, [graded, skipSet]);

  if (!filtered || Object.keys(filtered).length === 0) return null;

  return (
    <details className="group bg-[#0a0d11]/90 border border-mint-deep/20 rounded-2xl open:pb-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <summary className="cursor-pointer list-none px-4 py-3 flex items-center justify-between gap-3 text-sm text-gray-300 hover:bg-gray-800/40 rounded-2xl transition-colors [&::-webkit-details-marker]:hidden">
        <span className="font-medium text-mint/90">More metadata</span>
        <span className="text-gray-600 text-xs shrink-0 group-open:rotate-180 transition-transform duration-200">
          ▼
        </span>
      </summary>
      <div className="px-4 pb-4 pt-2 border-t border-gray-800/60">
        <div className="scrollbar-hide space-y-1 max-h-[min(50vh,22rem)] overflow-y-auto">
          <CompactRows data={filtered} depth={0} />
        </div>
      </div>
    </details>
  );
}

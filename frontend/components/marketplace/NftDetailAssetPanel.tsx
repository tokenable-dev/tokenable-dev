"use client";

import { NftImageZoom } from "@/components/common";

function pickString(...vals: unknown[]): string | undefined {
  for (const v of vals) {
    if (v == null || v === "") continue;
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
    if (typeof v === "string") {
      const t = v.trim();
      if (t) return t;
    }
  }
  return undefined;
}

export type NftDetailMetadata = {
  name?: string;
  description?: string;
  external_url?: string;
  image?: string;
  attributes?: Array<{ trait_type: string; value: string }>;
  properties?: Record<string, unknown>;
};

/**
 * `properties.graded` + attributes에서 카드 상세 그리드용 필드 추출
 */
export function buildNftDetailStatRows(meta: NftDetailMetadata | null): {
  label: string;
  value: string;
}[] {
  if (!meta) return [];
  const graded = meta.properties?.graded as Record<string, unknown> | undefined;
  const psa = graded?.psa as Record<string, unknown> | undefined;
  const card = graded?.card as Record<string, unknown> | undefined;
  const grade = graded?.grade as Record<string, unknown> | undefined;

  const rows: { label: string; value: string }[] = [];

  const player = pickString(card?.player, card?.name, psa?.cardNameHint);
  const set = pickString(card?.set, psa?.setHint);
  const num = pickString(card?.number, psa?.cardNumberHint);
  const variant = pickString(psa?.gradeDescription, psa?.labelType);
  const gradeLabel = pickString(
    psa?.gradeLabel,
    typeof grade?.label === "string" ? grade.label : undefined,
  );
  const cert = pickString(psa?.certNumber, grade?.certNumber);
  const year = pickString(psa?.year, card?.year);
  const category = pickString(psa?.category);

  if (player) rows.push({ label: "Player", value: player });
  if (set) rows.push({ label: "Set", value: set });
  if (num) rows.push({
    label: "Card Number",
    value: String(num).startsWith("#") ? String(num) : `#${num}`,
  });
  if (variant && variant !== gradeLabel) rows.push({ label: "Variant", value: variant });
  if (gradeLabel) rows.push({ label: "Grade", value: gradeLabel });
  if (year) rows.push({ label: "Year", value: year });
  if (category) rows.push({ label: "Category", value: category });
  if (cert) rows.push({ label: "Cert #", value: cert });

  if (rows.length >= 2) return rows.slice(0, 8);

  const attrs = meta.attributes ?? [];
  for (const a of attrs) {
    if (rows.length >= 8) break;
    if (!a?.trait_type) continue;
    const skip = new Set([
      "Grading Company",
      "Grade",
      "Cert Number",
      "Certification",
    ]);
    if (skip.has(a.trait_type)) continue;
    const v = String(a.value ?? "").trim();
    if (!v) continue;
    if (rows.some((r) => r.label === a.trait_type && r.value === v)) continue;
    rows.push({ label: a.trait_type, value: v });
  }

  return rows;
}

const BADGE_TONES = [
  "bg-violet-500/20 text-violet-200 border-violet-400/30",
  "bg-amber-500/15 text-amber-200 border-amber-400/25",
  "bg-mint/15 text-mint border-mint-deep/35",
] as const;

function selectBadges(meta: NftDetailMetadata | null): { text: string; toneIdx: number }[] {
  if (!meta?.attributes?.length) return [];
  const out: { text: string; toneIdx: number }[] = [];
  for (const a of meta.attributes) {
    if (out.length >= 3) break;
    const trait = (a.trait_type ?? "").trim();
    const val = String(a.value ?? "").trim();
    if (!val) continue;
    if (/grading\s*company/i.test(trait)) continue;
    const preferValue =
      /^(set|game|category|year|player)$/i.test(trait) ||
      val.length <= 48;
    const text = preferValue
      ? val.length > 44
        ? `${val.slice(0, 42)}…`
        : val
      : `${trait}: ${val.length > 32 ? `${val.slice(0, 30)}…` : val}`;
    out.push({ text, toneIdx: out.length % BADGE_TONES.length });
  }
  return out;
}

export interface NftDetailAssetPanelProps {
  metadata: NftDetailMetadata | null;
  imageUrl: string | null;
  tokenId: number;
  collectionLabel: string;
  metaLoading?: boolean;
}

/**
 * 마켓플레이스 NFT 상세 — 왼쪽: 슬랩 이미지, 제목, 배지, 스탯 그리드 (참고 UI)
 */
export function NftDetailAssetPanel({
  metadata,
  imageUrl,
  tokenId,
  collectionLabel,
  metaLoading,
}: NftDetailAssetPanelProps) {
  const title =
    metadata?.name ?? `${collectionLabel} #${tokenId}`;
  const statRows = buildNftDetailStatRows(metadata);
  const badges = selectBadges(metadata);

  return (
    <div className="min-w-0 space-y-5">
      <div className="rounded-2xl border border-mint-deep/20 bg-gradient-to-b from-[#0c1018] to-[#06080d] p-3 sm:p-4 shadow-[0_0_0_1px_rgba(167,243,208,0.06),inset_0_1px_0_rgba(255,255,255,0.04)]">
        <div className="relative aspect-[3/4] max-h-[min(72vh,640px)] mx-auto w-full rounded-xl overflow-hidden bg-[#030508] ring-1 ring-white/[0.07]">
          {metaLoading && !imageUrl ? (
            <div className="absolute inset-0 bg-gray-800/80 animate-pulse" />
          ) : imageUrl ? (
            <NftImageZoom
              src={imageUrl}
              alt={title}
              className="w-full h-full min-h-0"
              zoomFactor={3}
              lensSize={230}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-gray-600 text-sm">
              No image
            </div>
          )}
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-2/5 bg-gradient-to-b from-white/[0.04] to-transparent"
            aria-hidden
          />
        </div>
      </div>

      <div className="space-y-3 px-0.5">
        <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight leading-snug">
          {title}
        </h1>

        {badges.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {badges.map((b, idx) => (
              <span
                key={`${b.text}-${idx}`}
                className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-[11px] font-semibold ${BADGE_TONES[b.toneIdx]}`}
              >
                {b.text}
              </span>
            ))}
          </div>
        )}

        {metadata?.description && (
          <p className="text-sm text-gray-400 leading-relaxed line-clamp-4">
            {metadata.description}
          </p>
        )}

        {statRows.length > 0 && (
          <div className="rounded-2xl border border-gray-800/90 bg-[#0a0d11]/90 p-4">
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
              {statRows.map((row) => (
                <div key={row.label} className="min-w-0">
                  <dt className="text-[11px] font-medium uppercase tracking-wider text-gray-500 mb-1">
                    {row.label}
                  </dt>
                  <dd
                    className={`text-sm font-medium leading-snug break-words ${
                      row.label === "Player"
                        ? "text-mint"
                        : "text-gray-100"
                    }`}
                  >
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        {metadata?.external_url && (
          <a
            href={metadata.external_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-mint/90 hover:text-mint transition-colors"
          >
            View certification link
            <span aria-hidden>↗</span>
          </a>
        )}
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import type { DailyAmount, DailyCount } from "@/lib/core";
import { formatUsdcPricePrimary } from "@/lib/market/usdcKrwDisplay";
import {
  ADMIN_CHART_BAR,
  ADMIN_LINK,
  ADMIN_PROGRESS_FILL,
  ADMIN_PROGRESS_TRACK,
  ADMIN_TEXT_BODY,
  ADMIN_TEXT_BRAND,
  ADMIN_TEXT_META,
  ADMIN_TEXT_MUTED,
  ADMIN_TEXT_SECONDARY,
} from "./adminUi";

type MiniChartProps = {
  label: string;
  data: DailyCount[] | DailyAmount[];
  valueKey?: "count" | "amountUsdc";
  formatValue?: (n: number) => string;
  colorClass?: string;
};

export function AdminAnalyticsMiniChart({
  label,
  data,
  valueKey = "count",
  formatValue,
  colorClass = ADMIN_CHART_BAR,
}: MiniChartProps) {
  const values = data.map((d) =>
    valueKey === "amountUsdc"
      ? (d as DailyAmount).amountUsdc
      : (d as DailyCount).count,
  );
  const max = Math.max(...values, 1);
  const total = values.reduce((a, b) => a + b, 0);
  const fmt =
    formatValue ??
    ((n: number) =>
      valueKey === "amountUsdc" ? formatUsdcPricePrimary(n) : n.toLocaleString());

  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 sm:p-4">
      <div className="mb-3 flex items-end justify-between gap-2">
        <p className={`text-xs font-medium ${ADMIN_TEXT_MUTED}`}>{label}</p>
        <p className={`text-sm font-semibold ${ADMIN_TEXT_BODY}`}>{fmt(total)}</p>
      </div>
      <div className="flex h-14 items-end gap-px sm:h-16">
        {data.map((point) => {
          const val =
            valueKey === "amountUsdc"
              ? (point as DailyAmount).amountUsdc
              : (point as DailyCount).count;
          const h = Math.max(4, Math.round((val / max) * 100));
          return (
            <div
              key={point.date}
              className="group relative min-w-0 flex-1"
              title={`${point.date}: ${fmt(val)}`}
            >
              <div
                className={`mx-auto w-full max-w-[10px] rounded-t ${colorClass} opacity-80 transition-opacity group-hover:opacity-100`}
                style={{ height: `${h}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className={`mt-2 flex justify-between text-[10px] sm:text-xs ${ADMIN_TEXT_MUTED}`}>
        <span>{data[0]?.date.slice(5)}</span>
        <span>{data[data.length - 1]?.date.slice(5)}</span>
      </div>
    </div>
  );
}

type StatTileProps = {
  label: string;
  value: string | number;
  hint?: string;
};

export function AdminStatTile({ label, value, hint }: StatTileProps) {
  return (
    <div className="min-w-0">
      <p className={`text-xs font-medium ${ADMIN_TEXT_MUTED}`}>{label}</p>
      <p className={`mt-0.5 break-words text-lg font-semibold sm:text-xl ${ADMIN_TEXT_BODY}`}>
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
      {hint ? (
        <p className={`mt-0.5 text-xs leading-snug ${ADMIN_TEXT_SECONDARY}`}>{hint}</p>
      ) : null}
    </div>
  );
}

type FunnelBarProps = {
  label: string;
  pct: number | null;
  detail: string;
};

export function AdminFunnelBar({ label, pct, detail }: FunnelBarProps) {
  const width = pct != null ? Math.min(100, Math.max(0, pct)) : 0;
  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-sm">
        <span className={`font-medium ${ADMIN_TEXT_BODY}`}>{label}</span>
        <span className={ADMIN_TEXT_BRAND}>
          {pct != null ? `${pct}%` : "—"}
        </span>
      </div>
      <div className={ADMIN_PROGRESS_TRACK}>
        <div
          className={ADMIN_PROGRESS_FILL}
          style={{ width: `${width}%` }}
        />
      </div>
      <p className={`mt-1 text-xs leading-snug ${ADMIN_TEXT_SECONDARY}`}>{detail}</p>
    </div>
  );
}

export function AdminSectionTitle({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h2 className={`text-sm font-semibold sm:text-base ${ADMIN_TEXT_BODY}`}>
          {title}
        </h2>
        {subtitle ? (
          <p className={`mt-0.5 text-xs leading-relaxed sm:text-sm ${ADMIN_TEXT_SECONDARY}`}>
            {subtitle}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function formatDurationSec(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return "0s";
  if (sec < 60) return `${Math.round(sec)}s`;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

export function AdminCollectionLink({
  collectionKey,
  label,
}: {
  collectionKey: string;
  label: string | null;
}) {
  return (
    <Link
      href={`/marketplace/collections/${encodeURIComponent(collectionKey)}`}
      className={ADMIN_LINK}
      target="_blank"
      rel="noopener noreferrer"
    >
      {label ?? `${collectionKey.slice(0, 10)}…`}
    </Link>
  );
}

import type { protos } from '@google-analytics/data';

type ReportRow = protos.google.analytics.data.v1beta.IRow;

export function metricAt(row: ReportRow, index: number): number {
  const raw = row.metricValues?.[index]?.value;
  const n = raw != null ? Number(raw) : NaN;
  return Number.isFinite(n) ? n : 0;
}

export function dimensionAt(row: ReportRow, index: number): string {
  return row.dimensionValues?.[index]?.value?.trim() ?? '';
}

/** GA4 `date` dimension is `YYYYMMDD`. */
export function formatGa4Date(yyyymmdd: string): string {
  if (yyyymmdd.length !== 8) return yyyymmdd;
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
}

export function ga4DateRange(days: number): {
  startDate: string;
  endDate: string;
} {
  const safe = Math.min(90, Math.max(7, Math.floor(days)));
  return { startDate: `${safe}daysAgo`, endDate: 'today' };
}

export function avgEngagementSec(
  engagementSec: number,
  views: number,
): number | null {
  if (views <= 0) return null;
  return Math.round((engagementSec / views) * 10) / 10;
}

export function formatDurationSec(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return '0s';
  if (sec < 60) return `${Math.round(sec)}s`;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

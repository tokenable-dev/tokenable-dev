/**
 * Korea Blockchain Week event window (client-side gate for post-login offer +
 * temporary site-access bypass). Keep dates in sync with
 * `backend/src/site-access/kbw-event-period.ts`.
 * Override with ISO dates:
 *   NEXT_PUBLIC_KBW_EVENT_START / NEXT_PUBLIC_KBW_EVENT_END
 */
const DEFAULT_START = "2026-09-01T00:00:00+09:00";
const DEFAULT_END = "2026-09-30T23:59:59+09:00";

function parseBound(raw: string | undefined, fallback: string): number {
  const n = Date.parse(raw?.trim() || fallback);
  return Number.isFinite(n) ? n : Date.parse(fallback);
}

export function isKbwEventActive(now = Date.now()): boolean {
  const start = parseBound(
    process.env.NEXT_PUBLIC_KBW_EVENT_START,
    DEFAULT_START,
  );
  const end = parseBound(process.env.NEXT_PUBLIC_KBW_EVENT_END, DEFAULT_END);
  return now >= start && now <= end;
}

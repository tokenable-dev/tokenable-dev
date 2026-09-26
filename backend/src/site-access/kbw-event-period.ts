/**
 * Korea Blockchain Week event window — keep in sync with
 * `frontend/lib/event/kbwEventPeriod.ts`. Used for event offer UX only
 * (does not bypass the site-access password gate).
 *
 * Env (optional ISO timestamps):
 *   KBW_EVENT_START / KBW_EVENT_END
 *   or NEXT_PUBLIC_KBW_EVENT_START / NEXT_PUBLIC_KBW_EVENT_END
 */
const DEFAULT_START = '2026-09-01T00:00:00+09:00';
const DEFAULT_END = '2026-09-30T23:59:59+09:00';

function parseBound(raw: string | undefined, fallback: string): number {
  const n = Date.parse(raw?.trim() || fallback);
  return Number.isFinite(n) ? n : Date.parse(fallback);
}

export function isKbwEventActive(
  now = Date.now(),
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const start = parseBound(
    env.KBW_EVENT_START ?? env.NEXT_PUBLIC_KBW_EVENT_START,
    DEFAULT_START,
  );
  const end = parseBound(
    env.KBW_EVENT_END ?? env.NEXT_PUBLIC_KBW_EVENT_END,
    DEFAULT_END,
  );
  return now >= start && now <= end;
}

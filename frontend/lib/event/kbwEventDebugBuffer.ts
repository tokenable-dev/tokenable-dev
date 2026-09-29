/** In-memory KBW debug lines for on-device overlay (no circular imports). */

export const KBW_DEBUG_EVENT = "tokenable-kbw-debug";

export type KbwDebugLine = {
  ts: string;
  step: string;
  detail?: string;
};

const MAX_LINES = 48;
const lines: KbwDebugLine[] = [];

export function appendKbwDebugLine(
  step: string,
  detail?: Record<string, unknown>,
): void {
  if (typeof window === "undefined") return;
  const ts = new Date().toISOString().slice(11, 19);
  let detailStr: string | undefined;
  if (detail && Object.keys(detail).length > 0) {
    try {
      detailStr = JSON.stringify(detail);
    } catch {
      detailStr = "(unserializable)";
    }
  }
  lines.push({ ts, step, detail: detailStr });
  while (lines.length > MAX_LINES) lines.shift();
  window.dispatchEvent(new CustomEvent(KBW_DEBUG_EVENT));
}

export function getKbwDebugLines(): readonly KbwDebugLine[] {
  return lines;
}

export function formatKbwDebugLinesForCopy(): string {
  return lines
    .map((l) => `${l.ts} ${l.step}${l.detail ? ` ${l.detail}` : ""}`)
    .join("\n");
}

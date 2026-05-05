"use client";

import { useEffect, useMemo, useState } from "react";

export type AiInsightStreamable = {
  summary: string;
  bullets: string[];
  dynamics?: string[] | null | undefined;
  outlook?: string | null | undefined;
  outlookScenarios?: {
    bullCase: string;
    baseCase: string;
    bearCase: string;
  } | null;
};

type NarrativeBlock = {
  id: string;
  role: "heading" | "body";
  text: string;
};

const MAX_SUMMARY_CHARS = 320;
const MAX_BULLET_CHARS = 110;

function clampLine(s: string, maxChars: number): string {
  const t = String(s).replace(/\s+/g, " ").trim();
  if (!t.length) return "";
  if (t.length <= maxChars) return t;
  const cut = t.slice(0, maxChars - 1).trimEnd();
  const i = Math.max(cut.lastIndexOf(" "), cut.lastIndexOf(","));
  const base = i > Math.min(32, Math.floor(maxChars * 0.35)) ? cut.slice(0, i).trimEnd() : cut;
  return `${base}…`;
}

/** Skim-first: summary + up to three short bullets — no duplicate long sections */
function buildNarrativeBlocks(r: AiInsightStreamable): NarrativeBlock[] {
  const out: NarrativeBlock[] = [];
  const summary = clampLine(r.summary?.trim() ?? "", MAX_SUMMARY_CHARS);
  if (summary) {
    out.push({ id: "h-sum", role: "heading", text: "Brief" });
    out.push({ id: "summary", role: "body", text: summary });
  }
  const bl = (r.bullets ?? [])
    .map((b) => clampLine(String(b).replace(/^[\s•\-\u2022]+/u, ""), MAX_BULLET_CHARS))
    .filter(Boolean)
    .slice(0, 3);
  if (bl.length) {
    out.push({ id: "h-bullets", role: "heading", text: "Takeaways" });
    out.push({ id: "bullets", role: "body", text: bl.map((b) => `• ${b}`).join("\n") });
  }
  return out;
}

function sliceBlocks(blocks: NarrativeBlock[], charBudget: number): NarrativeBlock[] {
  let left = charBudget;
  const rows: NarrativeBlock[] = [];
  for (const b of blocks) {
    const chars = [...b.text];
    if (left <= 0) break;
    const take = Math.min(left, chars.length);
    rows.push({ ...b, text: chars.slice(0, take).join("") });
    left -= take;
  }
  return rows;
}

function countChars(blocks: NarrativeBlock[]): number {
  return blocks.reduce((acc, b) => acc + [...b.text].length, 0);
}

export function AiInsightTypewriter({
  insight,
  resetKey,
  durationMs = 3200,
  toneLabelFallback = "Accumulating",
  toneDisplay,
  generatedAtLine,
}: {
  insight: AiInsightStreamable;
  /** Changing this restarts the stream (e.g. insight timestamp). */
  resetKey: string;
  durationMs?: number;
  toneLabelFallback?: string;
  /** Used for footer line after stream completes. */
  toneDisplay?: string | null | undefined;
  generatedAtLine: string;
}) {
  const blocks = useMemo(() => buildNarrativeBlocks(insight), [insight]);
  const total = useMemo(() => countChars(blocks), [blocks]);

  const [revealedChars, setRevealedChars] = useState(0);

  useEffect(() => {
    if (total === 0) {
      setRevealedChars(0);
      return;
    }

    let startMs: number | null = null;
    let rid = 0;

    const frame = (t: number) => {
      if (startMs === null) startMs = t;
      const p = Math.min(1, (t - startMs) / durationMs);
      const n = Math.floor(p * total);
      setRevealedChars(Math.min(total, Math.max(0, n)));
      if (p < 1) {
        rid = requestAnimationFrame(frame);
      } else {
        setRevealedChars(total);
      }
    };

    setRevealedChars(0);
    rid = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rid);
  }, [resetKey, total, durationMs]);

  const visible = useMemo(
    () => sliceBlocks(blocks, revealedChars),
    [blocks, revealedChars],
  );
  const done = total === 0 || revealedChars >= total;

  const tonePhrase = toneDisplay?.trim() || toneLabelFallback;

  return (
    <div className="relative">
      <div className="space-y-2.5">
        {visible.map((b) =>
          b.role === "heading" ? (
            <p
              key={b.id}
              className={`mb-0 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 ${b.text.length === 0 ? "min-h-[1rem]" : ""}`}
            >
              {b.text}
            </p>
          ) : (
            <p
              key={b.id}
              className="whitespace-pre-wrap text-[13px] leading-snug text-zinc-100 [overflow-wrap:anywhere]"
            >
              {b.text}
            </p>
          ),
        )}
        {!done && total > 0 ? (
          <span
            className="inline-block h-4 w-px translate-y-0.5 align-middle bg-[#45f2dc] animate-pulse"
            aria-hidden
          />
        ) : null}
      </div>

      {done && total > 0 ? (
        <p className="mt-3 text-[11px] text-zinc-500">
          {tonePhrase} · {generatedAtLine}
        </p>
      ) : null}
    </div>
  );
}

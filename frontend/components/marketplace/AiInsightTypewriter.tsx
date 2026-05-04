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

function buildNarrativeBlocks(r: AiInsightStreamable): NarrativeBlock[] {
  const out: NarrativeBlock[] = [];
  out.push({ id: "h-ai", role: "heading", text: "AI Insight" });
  out.push({ id: "summary", role: "body", text: (r.summary?.trim() ?? "") + "\n\n" });

  if (r.dynamics && r.dynamics.length > 0) {
    out.push({ id: "h-struct", role: "heading", text: "Market Structure" });
    out.push({
      id: "dynamics",
      role: "body",
      text: r.dynamics.map((d) => `• ${d}`).join("\n") + "\n\n",
    });
  }

  if (r.bullets?.length > 0) {
    out.push({ id: "h-signals", role: "heading", text: "Key Signals" });
    out.push({
      id: "bullets",
      role: "body",
      text: r.bullets.map((b) => `• ${b}`).join("\n") + "\n\n",
    });
  }

  if (r.outlook?.trim()) {
    out.push({ id: "h-out", role: "heading", text: "Forward Outlook" });
    out.push({ id: "outlook", role: "body", text: r.outlook.trim() + "\n\n" });
  }

  if (r.outlookScenarios) {
    const { bullCase, baseCase, bearCase } = r.outlookScenarios;
    const lines = [
      `Bull case: ${bullCase}`,
      `Base case: ${baseCase}`,
      `Bear case: ${bearCase}`,
    ];
    out.push({ id: "scenarios", role: "body", text: lines.join("\n") + "\n\n" });
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
  durationMs = 5000,
  toneLabelFallback = "Accumulating",
  toneDisplay,
  generatedAtLine,
}: {
  insight: AiInsightStreamable;
  /** Changing this restarts the stream (e.g. insight timestamp). */
  resetKey: string;
  durationMs?: number;
  toneLabelFallback?: string;
  /** Shown after stream completes (prefer API market tone badge text). */
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
      <div className="space-y-3">
        {visible.map((b) =>
          b.role === "heading" ? (
            <p
              key={b.id}
              className={`mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-400 ${b.text.length === 0 ? "min-h-[1rem]" : ""}`}
            >
              {b.text}
            </p>
          ) : (
            <p
              key={b.id}
              className="whitespace-pre-wrap text-zinc-100 leading-relaxed [overflow-wrap:anywhere]"
            >
              {b.text}
            </p>
          ),
        )}
        {!done && total > 0 ? (
          <span
            className="inline-block h-4 w-px translate-y-1 align-middle bg-[#45f2dc] animate-pulse"
            aria-hidden
          />
        ) : null}
      </div>

      {done ? (
        <>
          <p className="mt-4 text-[11px] text-zinc-400">
            Market Tone:{" "}
            <span className="font-semibold text-zinc-200">{tonePhrase}</span>
          </p>
          <p className="mt-3 text-[11px] text-zinc-500">Updated {generatedAtLine}</p>
        </>
      ) : null}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import {
  formatKbwDebugLinesForCopy,
  getKbwDebugLines,
  KBW_DEBUG_EVENT,
  type KbwDebugLine,
} from "@/lib/event/kbwEventDebugBuffer";
import {
  isKbwEventDebugEnabled,
  kbwDebugSnapshot,
} from "@/lib/event/kbwEventDebug";

/**
 * On-phone KBW trace (no Mac Web Inspector). Only when
 * NEXT_PUBLIC_KBW_EVENT_DEBUG=true at build time.
 */
export function KbwEventDebugOverlay() {
  const [open, setOpen] = useState(true);
  const [lines, setLines] = useState<readonly KbwDebugLine[]>([]);
  const [snapshot, setSnapshot] = useState("");

  const refresh = useCallback(() => {
    setLines(getKbwDebugLines());
    try {
      setSnapshot(JSON.stringify(kbwDebugSnapshot(), null, 0));
    } catch {
      setSnapshot("(snapshot error)");
    }
  }, []);

  useEffect(() => {
    if (!isKbwEventDebugEnabled()) return;
    refresh();
    const onLine = () => refresh();
    window.addEventListener(KBW_DEBUG_EVENT, onLine);
    const id = window.setInterval(refresh, 2000);
    return () => {
      window.removeEventListener(KBW_DEBUG_EVENT, onLine);
      window.clearInterval(id);
    };
  }, [refresh]);

  if (!isKbwEventDebugEnabled()) return null;

  async function copyAll() {
    const text = `${snapshot}\n---\n${formatKbwDebugLinesForCopy()}`;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* fallback: user can screenshot */
    }
  }

  return (
    <div
      className="kbw-debug-overlay"
      aria-label="KBW debug trace"
      data-testid="kbw-debug-overlay"
    >
      <button
        type="button"
        className="kbw-debug-overlay__pill"
        onClick={() => setOpen((v) => !v)}
      >
        KBW {lines.length}
      </button>
      {open ? (
        <div className="kbw-debug-overlay__panel">
          <div className="kbw-debug-overlay__actions">
            <button type="button" onClick={() => void copyAll()}>
              Copy
            </button>
            <button type="button" onClick={refresh}>
              Refresh
            </button>
            <button type="button" onClick={() => setOpen(false)}>
              Hide
            </button>
          </div>
          <pre className="kbw-debug-overlay__snap">{snapshot}</pre>
          <ul className="kbw-debug-overlay__list">
            {lines.length === 0 ? (
              <li>No [KBW] lines yet — tap Stage 2 and log in.</li>
            ) : (
              lines.map((l, i) => (
                <li key={`${l.ts}-${i}`}>
                  <span className="kbw-debug-overlay__ts">{l.ts}</span>{" "}
                  <strong>{l.step}</strong>
                  {l.detail ? (
                    <span className="kbw-debug-overlay__detail"> {l.detail}</span>
                  ) : null}
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Sell-Flow.html `#cert-progress` / `runCertProgress`.
 * Determinate staged bar so a slow PSA lookup reads as progress, not a hang.
 */
const STAGES: ReadonlyArray<{ to: number; text: string }> = [
  { to: 38, text: "Contacting PSA…" },
  { to: 74, text: "Reading grade and population…" },
  { to: 96, text: "Matching to market data…" },
];

type Props = {
  /** True while cert/slab lookup is in flight. */
  active: boolean;
  /** Partner add-cards is light glass; PSA ship path is dark. */
  tone?: "light" | "dark";
};

export function SellFlowCertProgress({ active, tone = "dark" }: Props) {
  const [visible, setVisible] = useState(false);
  const [pct, setPct] = useState(0);
  const [label, setLabel] = useState<string>(STAGES[0].text);
  const pRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const boostRef = useRef<number | null>(null);
  const hideRef = useRef<number | null>(null);
  const wasActiveRef = useRef(false);

  const clearTimers = () => {
    if (timerRef.current != null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (boostRef.current != null) {
      window.clearTimeout(boostRef.current);
      boostRef.current = null;
    }
    if (hideRef.current != null) {
      window.clearTimeout(hideRef.current);
      hideRef.current = null;
    }
  };

  useEffect(() => {
    if (active) {
      wasActiveRef.current = true;
      clearTimers();
      pRef.current = 0;
      setVisible(true);
      setPct(0);
      setLabel(STAGES[0].text);

      timerRef.current = window.setInterval(() => {
        let p = pRef.current;
        let stage = STAGES[0];
        for (let i = 0; i < STAGES.length; i++) {
          if (p < STAGES[i].to) {
            stage = STAGES[i];
            break;
          }
        }
        /* Ease toward stage ceiling — same formula as Sell-Flow.html */
        p += Math.max(0.6, (stage.to - p) * 0.16);
        /* Hold under 100% until the real lookup finishes. */
        if (p > 96) p = 96;
        pRef.current = p;
        setPct(p);
        setLabel(stage.text);
      }, 90);

      /* If PSA is still waiting, nudge into the last stage (HTML: 2600ms). */
      boostRef.current = window.setTimeout(() => {
        pRef.current = Math.max(pRef.current, 96);
      }, 2600);

      return () => clearTimers();
    }

    if (!wasActiveRef.current) return;

    /* Lookup finished — Card.html completes to 100% then hides after 240ms. */
    clearTimers();
    pRef.current = 100;
    setPct(100);
    setLabel("Done");
    hideRef.current = window.setTimeout(() => {
      setVisible(false);
      setPct(0);
      setLabel(STAGES[0].text);
      wasActiveRef.current = false;
      hideRef.current = null;
    }, 240);

    return () => clearTimers();
  }, [active]);

  if (!visible) return null;

  const width = `${pct.toFixed(1)}%`;

  return (
    <div
      className={`sell-flow-cert-progress sell-flow-cert-progress--${tone}`}
      id="cert-progress"
      role="status"
      aria-live="polite"
      aria-busy={active}
    >
      <div className="sell-flow-cert-progress__row">
        <span className="sell-flow-cert-progress__label tkl-mono" id="cert-progress-label">
          {label}
        </span>
        <span className="sell-flow-cert-progress__pct tkl-mono" id="cert-progress-pct">
          {Math.round(pct)}%
        </span>
      </div>
      <div className="sell-flow-cert-progress__track">
        <div
          className="sell-flow-cert-progress__fill"
          id="cert-progress-fill"
          style={{ width }}
        />
      </div>
      <div className="sell-flow-cert-progress__hint tkl-mono">
        PSA lookups can take a few seconds.
      </div>
    </div>
  );
}

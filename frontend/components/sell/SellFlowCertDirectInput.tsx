"use client";

import { TkButton } from "@/components/ds";
import { cn } from "@/lib/ds/cn";

/** OR + cert# row — PSA / Tokenable vault add-cards (dev@tokenable.io only). */
export function SellFlowCertDirectInput({
  value,
  onChange,
  onLookup,
  busy,
  error,
  partner = false,
}: {
  value: string;
  onChange: (next: string) => void;
  onLookup: () => void;
  busy: boolean;
  error: string | null;
  partner?: boolean;
}) {
  return (
    <>
      <div
        className={cn("sell-flow-or", partner && "sell-flow-or--partner")}
        aria-hidden
      >
        <div className="sell-flow-or__line" />
        <span className="sell-flow-or__label tkl-mono">OR</span>
        <div className="sell-flow-or__line" />
      </div>

      <label className="sell-flow-cert-label" htmlFor="sell-flow-cert-input">
        Cert number
      </label>
      <div className="sell-flow-cert-row">
        <input
          id="sell-flow-cert-input"
          className={cn(
            "sell-flow-cert-input tkl-mono",
            error && "sell-flow-cert-input--error",
          )}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="e.g. 12345678"
          value={value}
          disabled={busy}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "cert-error" : undefined}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onLookup();
            }
          }}
        />
        <TkButton
          type="button"
          variant="primary"
          className="sell-flow-lookup-btn"
          disabled={busy || !value.trim()}
          onClick={() => onLookup()}
        >
          {busy ? "Looking up…" : "Look up"}
        </TkButton>
      </div>
    </>
  );
}

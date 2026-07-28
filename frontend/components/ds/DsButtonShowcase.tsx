"use client";

import { TkButton } from "@/components/ds/Button";

/**
 * Compact live strip for `/dev/design-system` — verifies ghost/table variants
 * against committed DS CSS (standalone iframe may lag until re-imported).
 */
export function DsButtonShowcase() {
  return (
    <section
      aria-label="TkButton variants"
      style={{
        padding: "16px clamp(16px, 4vw, 40px)",
        background: "#0e0e0e",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.45)",
          marginBottom: 12,
        }}
      >
        TkButton · live (DS: ghost + table)
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
        <TkButton variant="primary">Primary</TkButton>
        <TkButton variant="neutral">Neutral</TkButton>
        <TkButton variant="subtle">Subtle</TkButton>
        <TkButton variant="ghost">Ghost</TkButton>
        <TkButton variant="ghost" size="sm">
          Ghost sm
        </TkButton>
        <TkButton variant="ghost" size="table">
          Set price
        </TkButton>
        <TkButton variant="danger" size="sm">
          Danger
        </TkButton>
        <TkButton variant="ghost" size="table" disabled>
          Disabled
        </TkButton>
      </div>
    </section>
  );
}

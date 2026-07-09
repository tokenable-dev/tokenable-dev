"use client";

import { cn } from "@/lib/ds/cn";

export type VaultHubMode = "empty" | "active";

export function VaultStateToggle({
  value,
  onChange,
}: {
  value: VaultHubMode;
  onChange: (mode: VaultHubMode) => void;
}) {
  if (process.env.NODE_ENV === "production") return null;

  return (
    <div className="vault-state-toggle" role="tablist" aria-label="Vault view">
      <button
        type="button"
        role="tab"
        aria-selected={value === "empty"}
        className={cn(value === "empty" && "active")}
        onClick={() => onChange("empty")}
      >
        Empty
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={value === "active"}
        className={cn(value === "active" && "active")}
        onClick={() => onChange("active")}
      >
        Active
      </button>
    </div>
  );
}

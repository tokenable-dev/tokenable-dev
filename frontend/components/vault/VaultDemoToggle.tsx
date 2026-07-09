"use client";

import { cn } from "@/lib/ds/cn";

export function VaultDemoToggle<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
}) {
  if (process.env.NODE_ENV === "production") return null;

  return (
    <div className="vault-demo-toggle" role="tablist" aria-label="Demo view">
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          role="tab"
          aria-selected={value === opt.id}
          className={cn(value === opt.id && "active")}
          onClick={() => onChange(opt.id)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

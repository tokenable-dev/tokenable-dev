"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/ds/cn";
import { VaultAuthGate } from "@/components/vault/VaultAuthGate";

export function VaultShell({
  children,
  wide = false,
  narrow = false,
  className,
  ungated = false,
}: {
  children: ReactNode;
  wide?: boolean;
  narrow?: boolean;
  className?: string;
  /** Skip auth gate (e.g. internal tooling). */
  ungated?: boolean;
}) {
  return (
    <div className={cn("vault-page", className)}>
      <div
        className={cn(
          "vault-page__shell",
          wide && "vault-page__shell--wide",
          narrow && "vault-page__shell--narrow",
        )}
      >
        {ungated ? children : <VaultAuthGate>{children}</VaultAuthGate>}
      </div>
    </div>
  );
}

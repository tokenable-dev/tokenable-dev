"use client";

import type { ReactNode } from "react";

/**
 * Mobile collection detail — listings below market tabs (no boxed chrome).
 */
export function CollectionMobileListingsSection({
  children,
  count,
}: {
  children: ReactNode;
  count?: number;
}) {
  const label =
    count != null && count >= 0 ? `listing · ${count}` : "listing";

  return (
    <section
      className="w-full min-w-0 pt-2 lg:hidden"
      aria-label="Individual listings"
    >
      <div className="mb-2 flex items-baseline justify-between gap-2 px-0.5">
        <h2 className="text-[11px] font-medium text-zinc-500">{label}</h2>
      </div>
      {children}
    </section>
  );
}

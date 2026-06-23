"use client";

import { useSellAccessGate } from "@/hooks/auth/useSellAccessGate";

export function GatedSellLink({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const { navigateToVault } = useSellAccessGate("/vault");

  return (
    <button type="button" onClick={navigateToVault} className={className}>
      {children}
    </button>
  );
}

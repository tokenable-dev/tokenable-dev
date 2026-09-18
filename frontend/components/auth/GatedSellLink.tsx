"use client";

import { useSellAccessGate } from "@/hooks/auth/useSellAccessGate";

export function GatedSellLink({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const { navigateToSell } = useSellAccessGate("/sell");

  return (
    <button type="button" onClick={navigateToSell} className={className}>
      {children}
    </button>
  );
}

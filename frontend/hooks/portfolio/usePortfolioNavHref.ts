"use client";

import { portfolioHrefForPartner } from "@/lib/portfolio/portfolioPaths";
import { useActivePartner } from "@/hooks/partner/useActivePartner";

/** GNB / wallet menu Portfolio link — `/partner/portfolio` for active partners. */
export function usePortfolioNavHref(): string {
  const { isActivePartner, isLoading } = useActivePartner();
  if (isLoading) return portfolioHrefForPartner(false);
  return portfolioHrefForPartner(isActivePartner);
}

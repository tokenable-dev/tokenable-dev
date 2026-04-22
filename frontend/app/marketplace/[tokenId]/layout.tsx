import type { ReactNode } from "react";

/** Token detail is always dynamic (per-wallet / per-metadata); skip static shell + build-time hints for `/marketplace/*`. */
export const dynamic = "force-dynamic";

export default function MarketplaceTokenLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}

import type { Metadata } from "next";
import { Suspense } from "react";
import "@/styles/tokenable-portfolio.css";
import "@/styles/tokenable-portfolio-redeem.css";
import "@/styles/tokenable-watchlist.css";
/* Set price / Edit price sheet (ListRwaModal + tk-price) — shared with RWA detail */
import "@/styles/tokenable-rwa-detail.css";

export const metadata: Metadata = {
  title: "Portfolio",
};

export default function PortfolioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Suspense fallback={null}>{children}</Suspense>;
}

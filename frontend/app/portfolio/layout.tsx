import type { Metadata } from "next";
import { Suspense } from "react";
import "@/styles/tokenable-portfolio.css";
import "@/styles/tokenable-portfolio-redeem.css";
import "@/styles/tokenable-portfolio-asset.css";
import "@/styles/tokenable-watchlist.css";
/* ListRwaModal Set/Edit price sheet (`tk-price` in tokenable-rwa-detail.css) */
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

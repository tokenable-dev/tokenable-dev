import type { Metadata } from "next";
import { Suspense } from "react";
import "@/styles/tokenable-portfolio.css";
import "@/styles/tokenable-portfolio-redeem.css";
import "@/styles/tokenable-portfolio-asset.css";
import "@/styles/tokenable-rwa-detail.css";

export const metadata: Metadata = {
  title: "Portfolio",
};

export default function PartnerPortfolioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Suspense fallback={null}>{children}</Suspense>;
}

import type { Metadata } from "next";
import { Suspense } from "react";

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

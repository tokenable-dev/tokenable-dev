import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Play the Market — Tokenable",
  description: "Tokenable event for Korea Blockchain Week.",
};

export default function EventLayout({ children }: { children: ReactNode }) {
  return children;
}

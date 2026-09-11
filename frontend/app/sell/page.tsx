import type { Metadata } from "next";
import { SellRouterView } from "@/components/sell/SellRouterView";

export const metadata: Metadata = {
  title: "Sell — Tokenable",
};

export default function SellPage() {
  return <SellRouterView />;
}

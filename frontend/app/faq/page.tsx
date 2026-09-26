import type { Metadata } from "next";
import { FaqPage } from "@/components/faq/FaqPage";

export const metadata: Metadata = {
  title: "FAQ · Tokenable",
  description: "Frequently asked questions about buying, selling, custody and redemption on Tokenable.",
};

export default function FaqRoutePage() {
  return <FaqPage />;
}

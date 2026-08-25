"use client";

import { PartnerGate } from "@/components/partner/PartnerGate";
import "@/styles/tokenable-partner.css";

export default function PartnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="partner-shell">
      <PartnerGate>{children}</PartnerGate>
    </div>
  );
}

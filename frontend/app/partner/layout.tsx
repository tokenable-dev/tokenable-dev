"use client";

import { PartnerGate } from "@/components/partner/PartnerGate";

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

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Old partner add-cards deep link. Sell now starts on the vault hub. */
export default function PartnerAddCardsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/sell/flow?vault=self");
  }, [router]);

  return (
    <div className="partner-gate partner-gate--loading" role="status">
      Opening Sell…
    </div>
  );
}

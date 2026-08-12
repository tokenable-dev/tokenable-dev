"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Partner Add Cards — reuses Sell flow self-vault mint (Partner vault).
 * Lands on register (seller terms), with vault=self so Continue skips to cards.
 */
export default function PartnerAddCardsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/sell/flow?vault=self");
  }, [router]);

  return (
    <div className="partner-gate partner-gate--loading" role="status">
      Opening Partner vault add cards…
    </div>
  );
}

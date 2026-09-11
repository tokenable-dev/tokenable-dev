import { Suspense } from "react";
import { SiteAccessClient } from "./SiteAccessClient";

export default function SiteAccessPage() {
  return (
    <Suspense
      fallback={
        <div className="secondary-page secondary-page--full secondary-page--centered text-sm text-[var(--t2)]">
          Loading…
        </div>
      }
    >
      <SiteAccessClient />
    </Suspense>
  );
}

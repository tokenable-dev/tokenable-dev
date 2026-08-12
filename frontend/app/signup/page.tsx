"use client";

import { Suspense } from "react";
import { PrivyAuthEntryPage } from "@/components/auth/PrivyAuthEntryPage";

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div
          className="secondary-page secondary-page--auth secondary-page--centered"
          aria-busy
          aria-label="Loading"
        >
          <div className="secondary-spinner" />
        </div>
      }
    >
      <PrivyAuthEntryPage mode="signup" />
    </Suspense>
  );
}

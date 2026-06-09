"use client";

import Link from "next/link";
import { Suspense } from "react";
import { CardTop100Section } from "./CardTop100Section";

function CardTop100PageContent() {
  return (
    <div className="min-h-screen min-w-0 overflow-x-clip bg-black text-white">
      <div className="mx-auto w-full max-w-6xl min-w-0 px-3 pb-20 pt-8 max-[380px]:px-2 sm:px-6 sm:pb-24 sm:pt-12">
        <Link
          href="/markets"
          className="mb-6 inline-flex text-sm font-medium text-mint/90 transition-colors hover:text-mint sm:mb-8"
        >
          ← Back to Markets
        </Link>
        <CardTop100Section variant="full" />
      </div>
    </div>
  );
}

export default function CardTop100Page() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black px-4 py-16 text-center text-sm text-zinc-500">
          Loading…
        </div>
      }
    >
      <CardTop100PageContent />
    </Suspense>
  );
}

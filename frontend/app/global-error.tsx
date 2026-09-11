"use client";

import { AppRouteError } from "@/components/ui/AppRouteError";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="bg-black">
        <AppRouteError error={error} reset={reset} kind="app_crash" />
      </body>
    </html>
  );
}

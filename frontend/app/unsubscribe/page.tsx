import type { Metadata } from "next";
import { Suspense } from "react";
import { UnsubscribePageView } from "@/components/email/unsubscribe/UnsubscribePageView";

export const metadata: Metadata = {
  title: "Unsubscribe | Tokenable",
  description: "Manage your Tokenable email subscription.",
};

export default function UnsubscribePage() {
  return (
    <Suspense fallback={null}>
      <UnsubscribePageView />
    </Suspense>
  );
}

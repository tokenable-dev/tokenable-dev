"use client";

import { PrivyFeaturesLab } from "@/components/privy/PrivyFeaturesLab";
import { isPrivyEnabled } from "@/lib/privy/config";

export default function PrivyDevPage() {
  if (!isPrivyEnabled()) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center px-4 text-sm text-gray-400">
        Set NEXT_PUBLIC_PRIVY_APP_ID to use the Privy feature lab.
      </div>
    );
  }

  return <PrivyFeaturesLab />;
}

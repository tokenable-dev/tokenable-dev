"use client";

import { AppPageState } from "@/components/ui/AppPageState";

export function RwaDetailAssetNotFoundState({ onBack }: { onBack: () => void }) {
  return (
    <AppPageState
      kind="asset_not_found"
      primaryAction={{ label: "← Back to Markets", onClick: onBack, variant: "neutral" }}
    />
  );
}

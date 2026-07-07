"use client";

import { AppPageState } from "@/components/ui/AppPageState";

export function RwaDetailInvalidTokenState({ onBack }: { onBack: () => void }) {
  return (
    <AppPageState
      kind="asset_invalid"
      primaryAction={{ label: "← Back", onClick: onBack, variant: "neutral" }}
    />
  );
}

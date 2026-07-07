"use client";

import { TkButton, TkDialog } from "@/components/ds";
import { useAuthUiStore } from "@/store/authUiStore";

export function KycRequiredModal() {
  const kycOpen = useAuthUiStore((s) => s.kycOpen);
  const closeKyc = useAuthUiStore((s) => s.closeKyc);

  return (
    <TkDialog
      open={kycOpen}
      onClose={closeKyc}
      title="Verification required"
      description="Identity verification is required before you can trade on Tokenable."
      footer={
        <TkButton variant="primary" disabled className="w-full justify-center">
          Coming soon
        </TkButton>
      }
    />
  );
}

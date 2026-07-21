"use client";

import { useRouter } from "next/navigation";
import { TkButton, TkDialog } from "@/components/ds";
import { useAuthStore } from "@/store/authStore";
import { useAuthUiStore } from "@/store/authUiStore";

function kycModalCopy(status: string | undefined): {
  title: string;
  description: string;
  cta: string;
} {
  if (status === "pending") {
    return {
      title: "Verification in progress",
      description:
        "Your identity check is still under review. This usually takes 1–2 minutes. You can continue verification or wait for approval before shipping or redeeming a card.",
      cta: "Continue verification",
    };
  }
  if (status === "rejected") {
    return {
      title: "Verification needs another look",
      description:
        "We couldn’t approve your identity yet. Please resubmit your ID and liveness check so you can vault or redeem physical cards.",
      cta: "Try again",
    };
  }
  return {
    title: "Verify your identity",
    description:
      "To keep vaulted cards safe for custody and shipping, we need a quick identity check — ID (passport or driver’s license), a liveness selfie, usually 1–2 minutes.",
    cta: "Start Verification",
  };
}

export function KycRequiredModal() {
  const router = useRouter();
  const kycStatus = useAuthStore((s) => s.user?.kycStatus);
  const kycOpen = useAuthUiStore((s) => s.kycOpen);
  const closeKyc = useAuthUiStore((s) => s.closeKyc);
  const { title, description, cta } = kycModalCopy(kycStatus);

  return (
    <TkDialog
      open={kycOpen}
      onClose={closeKyc}
      title={title}
      description={description}
      footer={
        <TkButton
          variant="primary"
          className="w-full justify-center"
          onClick={() => {
            closeKyc();
            router.push("/kyc");
          }}
        >
          {cta}
        </TkButton>
      }
    />
  );
}

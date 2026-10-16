"use client";

import { useRouter } from "next/navigation";
import { TkButton, TkDialog } from "@/components/ds";
import { rememberKycReturnTo, peekKycReturnTo } from "@/lib/kyc/returnPath";
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
        "We'll email you when verification completes.",
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
        "Upload a clear photo of your government ID (passport, license, or national ID). Take a quick selfie to match your ID.",
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
            const returnTo =
              useAuthUiStore.getState().pendingReturnTo ?? peekKycReturnTo();
            rememberKycReturnTo(returnTo);
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

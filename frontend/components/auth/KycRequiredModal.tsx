"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { TkButton, TkDialog } from "@/components/ds";
import { rememberKycReturnTo, peekKycReturnTo } from "@/lib/kyc/returnPath";
import { useAuthStore } from "@/store/authStore";
import { useAuthUiStore } from "@/store/authUiStore";

function kycModalCopy(
  status: string | undefined,
  t: ReturnType<typeof useTranslations<"AuthGate">>,
): {
  title: string;
  description: string;
  cta: string;
} {
  if (status === "pending") {
    return {
      title: t("pendingTitle"),
      description: t("pendingBody"),
      cta: t("pendingCta"),
    };
  }
  if (status === "rejected") {
    return {
      title: t("rejectedTitle"),
      description: t("kycRejectedBody"),
      cta: t("rejectedCta"),
    };
  }
  return {
    title: t("verifyTitle"),
    description: t("kycVerifyBody"),
    cta: t("kycStart"),
  };
}

export function KycRequiredModal() {
  const router = useRouter();
  const t = useTranslations("AuthGate");
  const kycStatus = useAuthStore((s) => s.user?.kycStatus);
  const kycOpen = useAuthUiStore((s) => s.kycOpen);
  const closeKyc = useAuthUiStore((s) => s.closeKyc);
  const { title, description, cta } = kycModalCopy(kycStatus, t);

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

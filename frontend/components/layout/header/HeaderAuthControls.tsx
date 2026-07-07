"use client";

import { useLogin, usePrivy } from "@privy-io/react-auth";
import { TkButton } from "@/components/ds";
import { HeaderWalletMenu } from "@/components/layout/header/wallet/HeaderWalletMenu";
import { useAuthStore } from "@/store/authStore";

type HeaderAuthControlsProps = {
  /** `drawer` — mobile footer connect only; wallet menu lives in `HeaderMobileWalletSection`. */
  placement?: "header" | "drawer";
};

/** Header auth slot — GNB Sign up (HTML tk-connect) or custom wallet chip + menu. */
export function HeaderAuthControls({ placement = "header" }: HeaderAuthControlsProps) {
  const { ready, authenticated } = usePrivy();
  const { login } = useLogin();
  const initialized = useAuthStore((s) => s.initialized);
  const loading = useAuthStore((s) => s.loading);

  if (!ready || !initialized || loading) {
    return <div className="gnb-auth-skeleton animate-pulse" aria-hidden />;
  }

  if (!authenticated) {
    return (
      <TkButton
        type="button"
        variant="primary"
        className="tk-btn--gnb tk-connect"
        onClick={() => login()}
      >
        Sign up
      </TkButton>
    );
  }

  if (placement === "drawer") {
    return null;
  }

  return <HeaderWalletMenu />;
}

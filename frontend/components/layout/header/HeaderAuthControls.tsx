"use client";

import { useLogin, usePrivy } from "@privy-io/react-auth";
import { TkButton } from "@/components/ds";
import { HeaderWalletMenu } from "@/components/layout/header/wallet/HeaderWalletMenu";
import { useClientMounted } from "@/hooks/ui/useClientMounted";
import { useAuthStore } from "@/store/authStore";

/** Header auth slot — GNB Sign up (HTML tk-connect) or custom wallet chip + menu. */
export function HeaderAuthControls({
  onOpenNotifications,
}: {
  onOpenNotifications?: () => void;
}) {
  const mounted = useClientMounted();
  const { ready, authenticated } = usePrivy();
  const { login } = useLogin();
  const initialized = useAuthStore((s) => s.initialized);
  const loading = useAuthStore((s) => s.loading);

  // Privy reads browser storage during render — gate until mount (same as PrivyUserPill).
  if (!mounted || !ready) {
    return <div className="gnb-auth-skeleton animate-pulse" aria-hidden />;
  }

  if (!authenticated && (!initialized || loading)) {
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

  return <HeaderWalletMenu onOpenNotifications={onOpenNotifications} />;
}

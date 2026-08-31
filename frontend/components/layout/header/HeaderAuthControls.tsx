"use client";

import dynamic from "next/dynamic";
import { useLogin } from "@privy-io/react-auth";
import { TkButton } from "@/components/ds";
import { usePrivyInitGate } from "@/hooks/auth/usePrivyInitGate";
import { useAuthStore } from "@/store/authStore";

const HeaderWalletMenu = dynamic(
  () =>
    import("@/components/layout/header/wallet/HeaderWalletMenu").then((m) => ({
      default: m.HeaderWalletMenu,
    })),
  {
    ssr: false,
    loading: () => <div className="gnb-auth-skeleton animate-pulse" aria-hidden />,
  },
);

/** Header auth slot — GNB Sign up (HTML tk-connect) or custom wallet chip + menu. */
export function HeaderAuthControls({
  onOpenNotifications,
}: {
  onOpenNotifications?: () => void;
}) {
  const { login } = useLogin();
  const { canShowAuthUi, authenticated, privyUnavailable } = usePrivyInitGate();
  const initialized = useAuthStore((s) => s.initialized);
  const loading = useAuthStore((s) => s.loading);

  if (!canShowAuthUi) {
    return <div className="gnb-auth-skeleton animate-pulse" aria-hidden />;
  }

  if (!authenticated && (!initialized || loading) && !privyUnavailable) {
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

"use client";

import dynamic from "next/dynamic";
import { usePathname, useSearchParams } from "next/navigation";
import { TkButton } from "@/components/ds";
import { usePrivyInitGate } from "@/hooks/auth/usePrivyInitGate";
import { resolveAuthReturnTo } from "@/lib/auth";
import { useAuthStore } from "@/store/authStore";
import { useAuthUiStore } from "@/store/authUiStore";

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
  const openSignIn = useAuthUiStore((s) => s.openSignIn);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { canShowAuthUi, authenticated, privyUnavailable } = usePrivyInitGate();
  const initialized = useAuthStore((s) => s.initialized);
  const loading = useAuthStore((s) => s.loading);

  const signInReturnTo = resolveAuthReturnTo(pathname, searchParams);

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
        onClick={() => openSignIn({ returnTo: signInReturnTo })}
      >
        Sign up
      </TkButton>
    );
  }

  return <HeaderWalletMenu onOpenNotifications={onOpenNotifications} />;
}

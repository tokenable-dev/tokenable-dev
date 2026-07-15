"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useClientMounted } from "@/hooks/ui/useClientMounted";
import { useAuthStore } from "@/store/authStore";
import { HeaderWalletMenuPanel } from "./HeaderWalletMenuPanel";

/** Mobile drawer wallet section (HTML tk-mobile-wallet-section). */
export function HeaderMobileWalletSection({
  onClose,
  onOpenNotifications,
}: {
  onClose?: () => void;
  onOpenNotifications?: () => void;
}) {
  const mounted = useClientMounted();
  const { ready, authenticated } = usePrivy();
  const initialized = useAuthStore((s) => s.initialized);
  const loading = useAuthStore((s) => s.loading);

  if (!mounted || !ready || !initialized || loading || !authenticated) {
    return null;
  }

  return (
    <section className="tk-mobile-wallet-section" aria-label="Account menu">
      <HeaderWalletMenuPanel
        variant="mobile"
        onNavigate={onClose}
        onOpenNotifications={onOpenNotifications}
      />
    </section>
  );
}

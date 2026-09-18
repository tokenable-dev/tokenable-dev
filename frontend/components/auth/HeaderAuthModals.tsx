"use client";

import { WalletsDialog } from "@privy-io/react-auth/ui";
import { usePrivy } from "@privy-io/react-auth";
import { PrivyWalletMismatchModal } from "./PrivyWalletMismatchModal";
import { KycRequiredModal } from "./KycRequiredModal";
import { useClientMounted } from "@/hooks/ui/useClientMounted";

/** Mount once near the app shell (`TkHeader`). */
export function HeaderAuthModals() {
  const mounted = useClientMounted();
  const { authenticated } = usePrivy();

  if (!mounted) return null;

  return (
    <>
      {authenticated ? <WalletsDialog /> : null}
      <PrivyWalletMismatchModal />
      <KycRequiredModal />
    </>
  );
}

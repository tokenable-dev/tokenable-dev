"use client";

import { PrivyWalletMismatchModal } from "./PrivyWalletMismatchModal";
import { KycRequiredModal } from "./KycRequiredModal";
import { WalletsDialog } from "@privy-io/react-auth/ui";
import { useClientMounted } from "@/hooks/ui/useClientMounted";

/** Mount once near the app shell (`TkHeader`). */
export function HeaderAuthModals() {
  const mounted = useClientMounted();

  if (!mounted) return null;

  return (
    <>
      <WalletsDialog />
      <PrivyWalletMismatchModal />
      <KycRequiredModal />
    </>
  );
}
